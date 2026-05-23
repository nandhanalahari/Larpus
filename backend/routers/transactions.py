"""Transaction history endpoint.

Mobile reads from MongoDB cache; server-side `sync` refreshes from Solana RPC
before the read. Joins counterparty wallet -> contact name when known.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query

from config import get_settings
from database import get_contacts_collection, get_transactions_collection
from models.schemas import HistoryTransaction, TransactionHistoryResponse
from services import solana_history

log = logging.getLogger("inference.transactions")

router = APIRouter()

EXPLORER_BASE = "https://explorer.solana.com/tx"


def _explorer_url(signature: str, cluster: str) -> str:
    suffix = "" if cluster == "mainnet-beta" else f"?cluster={cluster}"
    return f"{EXPLORER_BASE}/{signature}{suffix}"


@router.get("/transactions/{wallet_address}", response_model=TransactionHistoryResponse)
async def get_transaction_history(
    wallet_address: str,
    limit: int = Query(default=30, ge=1, le=100),
    sync: bool = Query(default=True, description="Refresh from Solana RPC before reading"),
):
    settings = get_settings()
    synced = 0
    if sync:
        try:
            synced = await solana_history.sync_wallet(wallet_address)
        except Exception as e:
            log.warning("sync_wallet failed for %s (returning cached only): %s", wallet_address, e)

    txs_coll = get_transactions_collection()
    cursor = txs_coll.find(
        {
            "$or": [
                {"from_wallet": wallet_address},
                {"to_wallet": wallet_address},
            ],
            "signature": {"$exists": True},  # exclude legacy /payments/execute fake rows
        },
        sort=[("block_time", -1)],
    ).limit(limit)

    rows: list[dict] = []
    counterparty_wallets: set[str] = set()
    async for doc in cursor:
        from_w = doc.get("from_wallet")
        to_w = doc.get("to_wallet")
        direction = "sent" if from_w == wallet_address else "received"
        counterparty = to_w if direction == "sent" else from_w
        if counterparty:
            counterparty_wallets.add(counterparty)
        rows.append(
            {
                "signature": doc["signature"],
                "slot": int(doc.get("slot", 0)),
                "block_time": int(doc.get("block_time", 0)),
                "direction": direction,
                "counterparty_wallet": counterparty or "",
                "amount_sol": float(doc.get("amount_sol", 0.0)),
                "cluster": doc.get("cluster", settings.solana_cluster),
                "notes": doc.get("notes"),
            }
        )

    # Resolve counterparty names from contacts collection in a single batch.
    name_map: dict[str, str] = {}
    if counterparty_wallets:
        contacts_coll = get_contacts_collection()
        async for c in contacts_coll.find(
            {"solana_wallet_address": {"$in": list(counterparty_wallets)}},
            projection={"solana_wallet_address": 1, "name": 1},
        ):
            wallet = c.get("solana_wallet_address")
            if wallet:
                # First match wins; multiple owners might have the same person as a contact.
                name_map.setdefault(wallet, c.get("name"))

    transactions = [
        HistoryTransaction(
            signature=r["signature"],
            slot=r["slot"],
            block_time=r["block_time"],
            direction=r["direction"],
            counterparty_wallet=r["counterparty_wallet"],
            counterparty_name=name_map.get(r["counterparty_wallet"]),
            amount_sol=r["amount_sol"],
            cluster=r["cluster"],
            explorer_url=_explorer_url(r["signature"], r["cluster"]),
            notes=r.get("notes"),
        )
        for r in rows
    ]

    return TransactionHistoryResponse(
        wallet=wallet_address,
        count=len(transactions),
        synced=synced,
        transactions=transactions,
    )
