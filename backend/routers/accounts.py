from fastapi import APIRouter

from models.schemas import WalletAccountRequest, WalletBalanceResponse
from services.accounts import ensure_wallet_account, get_wallet_balance

router = APIRouter()


@router.post("/wallets", response_model=WalletBalanceResponse)
async def create_or_get_wallet(body: WalletAccountRequest):
    account = await ensure_wallet_account(body.wallet, body.name)
    return WalletBalanceResponse(
        wallet=body.wallet,
        balance_sol=float(account.get("balance_sol", 0.0)),
        starting_balance_usd=float(account.get("starting_balance_usd", 1000.0)),
        starting_sol_price=account.get("starting_sol_price"),
    )


@router.get("/wallets/{wallet_address}/balance", response_model=WalletBalanceResponse)
async def wallet_balance(wallet_address: str):
    return WalletBalanceResponse(**await get_wallet_balance(wallet_address))
