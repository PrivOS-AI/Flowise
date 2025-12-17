import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from colorama import Fore, Style, init

from src.core.config import settings
from src.api.v1.router import api_router
from src.services.bullmq_producer import bullmq_producer

# Initialize colorama
init()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    print(f"{Fore.CYAN}🚀 Starting {settings.app_name} v{settings.app_version}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}✓ Connected to Redis: {settings.redis_host}:{settings.redis_port}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}✓ Queue: {settings.queue_name}{Style.RESET_ALL}")

    yield

    # Shutdown
    print(f"{Fore.YELLOW}🛑 Shutting down {settings.app_name}{Style.RESET_ALL}")
    await bullmq_producer.close()


def create_application() -> FastAPI:
    """Create FastAPI application"""

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="File Processing Queue API Service (BullMQ Producer)",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Global exception: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    # Include API router
    app.include_router(api_router, prefix="/api/v1")

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": settings.app_name}

    return app


app = create_application()


if __name__ == "__main__":
    # Print startup banner
    print(f"""
{Fore.CYAN}████████████████████████████████████████████████████████████
█                FILE PROCESSING QUEUE API                       █
█                  (BullMQ Producer Service)                   █
████████████████████████████████████████████████████████████

{Fore.YELLOW}═ Configuration:{Style.RESET_ALL}
  ├─ Host: {settings.host}:{settings.port}
  ├─ Redis: {settings.redis_host}:{settings.redis_port}
  ├─ Queue: {settings.queue_name}
  └─ Debug: {settings.debug}
""")

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )