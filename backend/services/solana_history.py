"""Solana RPC wrapper for transaction history.

Pulls signatures + parsed details from the configured RPC and caches them in
MongoDB so the mobile app reads a fast list without hitting the chain on
every render. Stateless wrt the request — every call may upsert rows.

Only handles native SOL System.transfer instructions. Token transfers, swaps,
and program calls are skipped (counterparty_wallet would be ambiguous).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

import httpx

from config import get_settings
from database import get_ledger_collection, get_transactions_collection
from services.accounts import apply_transfer_balances

log = logging.getLogger("inference.solana_history")

LAMPORTS_PER_SOL = 1_000_000_000
DEFAULT_FETCH_LIMIT = 50
REQUEST_TIMEOUT = 20.0
PARSE_CONCURRENCY = 4  # avoid hammering public devnet RPC


async def _rpc(client: httpx.AsyncClient, method: str, params: list[Any]) -> Any:
    settings = get_settings()
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    resp = await client.post(settings.solana_rpc_url, json=body)
    resp.raise_for_status()
    payload = resp.json()
    if "error" in payload:
        raise RuntimeError(f"RPC error {payload['error']}")
    return payload.get("result")


async def get_signatures_for_address(
    wallet: str, until: Optional[str] = None, limit: int = DEFAULT_FETCH_LIMIT
) -> list[dict]:
    params: list[Any] = [wallet, {"limit": min(max(limit, 1), 1000)}]
    if until:
        params[1]["until"] = until
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        result = await _rpc(client, "getSignaturesForAddress", params)
    return result or []


async def get_parsed_transaction(signature: str) -> Optional[dict]:
    params = [
        signature,
        {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0},
    ]
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        result = await _rpc(client, "getTransaction", params)
    return result


def _instruction_list(parsed_tx: dict) -> list[dict]:
    """Top-level + inner instructions (many wallets only show transfer in inner ix)."""
    message = parsed_tx.get("transaction", {}).get("message", {})
    instructions: list[dict] = list(message.get("instructions", []))
    meta = parsed_tx.get("meta") or {}
    for inner in meta.get("innerInstructions") or []:
        instructions.extend(inner.get("instructions") or [])
    return instructions


def _extract_transfer(parsed_tx: dict) -> Optional[dict]:
    """Pull the first System.transfer instruction. Return source/destination/lamports or None."""
    if not parsed_tx:
        return None
    for ix in _instruction_list(parsed_tx):
        program = ix.get("program")
        program_id = ix.get("programId")
        is_system = program == "system" or program_id == "11111111111111111111111111111111"
        parsed = ix.get("parsed") or {}
        if is_system and parsed.get("type") == "transfer":
            info = parsed.get("info") or {}
            src = info.get("source")
            dst = info.get("destination")
            lamports = info.get("lamports")
            if src and dst and lamports is not None:
                return {
                    "source": src,
                    "destination": dst,
                    "lamports": int(lamports),
                }
    return None


async def upsert_transaction_doc(doc: dict, apply_balance: bool = True) -> bool:
    """Upsert a transaction row by signature + mirror into the double-entry ledger.

    Returns True if a brand-new row was inserted into `transactions`.

    `apply_balance=False` skips the wallet debit/credit (use when the caller
    already applied balances, e.g. confirm_transaction).

    Raises InsufficientBalanceError if the sender lacks funds — callers that
    must not surface this (e.g. chain sync) should catch it themselves.
    """
    coll = get_transactions_collection()
    existing = await coll.find_one(
        {"signature": doc["signature"]},
        projection={"_id": 1, "balance_applied": 1},
    )
    is_new = existing is None
    already_balanced = existing is not None and existing.get("balance_applied", False)

    if apply_balance and is_new and not already_balanced:
        from_w = doc.get("from_wallet")
        to_w = doc.get("to_wallet")
        if from_w and to_w:
            # Raises InsufficientBalanceError — let it propagate so HTTP routes
            # can return 402.  Chain-sync callers should catch it.
            await apply_transfer_balances(from_w, to_w, float(doc.get("amount_sol", 0.0)))

    await coll.update_one(
        {"signature": doc["signature"]},
        {"$set": {**doc, "balance_applied": is_new}},
        upsert=True,
    )
    await _mirror_to_ledger(doc)
    return is_new


async def _mirror_to_ledger(tx_doc: dict) -> None:
    """Write two ledger rows for a transfer: sender (outgoing) + receiver (incoming)."""
    ledger = get_ledger_collection()
    signature = tx_doc["signature"]
    from_w = tx_doc.get("from_wallet")
    to_w = tx_doc.get("to_wallet")
    if not from_w or not to_w:
        return

    base = {
        "signature": signature,
        "slot": int(tx_doc.get("slot", 0)),
        "block_time": int(tx_doc.get("block_time", 0)),
        "amount_sol": float(tx_doc.get("amount_sol", 0.0)),
        "amount_lamports": int(tx_doc.get("amount_lamports", 0)),
        "amount_usd": tx_doc.get("amount_usd"),
        "cluster": tx_doc.get("cluster"),
        "status": tx_doc.get("status", "confirmed"),
        "sender_display_name": tx_doc.get("sender_display_name"),
        "cached_at": int(time.time()),
    }

    outgoing = {
        **base,
        "wallet": from_w,
        "direction": "outgoing",
        "counterparty_wallet": to_w,
    }
    incoming = {
        **base,
        "wallet": to_w,
        "direction": "incoming",
        "counterparty_wallet": from_w,
    }

    await asyncio.gather(
        ledger.update_one(
            {"signature": signature, "wallet": from_w},
            {"$set": outgoing},
            upsert=True,
        ),
        ledger.update_one(
            {"signature": signature, "wallet": to_w},
            {"$set": incoming},
            upsert=True,
        ),
    )


async def record_confirmed_transfer(
    *,
    signature: str,
    from_wallet: str,
    to_wallet: str,
    amount_sol: float,
    amount_usd: float | None = None,
    sender_display_name: str | None = None,
    block_time: int | None = None,
    slot: int | None = None,
) -> dict:
    """Write a confirmed transfer to MongoDB immediately (mobile calls after on-chain pay)."""
    print(
        f"[RECORD] sig={signature[:20]}... "
        f"from={from_wallet[:8]}... to={to_wallet[:8]}... "
        f"amount_sol={amount_sol} sender={sender_display_name}"
    )
    settings = get_settings()
    lamports = int(round(amount_sol * LAMPORTS_PER_SOL))
    doc = {
        "signature": signature,
        "slot": int(slot or 0),
        "block_time": int(block_time or time.time()),
        "from_wallet": from_wallet,
        "to_wallet": to_wallet,
        "amount_lamports": lamports,
        "amount_sol": float(amount_sol),
        "amount_usd": float(amount_usd) if amount_usd is not None else None,
        "sender_display_name": sender_display_name,
        "cluster": settings.solana_cluster,
        "status": "confirmed",
        "cached_at": int(time.time()),
        "source": "client_record",
    }
    is_new = await upsert_transaction_doc(doc)
    print(
        f"[cipher.transactions] {'INSERTED' if is_new else 'ALREADY EXISTS'} "
        f"sig={signature[:20]}...  "
        f"from={from_wallet[:8]}... -> to={to_wallet[:8]}...  "
        f"amount={amount_sol:.6f} SOL  usd={amount_usd}"
    )

    # Enrich from chain in the background so receiver history + notifications stay accurate.
    asyncio.create_task(sync_wallet(from_wallet, limit=20))
    asyncio.create_task(sync_wallet(to_wallet, limit=20))
    return doc


async def _process_signature(wallet: str, sig_entry: dict) -> Optional[dict]:
    """Fetch + parse one signature. Return upsert doc or None if skippable."""
    signature = sig_entry.get("signature")
    if not signature:
        return None
    if sig_entry.get("err") is not None:
        # Failed transactions on-chain — skip them so history only shows successful transfers.
        return None
    try:
        parsed = await get_parsed_transaction(signature)
    except Exception as e:
        log.warning("getTransaction failed for %s: %s", signature, e)
        return None

    transfer = _extract_transfer(parsed) if parsed else None
    if not transfer:
        return None

    settings = get_settings()
    block_time = parsed.get("blockTime") or sig_entry.get("blockTime") or 0
    slot = parsed.get("slot") or sig_entry.get("slot") or 0
    amount_sol = transfer["lamports"] / LAMPORTS_PER_SOL

    return {
        "signature": signature,
        "slot": int(slot),
        "block_time": int(block_time),
        "from_wallet": transfer["source"],
        "to_wallet": transfer["destination"],
        "amount_lamports": transfer["lamports"],
        "amount_sol": amount_sol,
        "cluster": settings.solana_cluster,
        "status": "confirmed",
        "cached_at": int(time.time()),
    }


async def sync_wallet(wallet: str, limit: int = DEFAULT_FETCH_LIMIT) -> int:
    """Fetch the latest N signatures for `wallet`, parse + upsert the new ones.

    Returns the number of newly cached transactions.

    We deliberately do NOT pass an `until` cursor to the RPC — it's tempting
    as an optimization, but the transactions collection contains both real
    on-chain sigs and synthetic ones (DEMO_*, devnet_*, legacy /payments
    rows) from seed scripts and earlier code paths. Passing a synthetic sig
    as `until` to Solana RPC leads to silent under-fetching — most notably,
    the receiver side of a transfer never gets cached.

    Instead we pull the top-N latest sigs unconditionally, then skip the
    ones we've already parsed via a single existence query. This costs at
    most N small reads and is bounded by `limit`, but it's robust against
    any junk that ends up in the transactions collection.
    """
    coll = get_transactions_collection()

    try:
        sigs = await get_signatures_for_address(wallet, until=None, limit=limit)
    except Exception as e:
        log.warning("getSignaturesForAddress failed for %s: %s", wallet, e)
        return 0

    if not sigs:
        return 0

    sig_strings = [s.get("signature") for s in sigs if s.get("signature")]
    # Find which of these signatures are already cached so we skip the
    # (expensive) getTransaction round-trip for them.
    cached_cursor = coll.find(
        {"signature": {"$in": sig_strings}},
        projection={"signature": 1},
    )
    already: set[str] = set()
    async for d in cached_cursor:
        already.add(d["signature"])

    fresh = [s for s in sigs if s.get("signature") and s["signature"] not in already]

    log.info(
        "sync_wallet wallet=%s candidates=%d cached=%d fresh=%d",
        wallet, len(sigs), len(already), len(fresh),
    )

    if not fresh:
        return 0

    sem = asyncio.Semaphore(PARSE_CONCURRENCY)

    async def _guarded(entry: dict) -> Optional[dict]:
        async with sem:
            return await _process_signature(wallet, entry)

    docs = await asyncio.gather(*(_guarded(s) for s in fresh))
    docs = [d for d in docs if d]

    from services.accounts import InsufficientBalanceError

    inserted = 0
    for doc in docs:
        try:
            if await upsert_transaction_doc(doc):
                inserted += 1
        except InsufficientBalanceError as e:
            log.warning(
                "sync_wallet balance apply failed sig=%s: %s",
                doc.get("signature", "?")[:20],
                e,
            )

    log.info("sync_wallet wallet=%s inserted=%d transfers=%d", wallet, inserted, len(docs))
    return inserted
