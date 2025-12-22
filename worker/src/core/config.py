# Standard library imports
from typing import Optional

# Third-party imports
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings for FastAPI Queue Service"""

    # Application settings
    app_name: str = "File Processing Queue API"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000

    # Redis settings (required for BullMQ)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: Optional[str] = None

    # Queue settings
    queue_name: str = "file-processing"

    class Config:
        env_file = "/home/roxane/Flowise/worker/fastapi.env"
        extra = "ignore"


settings = Settings()
