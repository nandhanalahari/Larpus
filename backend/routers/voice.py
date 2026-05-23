from fastapi import APIRouter
from models.schemas import VoiceParseRequest
from services.gemini_service import parse_payment_intent

router = APIRouter()


@router.post("/voice/parse")
async def parse_voice(req: VoiceParseRequest):
    result = await parse_payment_intent(req.transcript)
    return result
