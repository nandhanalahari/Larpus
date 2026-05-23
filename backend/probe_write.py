"""One-shot probe: write a tagged row to cipher.transactions + cipher.ledger
so you can see it in Atlas UI. Run from backend/ with the venv activated.
"""

import asyncio
import time
from dotenv import load_dotenv

load_dotenv()

from database import (
    connect_db,
    get_ledger_collection,
    get_transactions_collection,
    is_connected,
)
from services.solana_history import record_confirmed_transfer


async def main():
    await connect_db()
    print(f"[probe] mongo connected = {is_connected()}")

    sig = f"CURSOR_PROBE_{int(time.time())}"
    print(f"[probe] writing signature = {sig}")

    await record_confirmed_transfer(
        signature=sig,
        from_wallet="ProbeWalletAAAA_sender",
        to_wallet="ProbeWalletBBBB_receiver",
        amount_sol=1.2345,
        amount_usd=185.42,
        sender_display_name="Cursor Probe",
    )

    tx = await get_transactions_collection().find_one({"signature": sig})
    ledger = await get_ledger_collection().find({"signature": sig}).to_list(length=10)

    print()
    print(f"[probe] cipher.transactions  -> {1 if tx else 0} row")
    if tx:
        print(
            f"        signature={tx['signature']}  "
            f"from={tx['from_wallet']}  to={tx['to_wallet']}  "
            f"amount_sol={tx['amount_sol']}"
        )
    print(f"[probe] cipher.ledger        -> {len(ledger)} rows")
    for r in ledger:
        print(
            f"        wallet={r['wallet']:38s}  direction={r['direction']:8s}  "
            f"counterparty={r.get('counterparty_wallet')}"
        )

    print()
    print(f"[probe] Look in Atlas for signature: {sig}")


asyncio.run(main())
