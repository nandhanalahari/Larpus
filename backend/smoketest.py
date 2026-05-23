"""Cleanup helper: removes E2E/smoke rows from transactions + ledger."""

import asyncio
from dotenv import load_dotenv

load_dotenv()

from database import connect_db, get_ledger_collection, get_transactions_collection


async def main():
    await connect_db()
    pattern = {"$regex": "^(SMOKETEST_|E2ETEST_|E2EFLOW_|DEMO)"}
    tx_res = await get_transactions_collection().delete_many({"signature": pattern})
    ledger_res = await get_ledger_collection().delete_many({"signature": pattern})
    print(f"cleaned tx={tx_res.deleted_count} ledger={ledger_res.deleted_count}")


asyncio.run(main())
