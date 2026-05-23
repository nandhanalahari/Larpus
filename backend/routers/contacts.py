from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from models.schemas import CreateContactRequest, CreateContactResponse
from services.face_service import get_embedding
from database import get_contacts_collection, get_debts_collection
from bson import ObjectId

router = APIRouter()

ANGLES = ["straight", "left", "right"]


@router.post("/contacts")
async def create_contact(req: CreateContactRequest):
    if not req.face_images_base64:
        raise HTTPException(status_code=400, detail="At least one face image required")

    embeddings = []
    for i, img_b64 in enumerate(req.face_images_base64):
        emb = get_embedding(img_b64)
        if emb is None:
            raise HTTPException(
                status_code=400,
                detail=f"No face detected in image {i + 1}",
            )
        angle = ANGLES[i] if i < len(ANGLES) else "straight"
        embeddings.append({
            "embedding": emb,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "angle": angle,
        })

    contacts_col = get_contacts_collection()

    if req.solana_wallet_address:
        existing = await contacts_col.find_one({
            "owner_user_id": req.owner_user_id,
            "solana_wallet_address": req.solana_wallet_address,
        })
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

    return CreateContactResponse(
        contact_id=str(result.inserted_id),
        name=req.name,
        embeddings_stored=len(embeddings),
        created_at=now,
    )


@router.get("/contacts/{contact_id}/debts")
async def get_contact_debts(contact_id: str):
    debts_col = get_debts_collection()

    pending = []
    paid = []
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
