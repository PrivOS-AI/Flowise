from pydantic import Field
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""

    # Application settings
    app_name: str = "File Processing Queue Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8001  # Different port to avoid conflict with worker

    # Queue settings
    queue_name: str = "file-processing"

    # MongoDB settings
    mongo_uri: str = Field(default_factory=lambda: "")
    mongo_db_name: str = Field(default_factory=lambda: "")

    # Redis settings
    redis_host: str = Field(default_factory=lambda: "")
    redis_port: int = Field(default_factory=lambda: 6379)
    redis_password: Optional[str] = None

    # Weaviate settings
    weaviate_http_host: str = Field(default_factory=lambda: "localhost")
    weaviate_http_port: int = Field(default_factory=lambda: 8080)
    weaviate_grpc_host: str = Field(default_factory=lambda: "localhost")
    weaviate_grpc_port: int = Field(default_factory=lambda: 50051)
    weaviate_secure: bool = False
    weaviate_api_key: Optional[str] = None

    # MinIO settings
    minio_endpoint: str = Field(default_factory=lambda: "localhost:9000")
    minio_access_key: Optional[str] = None
    minio_secret_key: Optional[str] = None
    minio_bucket: str = Field(default_factory=lambda: "privos")
    minio_secure: bool = False

    # Worker settings
    worker_concurrency: int = Field(default_factory=lambda: 10)

    # OpenAI settings
    llm_hub_api_key: Optional[str] = None

    # Ollama settings
    ollama_api_endpoint: str = Field(
        default_factory=lambda: "http://host.docker.internal:11434"
    )
    ollama_api_key: Optional[str] = None

    @property
    def weaviate_url(self) -> str:
        """Construct the Weaviate URL from host and port"""
        protocol = "https" if self.weaviate_secure else "http"
        return f"{protocol}://{self.weaviate_http_host}:{self.weaviate_http_port}"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()