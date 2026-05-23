"""Seed demo transactions into the transactions collection.

Inserts ~10 realistic-looking history rows between enrolled contacts, with a
mix of with/without notes. Idempotent — every record has a synthetic
signature prefixed with `DEMO_` so re-running upserts cleanly. To wipe just
the demo rows: db.transactions.delete_many({"source": "demo_seed"}).

Usage:
    cd /root/Larpus/backend
    source venv/bin/activate
    python seed_history.py            # insert/refresh demo data
    python seed_history.py --clear    # remove all demo rows
"""

from __future__ import annotations

import argparse
import asyncio
import os
import secrets
import sys
import time
from typing import Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from motor.motor_asyncio import AsyncIOMotorClient


# (from_name, to_name, amount_sol, hours_ago, notes)
# Notes are optional — leave as None to demonstrate the no-note rendering.
SEED_SCRIPT: list[tuple[str, str, float, float, Optional[str]]] = [
    ("Nandhan Alahari", "Lokesh",         0.34,   1.5,  "Uber back from CodeRunners"),
    ("Lokesh",          "Arpit Khavate",  0.12,   3.2,  None),
    ("Arpit Khavate",   "Fawaz",          0.85,   6.0,  "Hackathon snacks at HEB"),
    ("Fawaz",           "Nandhan Alahari", 1.20,  12.0, "Split team dinner"),
    ("Nandhan Alahari", "Arpit Khavate",  0.07,   18.0, None),
    ("Lokesh",          "Fawaz",          0.50,   26.0, "Bobaaa"),
    ("Arpit Khavate",   "Lokesh",         0.18,   34.0, "for the AWS credits resale"),
    ("Fawaz",           "Lokesh",         0.04,   48.0, None),
    ("Nandhan Alahari", "Fawaz",          0.65,   60.0, "Gas to HCC"),
    ("Lokesh",          "Nandhan Alahari", 0.22,  84.0, "Splitting the Lyft"),
]


def fake_signature() -> str:
    """88-char base58-ish string prefixed with DEMO_ so it's identifiable."""
    # Real Solana sigs are 64 bytes base58-encoded (~88 chars). DEMO_ prefix
    # makes seeded data obvious in MongoDB and prevents collisions with real syncs.
    return "DEMO_" + secrets.token_urlsafe(58).replace("_", "x").replace("-", "y")[:80]


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true", help="Delete demo rows then exit")
    args = parser.parse_args()

    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("ERROR: MONGODB_URI not set", file=sys.stderr)
        return 1

    client = AsyncIOMotorClient(uri)
    db = client.get_database("cipher")
    txs = db.transactions
    contacts = db.contacts

    if args.clear:
        res = await txs.delete_many({"source": "demo_seed"})
        print(f"[clear] deleted {res.deleted_count} demo rows")
        return 0

    # Resolve names -> wallets from MongoDB so the seed matches whoever's actually enrolled.
    name_to_wallet: dict[str, str] = {}
    async for c in contacts.find({}, {"name": 1, "solana_wallet_address": 1}):
        w = c.get("solana_wallet_address")
        n = c.get("name")
        if w and n:
            name_to_wallet[n] = w

    if not name_to_wallet:
        print("ERROR: no enrolled contacts found in DB — nothing to seed against", file=sys.stderr)
        return 1

    print(f"[seed] resolved {len(name_to_wallet)} enrolled wallets:")
    for n, w in name_to_wallet.items():
        print(f"  {n} -> {w[:16]}...")

    now = int(time.time())
    # Devnet slot rate is ~2.5 slots/sec; use that to derive plausible slots from time.
    SLOTS_PER_SECOND = 2.5
    current_slot = 460_000_000

    inserted = 0
    skipped = 0
    for from_name, to_name, amount_sol, hours_ago, notes in SEED_SCRIPT:
        from_w = name_to_wallet.get(from_name)
        to_w = name_to_wallet.get(to_name)
        if not from_w or not to_w:
            print(f"[skip] {from_name} -> {to_name} (missing enrolled wallet)")
            skipped += 1
            continue

        seconds_ago = int(hours_ago * 3600)
        block_time = now - seconds_ago
        slot = current_slot - int(seconds_ago * SLOTS_PER_SECOND)

        doc = {
            "signature": fake_signature(),
            "slot": slot,
            "block_time": block_time,
            "from_wallet": from_w,
            "to_wallet": to_w,
            "amount_lamports": int(amount_sol * 1_000_000_000),
            "amount_sol": amount_sol,
            "cluster": "devnet",
            "status": "confirmed",
            "cached_at": now,
            "notes": notes,
            "source": "demo_seed",
        }
        await txs.insert_one(doc)
        marker = f"  ({notes!r})" if notes else "  (no note)"
        print(f"[ok] {from_name} -> {to_name}  {amount_sol} SOL  {hours_ago:.1f}h ago{marker}")
        inserted += 1

    print(f"\nDone. inserted={inserted} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
