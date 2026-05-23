"""POST /api/v1/recognize — match a face image against enrolled contacts.

Flow:
  1. Server generates a 512-d embedding from the image (InsightFace or stub).
  2. Atlas $vectorSearch on `contacts.face_embeddings.embedding` (BYOE).
     - Pre-filters by `owner_user_id` so users only match their own contacts.
  3. If the vector index doesn't exist yet (or vector search errors), we
     fall back to manual cosine similarity over every contact's stored
     embeddings — slower, but lets the app work while the Atlas index builds.
"""

from __future__ import annotations

import time

import numpy as np
from fastapi import APIRouter, HTTPException
from pymongo.errors import OperationFailure

from database import (
    get_contacts_collection,
    get_debts_collection,
    get_transactions_collection,
    is_connected,
)
from models.schemas import (
    ContactInfo,
    LastPayment,
    PendingDebt,
    RecognizeMatchResponse,
    RecognizeNoMatchResponse,
    RecognizeRequest,
)
from services.face_service import get_embedding

router = APIRouter()

VECTOR_INDEX_NAME = "vector_index"
CONFIDENCE_HIGH = 0.85
CONFIDENCE_LOW = 0.60


def _cosine(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if denom < 1e-9:
        return 0.0
    return float(np.dot(va, vb) / denom)


async def _atlas_vector_search(contacts_col, owner_user_id: str, embedding: list[float]):
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "face_embeddings.embedding",
                "queryVector": embedding,
                "numCandidates": 100,
                "limit": 5,
                "filter": {"owner_user_id": owner_user_id},
            }
        },
        {"$addFields": {"search_score": {"$meta": "vectorSearchScore"}}},
    ]
    results: list[dict] = []
    async for doc in contacts_col.aggregate(pipeline):
        results.append(doc)
    return results


async def _manual_cosine_search(contacts_col, owner_user_id: str, embedding: list[float]):
    """Brute-force fallback when the Atlas vector index is missing."""
    best: dict | None = None
    best_score = 0.0

    async for doc in contacts_col.find({"owner_user_id": owner_user_id}):
        for face in doc.get("face_embeddings", []):
            stored = face.get("embedding")
            if not stored:
                continue
            score = _cosine(embedding, stored)
            if score > best_score:
                best_score = score
                best = doc

    if best is None:
        return [], 0.0
    annotated = dict(best)
    annotated["search_score"] = best_score
    return [annotated], best_score


@router.post("/recognize")
async def recognize_face(req: RecognizeRequest):
    if not is_connected():
        raise HTTPException(status_code=503, detail="Database unavailable")

    started = time.perf_counter()
    embedding = get_embedding(req.image_base64)
    if embedding is None:
        return RecognizeNoMatchResponse(confidence=0.0)

    contacts_col = get_contacts_collection()

    used = "vector_index"
    try:
        results = await _atlas_vector_search(contacts_col, req.user_id, embedding)
        score = results[0]["search_score"] if results else 0.0
    except OperationFailure as exc:
        print(f"[recognize] vector search unavailable, falling back to cosine: {exc}")
        results, score = await _manual_cosine_search(
            contacts_col, req.user_id, embedding
        )
        used = "manual_cosine"
    except Exception as exc:  # pragma: no cover
        print(f"[recognize] unexpected vector search error: {exc}")
        results, score = await _manual_cosine_search(
            contacts_col, req.user_id, embedding
        )
        used = "manual_cosine"

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(
        f"[recognize] owner={req.user_id[:8]}… method={used} "
        f"score={score:.3f} candidates={len(results)} {elapsed_ms}ms"
    )

    if not results or score < CONFIDENCE_LOW:
        return RecognizeNoMatchResponse(confidence=score)

    match = results[0]
    contact_id = str(match["_id"])

    debts_col = get_debts_collection()
    pending_debts: list[PendingDebt] = []
    total_outstanding = 0.0
    async for debt in debts_col.find(
        {
            "to_contact_id": contact_id,
            "from_user_id": req.user_id,
            "status": "pending",
        }
    ):
        pending_debts.append(
            PendingDebt(
                debt_id=str(debt["_id"]),
                amount_usd=debt["amount_usd"],
                due_date=debt.get("due_date", ""),
            )
        )
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

    return RecognizeMatchResponse(
        confidence=score,
        requires_confirmation=score < CONFIDENCE_HIGH,
        contact=contact,
    )
