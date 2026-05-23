"""ElevenLabs Scribe (Speech-to-Text) wrapper.

Thin wrapper over the ElevenLabs STT REST API. Takes audio bytes, returns a
transcript string. Stateless. Errors are returned as None so callers can
distinguish "transcription failed" from "transcription succeeded but empty".
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from config import get_settings

log = logging.getLogger("inference.stt")

ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
DEFAULT_MODEL_ID = "scribe_v1"
REQUEST_TIMEOUT = 30.0


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.m4a",
    content_type: str = "audio/m4a",
    language_code: Optional[str] = None,
) -> Optional[str]:
    """Send audio bytes to ElevenLabs Scribe, return the transcript or None on failure."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        log.warning("ElevenLabs API key not configured — STT disabled")
        return None
    if not audio_bytes:
        log.warning("transcribe_audio called with empty audio")
        return None

    headers = {"xi-api-key": settings.elevenlabs_api_key}
    files = {"file": (filename, audio_bytes, content_type)}
    data: dict[str, str] = {"model_id": DEFAULT_MODEL_ID}
    if language_code:
        data["language_code"] = language_code

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                ELEVENLABS_STT_URL,
                headers=headers,
                files=files,
                data=data,
            )
    except httpx.HTTPError as e:
        log.error("STT request failed: %s", e)
        return None

    if resp.status_code != 200:
        log.error(
            "STT non-200: status=%d body=%s",
            resp.status_code,
            resp.text[:300],
        )
        return None

    try:
        payload = resp.json()
    except ValueError:
        log.error("STT response not JSON: %s", resp.text[:200])
        return None

    transcript = (payload.get("text") or "").strip()
    if not transcript:
        log.info("STT returned empty transcript")
    return transcript or None
