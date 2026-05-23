import json
import re
import datetime
from config import get_settings

_client = None
_model_name = "gemini-2.5-flash"


def load_gemini():
    global _client
    settings = get_settings()
    if not settings.gemini_api_key:
        print("[Gemini] No API key configured -- voice parsing disabled")
        return

    from google import genai
    _client = genai.Client(api_key=settings.gemini_api_key)
    print(f"[Gemini] Client ready ({_model_name})")


SYSTEM_PROMPT = """You are a payment intent parser. Given a voice transcript, extract the payment amount in USD, the recipient's name, any specified due date, and a short note describing what the payment is for.

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If you can extract a clear numeric amount, return:
  {{"intent": "pay", "amount_usd": <number>, "recipient_name": "<name_or_null>", "due_date": "<YYYY-MM-DD_or_null>", "note": "<note_or_null>", "confidence": <0-1>}}
  - If a recipient's name (e.g. "Marcus", "John", "Sarah", "mom") is mentioned, extract it as "recipient_name". Pronouns ("him", "her", "them", "this person", "he", "she", "they") are NOT names — set recipient_name to null for those. Otherwise null.
  - If a due date or schedule date is mentioned (e.g. "by next Monday", "tomorrow", "on Friday", "by June 1st"), calculate the corresponding YYYY-MM-DD date based on today's date and set it for "due_date". Otherwise null.
  - If a reason or purpose for the payment is mentioned (e.g. "for food", "for the game", "for gas", "dinner last night", "rent", "for concert tickets"), extract a short 1-3 word label as "note" (e.g. "food", "game tickets", "gas", "dinner", "rent"). Otherwise null.
  - Assume the current date is: {current_date_info}
- Handle colloquial amounts: "a twenty" = 20, "a score" = 20, "a grand" = 1000, "a buck" = 1, "five bucks" = 5
- Handle spelled-out numbers: "twenty dollars" = 20, "thirty-five" = 35
- If the amount is ambiguous or you cannot determine it, return: {{"intent": "unclear", "recipient_name": null, "due_date": null, "note": null, "confidence": 0.0}}
- Amount must be positive. Zero or negative = unclear.
- If transcript is empty or gibberish, return unclear.
- Do NOT guess. Only return "pay" when you are confident about the amount."""


async def parse_payment_intent(transcript: str) -> dict:
    if _client is None:
        return _fallback_parse(transcript)

    try:
        date_str = datetime.datetime.now().strftime("%A, %B %d, %Y")
        formatted_prompt = SYSTEM_PROMPT.format(current_date_info=date_str)

        response = _client.models.generate_content(
            model=_model_name,
            contents=f"{formatted_prompt}\n\nTranscript: \"{transcript}\"",
        )

        raw_text = response.text or ""

        # Extract the JSON object regardless of surrounding markdown/text.
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON in Gemini response: {raw_text[:200]!r}")
        result = json.loads(json_match.group(0))

        if result.get("intent") == "pay":
            result["raw_transcript"] = transcript
        print(f"[Gemini] intent={result.get('intent')} amount={result.get('amount_usd')} note={result.get('note')!r}")
        return result
    except Exception as e:
        print(f"[Gemini] Parse error: {e}")
        return _fallback_parse(transcript)


_WORD_NUMBERS = {
    "a buck": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "a score": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "a hundred": 100, "hundred": 100, "a grand": 1000, "grand": 1000,
}

def _fallback_parse(transcript: str) -> dict:
    """Regex + word-number fallback when Gemini is unavailable or errors."""
    lower = transcript.lower()

    # Try digit amounts first (e.g. "$20", "20 dollars")
    digit_match = re.search(r'\$?\s*(\d+(?:\.\d+)?)', lower)
    if digit_match:
        amount = float(digit_match.group(1))
        if amount > 0:
            return {
                "intent": "pay",
                "amount_usd": amount,
                "confidence": 0.7,
                "recipient_name": None,
                "due_date": None,
                "note": None,
                "raw_transcript": transcript,
            }

    # Try spoken numbers (e.g. "five dollars", "twenty bucks")
    for word, value in sorted(_WORD_NUMBERS.items(), key=lambda x: -len(x[0])):
        if word in lower:
            return {
                "intent": "pay",
                "amount_usd": float(value),
                "confidence": 0.6,
                "recipient_name": None,
                "due_date": None,
                "note": None,
                "raw_transcript": transcript,
            }

    return {
        "intent": "unclear",
        "confidence": 0.0,
        "recipient_name": None,
        "due_date": None,
        "note": None,
        "fallback": "keypad",
    }
