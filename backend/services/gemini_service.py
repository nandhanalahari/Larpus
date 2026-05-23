import json
import re
from config import get_settings

_model = None


def load_gemini():
    global _model
    settings = get_settings()
    if not settings.gemini_api_key:
        print("[Gemini] No API key configured -- voice parsing disabled")
        return

    import google.generativeai as genai
    genai.configure(api_key=settings.gemini_api_key)
    _model = genai.GenerativeModel("gemini-1.5-flash")
    print("[Gemini] Model ready")


SYSTEM_PROMPT = """You are a payment intent parser. Given a voice transcript, extract the payment amount in USD.

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If you can extract a clear numeric amount, return: {"intent": "pay", "amount_usd": <number>, "confidence": <0-1>}
- Handle colloquial amounts: "a twenty" = 20, "a score" = 20, "a grand" = 1000, "a buck" = 1, "five bucks" = 5
- Handle spelled-out numbers: "twenty dollars" = 20, "thirty-five" = 35
- If the amount is ambiguous or you cannot determine it, return: {"intent": "unclear", "confidence": 0.0}
- Amount must be positive. Zero or negative = unclear.
- If transcript is empty or gibberish, return unclear.
- Do NOT guess. Only return "pay" when you are confident about the amount."""


async def parse_payment_intent(transcript: str) -> dict:
    if _model is None:
        return _fallback_parse(transcript)

    try:
        response = _model.generate_content(
            f"{SYSTEM_PROMPT}\n\nTranscript: \"{transcript}\""
        )
        text = response.text.strip()
        text = text.strip("`").strip()
        if text.startswith("json"):
            text = text[4:].strip()
        result = json.loads(text)
        if result.get("intent") == "pay":
            result["raw_transcript"] = transcript
        return result
    except Exception as e:
        print(f"[Gemini] Parse error: {e}")
        return _fallback_parse(transcript)


def _fallback_parse(transcript: str) -> dict:
    """Simple regex fallback when Gemini is unavailable."""
    numbers = re.findall(r'\d+\.?\d*', transcript)
    if numbers:
        amount = float(numbers[0])
        if amount > 0:
            return {
                "intent": "pay",
                "amount_usd": amount,
                "confidence": 0.7,
                "raw_transcript": transcript,
            }
    return {"intent": "unclear", "confidence": 0.0, "fallback": "keypad"}
