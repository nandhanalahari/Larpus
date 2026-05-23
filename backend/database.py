import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi
from config import get_settings

_client: AsyncIOMotorClient | None = None
_db = None
_connected = False


async def connect_db():
    global _client, _db, _connected
    settings = get_settings()
    _client = AsyncIOMotorClient(
        settings.mongodb_uri,
        server_api=ServerApi("1"),
        maxPoolSize=20,
        retryWrites=True,
        tls=True,
        tlsCAFile=certifi.where(),
        tlsAllowInvalidCertificates=True,
        serverSelectionTimeoutMS=10000,
    )
    _db = _client.cipher

    try:
        await _client.admin.command("ping")
        _connected = True
        print("[MongoDB] Connected to Atlas")
        await _ensure_indexes()
    except Exception as e:
        _connected = False
        print(f"[MongoDB] WARNING: Could not connect -- {e}")
        print("[MongoDB] Server starting without DB. Endpoints requiring DB will return 503.")


async def close_db():
    global _client
    if _client:
        _client.close()
        print("[MongoDB] Connection closed")


async def _ensure_indexes():
    users = _db.users
    await users.create_index("wallet_address", unique=True, sparse=True)
    await users.create_index("solana_wallet_address", unique=True, sparse=True)

    contacts = _db.contacts
    await contacts.create_index("owner_user_id")
    await contacts.create_index("solana_wallet_address", sparse=True)

    debts = _db.debts
    await debts.create_index("from_user_id")
    await debts.create_index("to_contact_id")
    await debts.create_index("status")

    transactions = _db.transactions
    await transactions.create_index("debt_id")
    await transactions.create_index("signature", unique=True, sparse=True)
    await transactions.create_index("transaction_id", unique=True, sparse=True)
    await transactions.create_index("from_wallet")
    await transactions.create_index("to_wallet")
    await transactions.create_index("status")
    await transactions.create_index([("block_time", -1)])

    # Double-entry ledger: one row per (signature, wallet) so each side of a
    # transfer is queryable directly by wallet -> direction.
    ledger = _db.ledger
    await ledger.create_index(
        [("signature", 1), ("wallet", 1)], unique=True, name="sig_wallet_unique"
    )
    await ledger.create_index([("wallet", 1), ("block_time", -1)])
    await ledger.create_index([("wallet", 1), ("direction", 1), ("block_time", -1)])


def is_connected() -> bool:
    return _connected


def get_db():
    return _db


def get_contacts_collection():
    return _db.contacts


def get_users_collection():
    return _db.users


def get_debts_collection():
    return _db.debts


def get_transactions_collection():
    return _db.transactions


def get_ledger_collection():
    return _db.ledger
