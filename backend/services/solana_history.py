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
from database import get_transactions_collection

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


def _extract_transfer(parsed_tx: dict) -> Optional[dict]:
    """Pull the first System.transfer instruction. Return source/destination/lamports or None."""
    if not parsed_tx:
        return None
    message = parsed_tx.get("transaction", {}).get("message", {})
    for ix in message.get("instructions", []):
        if ix.get("program") == "system" and ix.get("parsed", {}).get("type") == "transfer":
            info = ix["parsed"].get("info") or {}
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

    inserted = 0
    for doc in docs:
        # Upsert by signature so concurrent syncs of the same tx (e.g. both
        # sender and receiver hitting /transactions at once) don't double-write.
        res = await coll.update_one(
            {"signature": doc["signature"]},
            {"$set": doc},
            upsert=True,
        )
        if res.upserted_id is not None:
            inserted += 1

    log.info("sync_wallet wallet=%s inserted=%d transfers=%d", wallet, inserted, len(docs))
    return inserted
