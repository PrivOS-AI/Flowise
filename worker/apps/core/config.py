import os

from pydantic import Field
from pydantic_settings import BaseSettings

# ------------------------------------------------------------


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # MongoDB settings
    mongo_uri: str = Field(default_factory=lambda: os.getenv("MONGO_URI"))
    mongo_db_name: str = Field(default_factory=lambda: os.getenv("MONGO_DB_NAME"))

    # Redis settings
    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST"))
    redis_port: int = Field(
        default_factory=lambda: int(os.getenv("REDIS_PORT") or 6379)
    )
    redis_password: str = Field(default_factory=lambda: os.getenv("REDIS_PASSWORD"))

    # Worker settings
    worker_concurrency: int = Field(
        default_factory=lambda: int(os.getenv("WORKER_CONCURRENCY", "10"))
    )

    # OpenAI settings for translation (using openai-agents SDK)
    llm_hub_api_key: str = os.getenv("LLM_HUB_API_KEY", "")

    weaviate_http_host: str = Field(default_factory=lambda: os.getenv("WEAVIATE_HTTP_HOST", "localhost"))
    weaviate_http_port: int = Field(
        default_factory=lambda: int(os.getenv("WEAVIATE_HTTP_PORT", "8080"))
    )
    weaviate_grpc_host: str = Field(default_factory=lambda: os.getenv("WEAVIATE_GRPC_HOST", "localhost"))
    weaviate_grpc_port: int = Field(
        default_factory=lambda: int(os.getenv("WEAVIATE_GRPC_PORT", "50051"))
    )
    weaviate_secure: bool = Field(
        default_factory=lambda: (os.getenv("WEAVIATE_HTTP_SECURE") or "false").lower()
        == "true",
        alias="WEAVIATE_SECURE",
    )
    weaviate_api_key: str = Field(default_factory=lambda: os.getenv("WEAVIATE_API_KEY", ""))

    @property
    def weaviate_url(self) -> str:
        """Construct the Weaviate URL from host and port"""
        protocol = "https" if self.weaviate_secure else "http"
        return f"{protocol}://{self.weaviate_http_host}:{self.weaviate_http_port}"

    # Ollama settings
    ollama_api_endpoint: str = Field(
        default_factory=lambda: os.getenv(
            "OLLAMA_API_ENDPOINT", "http://host.docker.internal:11434"
        )
    )
    ollama_api_key: str = Field(default_factory=lambda: os.getenv("OLLAMA_API_KEY", ""))

    # MinIO settings
    minio_endpoint: str = Field(default_factory=lambda: os.getenv("MINIO_ENDPOINT", "localhost:9000"))
    minio_access_key: str = Field(default_factory=lambda: os.getenv("MINIO_ACCESS_KEY", ""))
    minio_secret_key: str = Field(default_factory=lambda: os.getenv("MINIO_SECRET_KEY", ""))
    minio_bucket: str = Field(default_factory=lambda: os.getenv("MINIO_BUCKET", "privos"))
    minio_secure: bool = Field(
        default_factory=lambda: (os.getenv("MINIO_SECURE", "false")).lower() == "true"
    )

    class Config:
        env_file = "worker.env"
        extra = "ignore"
        # case_sensitive = False


settings = Settings()
