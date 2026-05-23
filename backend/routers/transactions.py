"""Transaction history + live deposit polling.

Reads from the `kolana.ledger` collection — a true double-entry view where
each transfer produces two rows: one `outgoing` for the sender and one
`incoming` for the receiver. Querying a wallet's history is then a direct
`{wallet: X}` match.
"""

from __future__ import annotations

import logging
import time

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from config import get_settings
from database import get_contacts_collection, get_ledger_collection, get_transactions_collection
from uuid import uuid4

from models.schemas import (
    ConfirmTransactionRequest,
    ConfirmTransactionResponse,
    HistoryTransaction,
    InitiateTransactionRequest,
    InitiateTransactionResponse,
    IncomingPaymentNotification,
    IncomingPaymentsResponse,
    RecordTransactionRequest,
    RecordTransactionResponse,
    TransactionHistoryResponse,
    TransferResponse,
)
from services.accounts import InsufficientBalanceError
from services import solana_history

log = logging.getLogger("inference.transactions")

router = APIRouter()

EXPLORER_BASE = "https://explorer.solana.com/tx"


def _explorer_url(signature: str, cluster: str) -> str:
    suffix = "" if cluster == "mainnet-beta" else f"?cluster={cluster}"
    return f"{EXPLORER_BASE}/{signature}{suffix}"


async def _resolve_counterparty_names(wallets: set[str]) -> dict[str, str]:
    if not wallets:
        return {}
    name_map: dict[str, str] = {}
    contacts_coll = get_contacts_collection()
    async for c in contacts_coll.find(
        {"solana_wallet_address": {"$in": list(wallets)}},
        projection={"solana_wallet_address": 1, "name": 1},
    ):
        wallet = c.get("solana_wallet_address")
        if wallet:
            name_map.setdefault(wallet, c.get("name"))
    return name_map


@router.post("/transactions/transfer", response_model=TransferResponse)
async def transfer_funds(body: InitiateTransactionRequest):
    """Atomic app-level transfer between two wallets.

    1. Verifies the sender has enough balance in kolana.users (creating the
       account with a $1000 starting grant if it has never been seen before).
    2. Debits the sender and credits the receiver atomically in kolana.users.
    3. Writes the confirmed transaction to kolana.transactions with
       from_wallet, to_wallet, amount_sol, amount_usd, and direction.
    4. Mirrors to kolana.ledger so the receiver's notification poll fires
       within its next 3-second cycle.

    Uses a synthetic KOLANA_ signature — no Solana devnet RPC call required.
    The Solana wallet addresses are used purely as identifiers.
    """
    signature = f"KOLANA_{uuid4().hex[:24]}"

    try:
        await solana_history.record_confirmed_transfer(
            signature=signature,
            from_wallet=body.from_wallet,
            to_wallet=body.to_wallet,
            amount_sol=body.amount_sol,
            amount_usd=body.amount_usd,
            sender_display_name=body.sender_display_name,
            note=body.note,
        )
    except InsufficientBalanceError as e:
        raise HTTPException(status_code=402, detail=str(e)) from e

    return TransferResponse(
        signature=signature,
        from_wallet=body.from_wallet,
        to_wallet=body.to_wallet,
        amount_sol=float(body.amount_sol),
        amount_usd=body.amount_usd,
        note=body.note,
    )


@router.post("/transactions/initiate", response_model=InitiateTransactionResponse)
async def initiate_transaction(body: InitiateTransactionRequest):
    """Create a pending transaction record before executing the on-chain transfer.

    The mobile app calls this first, uses the returned `to_wallet` and
    `amount_sol` to fire the Solana transfer, then calls
    POST /transactions/{transaction_id}/confirm with the on-chain signature.
    Both wallet addresses, the amount, and the direction (from→to) are
    persisted immediately so the intent is captured even if the chain call fails.
    """
    tx_col = get_transactions_collection()
    settings = get_settings()
    now = int(time.time())
    transaction_id = str(ObjectId())

    doc = {
        "transaction_id": transaction_id,
        "from_wallet": body.from_wallet,
        "to_wallet": body.to_wallet,
        "amount_sol": float(body.amount_sol),
        "amount_usd": float(body.amount_usd) if body.amount_usd is not None else None,
        "sender_display_name": body.sender_display_name,
        "cluster": settings.solana_cluster,
        "status": "pending",
        "balance_applied": False,
        "initiated_at": now,
        "cached_at": now,
        "source": "app_initiated",
    }
    await tx_col.insert_one(doc)

    return InitiateTransactionResponse(
        transaction_id=transaction_id,
        from_wallet=body.from_wallet,
        to_wallet=body.to_wallet,
        amount_sol=float(body.amount_sol),
        amount_usd=body.amount_usd,
    )


@router.post("/transactions/{transaction_id}/confirm", response_model=ConfirmTransactionResponse)
async def confirm_transaction(transaction_id: str, body: ConfirmTransactionRequest):
    """Confirm a pending transaction with its on-chain signature.

    Looks up the pending record created by /transactions/initiate, calls
    record_confirmed_transfer (which debits the sender, credits the receiver,
    and mirrors to the ledger so the receiver's notification poll picks it up),
    then marks the pending record as confirmed.
    """
    tx_col = get_transactions_collection()
    pending = await tx_col.find_one({"transaction_id": transaction_id})
    if not pending:
        raise HTTPException(status_code=404, detail="Pending transaction not found")

    # Idempotent: if already confirmed return the stored signature.
    if pending.get("status") == "confirmed":
        return ConfirmTransactionResponse(
            transaction_id=transaction_id,
            signature=pending.get("linked_signature", body.signature),
        )

    try:
        await solana_history.record_confirmed_transfer(
            signature=body.signature,
            from_wallet=pending["from_wallet"],
            to_wallet=pending["to_wallet"],
            amount_sol=float(pending["amount_sol"]),
            amount_usd=pending.get("amount_usd"),
            sender_display_name=pending.get("sender_display_name"),
            block_time=body.block_time,
            slot=body.slot,
        )
    except InsufficientBalanceError as e:
        raise HTTPException(status_code=402, detail=str(e)) from e

    # Mark the pending intent doc as confirmed and link the on-chain signature.
    await tx_col.update_one(
        {"transaction_id": transaction_id},
        {"$set": {
            "status": "confirmed",
            "linked_signature": body.signature,
            "confirmed_at": int(time.time()),
        }},
    )

    return ConfirmTransactionResponse(
        transaction_id=transaction_id,
        signature=body.signature,
    )


@router.post("/transactions/record", response_model=RecordTransactionResponse)
async def record_transaction(body: RecordTransactionRequest):
    """Persist a confirmed on-chain transfer (sender calls right after pay)."""
    try:
        await solana_history.record_confirmed_transfer(
            signature=body.signature,
            from_wallet=body.from_wallet,
            to_wallet=body.to_wallet,
            amount_sol=body.amount_sol,
            amount_usd=body.amount_usd,
            sender_display_name=body.sender_display_name,
            block_time=body.block_time,
            slot=body.slot,
        )
    except InsufficientBalanceError as e:
        raise HTTPException(status_code=402, detail=str(e)) from e
    return RecordTransactionResponse(signature=body.signature)


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

    ledger_coll = get_ledger_collection()
    cursor = ledger_coll.find(
        {"wallet": wallet_address},
        sort=[("block_time", -1)],
    ).limit(limit)

    rows: list[dict] = []
    counterparty_wallets: set[str] = set()
    async for doc in cursor:
        rows.append(doc)
        cp = doc.get("counterparty_wallet")
        if cp:
            counterparty_wallets.add(cp)

    name_map = await _resolve_counterparty_names(counterparty_wallets)

    transactions = [
        HistoryTransaction(
            signature=r["signature"],
            slot=int(r.get("slot", 0)),
            block_time=int(r.get("block_time", 0)),
            direction="sent" if r.get("direction") == "outgoing" else "received",
            counterparty_wallet=r.get("counterparty_wallet") or "",
            counterparty_name=(
                name_map.get(r.get("counterparty_wallet") or "")
                or (r.get("sender_display_name") if r.get("direction") == "incoming" else None)
            ),
            amount_sol=float(r.get("amount_sol", 0.0)),
            cluster=r.get("cluster", settings.solana_cluster),
            explorer_url=_explorer_url(r["signature"], r.get("cluster", settings.solana_cluster)),
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


@router.get(
    "/transactions/{wallet_address}/incoming",
    response_model=IncomingPaymentsResponse,
)
async def poll_incoming_payments(
    wallet_address: str,
    exclude: str = Query(
        default="",
        description="Comma-separated signatures already shown to the user",
    ),
    sync: bool = Query(default=True, description="Refresh from Solana RPC before read"),
):
    """Return new incoming transfers for live deposit notifications."""
    settings = get_settings()
    synced = 0
    if sync:
        try:
            synced = await solana_history.sync_wallet(wallet_address, limit=40)
        except Exception as e:
            log.warning("incoming sync failed for %s: %s", wallet_address, e)

    seen = {s.strip() for s in exclude.split(",") if s.strip()}
    ledger_coll = get_ledger_collection()
    cursor = ledger_coll.find(
        {"wallet": wallet_address, "direction": "incoming"},
        sort=[("block_time", -1)],
    ).limit(50)

    rows: list[dict] = []
    sender_wallets: set[str] = set()
    async for doc in cursor:
        sig = doc.get("signature")
        if not sig or sig in seen:
            continue
        cp = doc.get("counterparty_wallet") or ""
        if cp:
            sender_wallets.add(cp)
        rows.append(doc)

    name_map = await _resolve_counterparty_names(sender_wallets)

    payments: list[IncomingPaymentNotification] = []
    for doc in rows:
        cp = doc.get("counterparty_wallet") or ""
        sender_name = doc.get("sender_display_name") or name_map.get(cp)
        cluster = doc.get("cluster", settings.solana_cluster)
        payments.append(
            IncomingPaymentNotification(
                signature=doc["signature"],
                from_wallet=cp,
                sender_name=sender_name,
                amount_sol=float(doc.get("amount_sol", 0.0)),
                amount_usd=doc.get("amount_usd"),
                block_time=int(doc.get("block_time", 0)),
                explorer_url=_explorer_url(doc["signature"], cluster),
            )
        )

    return IncomingPaymentsResponse(wallet=wallet_address, synced=synced, payments=payments)
