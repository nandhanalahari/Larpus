import time
import httpx
from config import get_settings

_cache: dict = {"price": None, "fetched_at": 0}
CACHE_TTL = 30  # seconds


async def get_sol_price() -> dict:
    now = time.time()
    if _cache["price"] and (now - _cache["fetched_at"]) < CACHE_TTL:
        return {
            "sol_usd": _cache["price"],
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(_cache["fetched_at"])),
            "source": "coingecko",
        }

    settings = get_settings()
    url = f"{settings.coingecko_api_url}/simple/price?ids=solana&vs_currencies=usd"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            price = data["solana"]["usd"]
            _cache["price"] = price
            _cache["fetched_at"] = now
            return {
                "sol_usd": price,
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
                "source": "coingecko",
            }
    except Exception as e:
        print(f"[PriceService] Error: {e}")
        if _cache["price"]:
            return {
                "sol_usd": _cache["price"],
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(_cache["fetched_at"])),
                "source": "coingecko_cached",
            }
        raise
