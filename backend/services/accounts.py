from __future__ import annotations

from datetime import datetime, timezone

from database import get_users_collection
from services.price_service import get_sol_price

STARTING_BALANCE_USD = 1000.0


class InsufficientBalanceError(ValueError):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _initial_balance_sol() -> tuple[float, float]:
    price_data = await get_sol_price()
    sol_price = float(price_data["sol_usd"])
    if sol_price <= 0:
        raise ValueError("Invalid SOL price")
    return STARTING_BALANCE_USD / sol_price, sol_price


async def ensure_wallet_account(wallet: str, name: str | None = None) -> dict:
    """Return (or lazily create) a cipher.users account for this wallet.

    Every new wallet receives $1000 worth of SOL at the current live price.
    Subsequent calls are idempotent — the balance is only initialised once.
    """
    users = get_users_collection()
    existing = await users.find_one({"wallet_address": wallet})
    if existing:
        updates: dict = {"updated_at": _now_iso()}
        if name and existing.get("name") != name:
            updates["name"] = name
        await users.update_one({"wallet_address": wallet}, {"$set": updates})
        return await users.find_one({"wallet_address": wallet})

    balance_sol, sol_price = await _initial_balance_sol()
    now = _now_iso()
    doc = {
        "wallet_address": wallet,
        "solana_wallet_address": wallet,
        "name": name,
        "balance_sol": float(balance_sol),
        "starting_balance_usd": STARTING_BALANCE_USD,
        "starting_sol_price": sol_price,
        "created_at": now,
        "updated_at": now,
    }
    # $setOnInsert is atomic — concurrent requests for the same wallet only
    # create one document even if they race.
    await users.update_one(
        {"wallet_address": wallet},
        {"$setOnInsert": doc},
        upsert=True,
    )
    account = await users.find_one({"wallet_address": wallet})
    print(
        f"[cipher.users] NEW wallet granted "
        f"${STARTING_BALANCE_USD:.0f} starting balance -> "
        f"{balance_sol:.6f} SOL @ ${sol_price:.2f}  "
        f"wallet={wallet[:12]}..."
    )
    return account


async def get_wallet_balance(wallet: str) -> dict:
    account = await ensure_wallet_account(wallet)
    return {
        "wallet": wallet,
        "balance_sol": float(account.get("balance_sol", 0.0)),
        "starting_balance_usd": float(account.get("starting_balance_usd", STARTING_BALANCE_USD)),
        "starting_sol_price": account.get("starting_sol_price"),
    }


async def apply_transfer_balances(from_wallet: str, to_wallet: str, amount_sol: float) -> None:
    """Debit sender and credit receiver exactly once for a newly recorded transfer."""
    amount = float(amount_sol)
    if amount <= 0:
        raise ValueError("Transfer amount must be positive")

    users = get_users_collection()
    await ensure_wallet_account(from_wallet)
    await ensure_wallet_account(to_wallet)
    now = _now_iso()

    debit = await users.update_one(
        {"wallet_address": from_wallet, "balance_sol": {"$gte": amount}},
        {"$inc": {"balance_sol": -amount}, "$set": {"updated_at": now}},
    )
    if debit.modified_count != 1:
        account = await users.find_one({"wallet_address": from_wallet})
        balance = float(account.get("balance_sol", 0.0)) if account else 0.0
        raise InsufficientBalanceError(
            f"Insufficient balance: have {balance:.9f} SOL, need {amount:.9f} SOL"
        )

    await users.update_one(
        {"wallet_address": to_wallet},
        {"$inc": {"balance_sol": amount}, "$set": {"updated_at": now}},
    )
    print(
        f"[cipher.users] TRANSFER {amount:.6f} SOL  "
        f"{from_wallet[:12]}... -> {to_wallet[:12]}..."
    )
