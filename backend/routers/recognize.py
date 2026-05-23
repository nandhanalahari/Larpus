from fastapi import APIRouter, HTTPException
from models.schemas import (
    RecognizeRequest,
    RecognizeMatchResponse,
    RecognizeNoMatchResponse,
    ContactInfo,
    LastPayment,
    PendingDebt,
)
from services.face_service import get_embedding
from database import get_contacts_collection, get_debts_collection, get_transactions_collection
from bson import ObjectId

router = APIRouter()

CONFIDENCE_HIGH = 0.85
CONFIDENCE_LOW = 0.60


@router.post("/recognize")
async def recognize_face(req: RecognizeRequest):
    embedding = get_embedding(req.image_base64)

    if embedding is None:
        return RecognizeNoMatchResponse(confidence=0.0)

    contacts_col = get_contacts_collection()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "face_embeddings.embedding",
                "queryVector": embedding,
                "numCandidates": 50,
                "limit": 1,
            }
        },
        {
            "$addFields": {
                "search_score": {"$meta": "vectorSearchScore"}
            }
        },
    ]

    results = []
    async for doc in contacts_col.aggregate(pipeline):
        results.append(doc)

    if not results or results[0]["search_score"] < CONFIDENCE_LOW:
        score = results[0]["search_score"] if results else 0.0
        return RecognizeNoMatchResponse(confidence=score)

    match = results[0]
    score = match["search_score"]
    contact_id = str(match["_id"])

    debts_col = get_debts_collection()
    pending_debts = []
    total_outstanding = 0.0
    async for debt in debts_col.find({
        "to_contact_id": contact_id,
        "from_user_id": req.user_id,
        "status": "pending",
    }):
        pending_debts.append(PendingDebt(
            debt_id=str(debt["_id"]),
            amount_usd=debt["amount_usd"],
            due_date=debt.get("due_date", ""),
        ))
        total_outstanding += debt["amount_usd"]

    tx_col = get_transactions_collection()
    last_tx = await tx_col.find_one(
        {"to_wallet": match.get("solana_wallet_address")},
        sort=[("created_at", -1)],
    )
    last_payment = None
    if last_tx:
        last_payment = LastPayment(
            amount_usd=last_tx["amount_usd"],
            paid_at=str(last_tx.get("confirmed_at", last_tx.get("created_at", ""))),
        )

    contact = ContactInfo(
        id=contact_id,
        name=match["name"],
        phone=match.get("phone"),
        solana_wallet_address=match.get("solana_wallet_address"),
        last_payment=last_payment,
        pending_debts=pending_debts,
        total_outstanding_usd=total_outstanding,
    )

    requires_confirmation = score < CONFIDENCE_HIGH

    return RecognizeMatchResponse(
        confidence=score,
        requires_confirmation=requires_confirmation,
        contact=contact,
    )
