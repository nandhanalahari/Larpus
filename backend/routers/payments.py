from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta
from models.schemas import ExecutePaymentRequest
from services.price_service import get_sol_price
from database import get_debts_collection, get_transactions_collection
from bson import ObjectId

router = APIRouter()


@router.post("/payments/execute")
async def execute_payment(req: ExecutePaymentRequest):
    price_data = await get_sol_price()
    sol_price = price_data["sol_usd"]
    amount_sol = req.amount_usd / sol_price

    now = datetime.now(timezone.utc)
    debts_col = get_debts_collection()
    tx_col = get_transactions_collection()

    debt_doc = {
        "from_user_id": req.user_id,
        "to_contact_id": req.contact_id,
        "amount_usd": req.amount_usd,
        "amount_sol": amount_sol,
        "sol_price_at_payment": sol_price,
        "status": "paid",
        "created_at": now.isoformat(),
        "paid_at": now.isoformat(),
    }
    debt_result = await debts_col.insert_one(debt_doc)
    debt_id = str(debt_result.inserted_id)

    tx_sig = f"devnet_{ObjectId()}"

    tx_doc = {
        "debt_id": debt_id,
        "from_wallet": req.from_wallet,
        "to_wallet": req.to_wallet,
        "amount_sol": amount_sol,
        "amount_usd": req.amount_usd,
        "sol_price": sol_price,
        "solana_signature": tx_sig,
        "status": "confirmed",
        "created_at": now.isoformat(),
        "confirmed_at": now.isoformat(),
    }
    await tx_col.insert_one(tx_doc)

    return {
        "status": "paid",
        "transaction_signature": tx_sig,
        "amount_sol": round(amount_sol, 6),
        "sol_price": sol_price,
        "confirmed_at": now.isoformat(),
        "elevenlabs_line": "paid_confirmation",
        "debt_id": debt_id,
    }
