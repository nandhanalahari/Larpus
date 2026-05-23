"""Manage the Atlas Vector Search index on `contacts.face_embeddings.embedding`.

Atlas exposes `createSearchIndexes` as a database command on M10+ clusters
(and shared/serverless tiers since mid-2024). We use that so the app
provisions its own vector index — no Atlas UI clicks needed.

Note: index build is asynchronous (status goes through PENDING -> BUILDING
-> READY). Queries against a not-yet-READY index throw OperationFailure;
the recognize endpoint falls back to manual cosine until the index is ready.
"""

from __future__ import annotations

from pymongo.errors import OperationFailure

from database import get_db

INDEX_NAME = "vector_index"
COLLECTION = "contacts"
PATH = "face_embeddings.embedding"
NUM_DIMENSIONS = 512


async def ensure_vector_index() -> dict:
    """Create the vector index if it doesn't already exist.

    Returns a dict describing what happened so it can be logged on boot.
    """
    db = get_db()
    if db is None:
        return {"status": "skipped", "reason": "db not connected"}

    contacts = db[COLLECTION]

    try:
        existing = await contacts.list_search_indexes().to_list(length=None)
    except OperationFailure as exc:
        return {
            "status": "unsupported",
            "reason": f"list_search_indexes failed: {exc}",
            "hint": "Vector search requires Atlas M0+ (search-enabled). "
                    "Local mongod and self-hosted Mongo do not support this.",
        }
    except Exception as exc:  # pragma: no cover
        return {"status": "error", "reason": str(exc)}

    for idx in existing:
        if idx.get("name") == INDEX_NAME:
            return {
                "status": "exists",
                "ready": idx.get("queryable", False),
                "type": idx.get("type"),
            }

    definition = {
        "name": INDEX_NAME,
        "type": "vectorSearch",
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "path": PATH,
                    "numDimensions": NUM_DIMENSIONS,
                    "similarity": "cosine",
                },
                {"type": "filter", "path": "owner_user_id"},
            ]
        },
    }

    try:
        await db.command({"createSearchIndexes": COLLECTION, "indexes": [definition]})
    except OperationFailure as exc:
        return {
            "status": "error",
            "reason": f"createSearchIndexes failed: {exc.details if hasattr(exc, 'details') else exc}",
        }
    except Exception as exc:  # pragma: no cover
        return {"status": "error", "reason": str(exc)}

    return {
        "status": "created",
        "name": INDEX_NAME,
        "note": "Atlas builds vector indexes asynchronously (1-5 min). "
                "Until ready, /recognize falls back to manual cosine search.",
    }


async def vector_index_status() -> dict:
    """Return diagnostic info on the vector index for /health."""
    db = get_db()
    if db is None:
        return {"present": False, "reason": "db not connected"}

    try:
        existing = await db[COLLECTION].list_search_indexes().to_list(length=None)
    except OperationFailure as exc:
        return {"present": False, "reason": str(exc)}
    except Exception as exc:  # pragma: no cover
        return {"present": False, "reason": str(exc)}

    for idx in existing:
        if idx.get("name") == INDEX_NAME:
            return {
                "present": True,
                "name": INDEX_NAME,
                "ready": bool(idx.get("queryable", False)),
                "type": idx.get("type"),
                "status": idx.get("status"),
            }
    return {"present": False, "reason": "not created yet"}
