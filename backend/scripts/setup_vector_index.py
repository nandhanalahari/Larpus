"""One-shot script: create the Atlas Vector Search index on cipher.contacts.

Run from the backend/ directory:

    python -m scripts.setup_vector_index

Safe to re-run — it no-ops if the index already exists.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running as `python scripts/setup_vector_index.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from database import connect_db, close_db, is_connected  # noqa: E402
from services.vector_index import (  # noqa: E402
    ensure_vector_index,
    vector_index_status,
)


async def main() -> int:
    print("[setup] connecting to MongoDB…")
    await connect_db()
    if not is_connected():
        print("[setup] FAILED: could not reach MongoDB. Check MONGODB_URI in backend/.env")
        return 2

    print("[setup] ensuring vector_index on cipher.contacts…")
    result = await ensure_vector_index()
    print(f"[setup] result: {result}")

    print("[setup] current status:")
    print(f"[setup] {await vector_index_status()}")

    await close_db()
    if result.get("status") in {"created", "exists"}:
        print("[setup] OK")
        return 0
    print("[setup] non-fatal: index could not be confirmed")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
