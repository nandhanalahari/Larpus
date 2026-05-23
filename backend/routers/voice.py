from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from typing import Optional

from models.schemas import VoiceParseRequest
from services.gemini_service import parse_payment_intent
from services.elevenlabs_stt import transcribe_audio

router = APIRouter()

MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15 MB — generous for ~10s of audio


@router.post("/voice/parse")
async def parse_voice(req: VoiceParseRequest):
    """Parse intent from a pre-transcribed string. Used when client already has text."""
    result = await parse_payment_intent(req.transcript)
    return result


@router.post("/voice/process")
async def process_voice(
    audio: UploadFile = File(...),
    contact_id: Optional[str] = Form(None),
    language_code: Optional[str] = Form(None),
):
    """One-shot: audio file → ElevenLabs Scribe → Gemini → parsed payment intent.

    Reduces the mobile network round-trips to a single multipart upload.
    Response shape matches /voice/parse plus a `raw_transcript` field.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="empty_audio")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio_too_large")

    transcript = await transcribe_audio(
        audio_bytes,
        filename=audio.filename or "audio.m4a",
        content_type=audio.content_type or "audio/m4a",
        language_code=language_code,
    )

    if not transcript:
        return {
            "intent": "unclear",
            "confidence": 0.0,
            "raw_transcript": "",
            "fallback": "keypad",
            "reason": "transcription_failed",
        }

    parsed = await parse_payment_intent(transcript)
    # Ensure raw_transcript is always present so the mobile can show what was heard.
    parsed.setdefault("raw_transcript", transcript)
    if contact_id:
        parsed["contact_id"] = contact_id
    return parsed
