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
    """Fetch new signatures since the most recent cached one and upsert them.

    Returns the number of newly cached transactions.
    """
    coll = get_transactions_collection()

    # Find the newest cached signature for this wallet to use as `until` (RPC
    # returns sigs newer than `until`, walking backwards from latest).
    last_doc = await coll.find_one(
        {"$or": [{"from_wallet": wallet}, {"to_wallet": wallet}]},
        sort=[("block_time", -1)],
        projection={"signature": 1},
    )
    until = last_doc.get("signature") if last_doc else None

    try:
        sigs = await get_signatures_for_address(wallet, until=until, limit=limit)
    except Exception as e:
        log.warning("getSignaturesForAddress failed for %s: %s", wallet, e)
        return 0

    if not sigs:
        return 0

    log.info("sync_wallet wallet=%s candidates=%d (until=%s)", wallet, len(sigs), until)

    # Bounded concurrency so we don't blast public RPC.
    sem = asyncio.Semaphore(PARSE_CONCURRENCY)

    async def _guarded(entry: dict) -> Optional[dict]:
        async with sem:
            return await _process_signature(wallet, entry)

    docs = await asyncio.gather(*(_guarded(s) for s in sigs))
    docs = [d for d in docs if d]

    inserted = 0
    for doc in docs:
        # Upsert by signature so concurrent syncs don't double-write.
        res = await coll.update_one(
            {"signature": doc["signature"]},
            {"$set": doc},
            upsert=True,
        )
        if res.upserted_id is not None:
            inserted += 1

    log.info("sync_wallet wallet=%s inserted=%d transfers=%d", wallet, inserted, len(docs))
    return inserted
