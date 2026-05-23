from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017/cipher"
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""
    coingecko_api_url: str = "https://api.coingecko.com/api/v3"
    insightface_model: str = "buffalo_l"
    port: int = 8000

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
