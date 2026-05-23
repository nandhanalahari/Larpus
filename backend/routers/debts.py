"""Debts: scheduled/pending IOUs persisted in MongoDB.

A debt record stores both wallet addresses so each user can query their own
ledger symmetrically:
  - "money I owe"    = debts where from_user_id == my_wallet
  - "owed to me"     = debts where to_wallet    == my_wallet

Confirmed on-chain payments live in the `transactions` collection and are
PoH-anchored via Solana RPC (slot + block_time). A debt may transition from
pending -> paid when its corresponding /payments/execute fires; the
transaction_signature back-links to the Solana ledger entry.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from bson import ObjectId
from bson.errors import InvalidId

from database import (
    get_contacts_collection,
    get_debts_collection,
)
from models.schemas import (
    CreateDebtRequest,
    DebtRecord,
    UserDebtsResponse,
)

router = APIRouter()


def _serialize_debt(doc: dict, fallback_name: str = "") -> DebtRecord:
    return DebtRecord(
        debt_id=str(doc["_id"]),
        from_user_id=doc.get("from_user_id", ""),
        to_wallet=doc.get("to_wallet", ""),
        to_contact_id=doc.get("to_contact_id", ""),
        counterparty_name=doc.get("counterparty_name", fallback_name),
        amount_usd=float(doc.get("amount_usd", 0.0)),
        status=doc.get("status", "pending"),
        created_at=doc.get("created_at", ""),
        due_date=doc.get("due_date"),
        paid_at=doc.get("paid_at"),
        transaction_signature=doc.get("transaction_signature"),
    )


@router.post("/debts", response_model=DebtRecord)
async def create_debt(req: CreateDebtRequest):
    """Record a scheduled or pending debt (e.g. from a voice-scheduled payment)."""
    debts_col = get_debts_collection()
    now = datetime.now(timezone.utc).isoformat()
    status = "scheduled" if req.due_date else "pending"
    doc = {
        "from_user_id": req.from_user_id,
        "to_contact_id": req.to_contact_id,
        "to_wallet": req.to_wallet,
        "counterparty_name": req.contact_name,
        "amount_usd": req.amount_usd,
        "status": status,
        "created_at": now,
        "due_date": req.due_date,
    }
    res = await debts_col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize_debt(doc)


@router.get("/debts/by-user/{wallet}", response_model=UserDebtsResponse)
async def get_user_debts(wallet: str):
    """Return both sides of this user's ledger.

    `owed_by_me`: debts I created where I'm the debtor (from_user_id).
    `owed_to_me`: debts where someone else listed me as creditor (to_wallet).
    """
    debts_col = get_debts_collection()
    contacts_col = get_contacts_collection()

    owed_by_me_docs: list[dict] = []
    owed_to_me_docs: list[dict] = []
    async for d in debts_col.find(
        {"$or": [{"from_user_id": wallet}, {"to_wallet": wallet}]}
    ).sort("created_at", -1):
        if d.get("from_user_id") == wallet:
            owed_by_me_docs.append(d)
        if d.get("to_wallet") == wallet:
            owed_to_me_docs.append(d)

    # For "owed to me" rows, the snapshot counterparty_name is the *creditor's*
    # name (useless to the creditor). Resolve the debtor's name by looking up
    # the debtor wallet in contacts; if not found, fall back to short address.
    debtor_wallets = {
        d.get("from_user_id") for d in owed_to_me_docs if d.get("from_user_id")
    }
    debtor_name_map: dict[str, str] = {}
    if debtor_wallets:
        async for c in contacts_col.find(
            {"solana_wallet_address": {"$in": list(debtor_wallets)}},
            projection={"solana_wallet_address": 1, "name": 1},
        ):
            w = c.get("solana_wallet_address")
            if w:
                debtor_name_map.setdefault(w, c.get("name", ""))

    def _short(addr: str) -> str:
        return f"{addr[:4]}…{addr[-4:]}" if addr else "Unknown"

    owed_by_me = [_serialize_debt(d) for d in owed_by_me_docs]
    owed_to_me = [
        _serialize_debt(
            d, fallback_name=debtor_name_map.get(d.get("from_user_id", ""), _short(d.get("from_user_id", "")))
        )
        for d in owed_to_me_docs
    ]
    # Override counterparty_name on owed_to_me with the debtor's resolved name.
    for record, doc in zip(owed_to_me, owed_to_me_docs):
        debtor_wallet = doc.get("from_user_id", "")
        record.counterparty_name = debtor_name_map.get(debtor_wallet) or _short(debtor_wallet)

    total_i_owe = sum(d.amount_usd for d in owed_by_me if d.status in ("pending", "scheduled"))
    total_owed_to_me = sum(
        d.amount_usd for d in owed_to_me if d.status in ("pending", "scheduled")
    )

    return UserDebtsResponse(
        user_id=wallet,
        owed_by_me=owed_by_me,
        owed_to_me=owed_to_me,
        total_i_owe_usd=total_i_owe,
        total_owed_to_me_usd=total_owed_to_me,
    )


@router.post("/debts/{debt_id}/mark-paid")
async def mark_debt_paid(debt_id: str, transaction_signature: Optional[str] = None):
    """Transition a debt to `paid`, optionally back-linking to a Solana tx."""
    try:
        oid = ObjectId(debt_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="invalid debt_id")
    debts_col = get_debts_collection()
    update = {
        "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat(),
    }
    if transaction_signature:
        update["transaction_signature"] = transaction_signature
    res = await debts_col.update_one({"_id": oid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="debt not found")
    doc = await debts_col.find_one({"_id": oid})
    return _serialize_debt(doc)
