import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    def __init__(self) -> None:
        self.cors_origin: str = os.environ.get("CORS_ORIGIN") or "*"
        # ~14 MiB base64 ≈ 10 MiB raw
        self.max_b64_bytes: int = int(os.environ.get("MAX_B64_BYTES", str(50 * 1024 * 1024)))
        self.replicate_api_token: str | None = os.environ.get("REPLICATE_API_TOKEN")


_settings = Settings()


def get_settings() -> Settings:
    return _settings


