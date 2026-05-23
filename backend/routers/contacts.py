"""POST /api/v1/contacts — enroll a new contact (or self) with 1-3 face images.

Server-side flow:
  1. Decode each base64 image, run face detection / embedding (InsightFace).
  2. Reject if any image has no detectable face (real model) — stub mode
     always succeeds, so the rest of the pipeline works during development.
  3. Insert document with `face_embeddings: [{embedding, angle, captured_at}, …]`
     — that field is what the Atlas Vector Search index searches over.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from database import (
    get_contacts_collection,
    get_debts_collection,
    is_connected,
)
from models.schemas import CreateContactRequest, CreateContactResponse
from services.face_service import get_embedding

router = APIRouter()

ANGLES = ["straight", "left", "right"]


@router.post("/contacts")
async def create_contact(req: CreateContactRequest):
    if not is_connected():
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not req.face_images_base64:
        raise HTTPException(status_code=400, detail="At least one face image required")

    embeddings: list[dict] = []
    for i, img_b64 in enumerate(req.face_images_base64):
        emb = get_embedding(img_b64)
        if emb is None:
            raise HTTPException(
                status_code=400,
                detail=f"No face detected in image {i + 1}. Ask the person to face the camera in good light.",
            )
        embeddings.append(
            {
                "embedding": emb,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "angle": ANGLES[i] if i < len(ANGLES) else "extra",
            }
        )

    contacts_col = get_contacts_collection()

    if req.solana_wallet_address:
        existing = await contacts_col.find_one(
            {
                "owner_user_id": req.owner_user_id,
                "solana_wallet_address": req.solana_wallet_address,
            }
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Contact with this wallet already exists: {existing['name']}",
            )

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "owner_user_id": req.owner_user_id,
        "name": req.name,
        "phone": req.phone,
        "solana_wallet_address": req.solana_wallet_address,
        "face_embeddings": embeddings,
        "total_paid_usd": 0.0,
        "total_owed_usd": 0.0,
        "created_at": now,
        "updated_at": now,
    }

    result = await contacts_col.insert_one(doc)
    print(
        f"[contacts] enrolled '{req.name}' "
        f"owner={req.owner_user_id[:8]}… with {len(embeddings)} embedding(s)"
    )

    return CreateContactResponse(
        contact_id=str(result.inserted_id),
        name=req.name,
        embeddings_stored=len(embeddings),
        created_at=now,
    )


@router.get("/contacts")
async def list_contacts(owner_user_id: str):
    """List every contact for an owner (handy for the mobile contacts screen)."""
    if not is_connected():
        raise HTTPException(status_code=503, detail="Database unavailable")

    contacts_col = get_contacts_collection()
    out: list[dict] = []
    async for doc in contacts_col.find({"owner_user_id": owner_user_id}):
        out.append(
            {
                "id": str(doc["_id"]),
                "name": doc["name"],
                "phone": doc.get("phone"),
                "solana_wallet_address": doc.get("solana_wallet_address"),
                "embeddings_stored": len(doc.get("face_embeddings", [])),
                "created_at": doc.get("created_at"),
                "total_paid_usd": doc.get("total_paid_usd", 0.0),
                "total_owed_usd": doc.get("total_owed_usd", 0.0),
            }
        )
    return {"contacts": out, "count": len(out)}


@router.get("/contacts/{contact_id}/debts")
async def get_contact_debts(contact_id: str):
    if not is_connected():
        raise HTTPException(status_code=503, detail="Database unavailable")

    debts_col = get_debts_collection()

    pending: list[dict] = []
    paid: list[dict] = []
    total_outstanding = 0.0
    total_paid = 0.0

    async for debt in debts_col.find({"to_contact_id": contact_id}):
        entry = {
            "debt_id": str(debt["_id"]),
            "amount_usd": debt["amount_usd"],
            "status": debt["status"],
            "created_at": debt.get("created_at", ""),
            "due_date": debt.get("due_date"),
        }
        if debt["status"] == "pending":
            pending.append(entry)
            total_outstanding += debt["amount_usd"]
        elif debt["status"] == "paid":
            paid.append(entry)
            total_paid += debt["amount_usd"]

    return {
        "contact_id": contact_id,
        "pending_debts": pending,
        "paid_debts": paid,
        "total_outstanding_usd": total_outstanding,
        "total_paid_usd": total_paid,
    }
