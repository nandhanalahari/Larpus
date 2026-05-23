from fastapi import APIRouter, HTTPException
from services.price_service import get_sol_price

router = APIRouter()


@router.get("/sol/price")
async def sol_price():
    try:
        return await get_sol_price()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Price unavailable: {e}")
