import asyncio
import sys

try:
    from colorama import Fore, Style, init

    init()
except ImportError:
    # Fallback if colorama is not installed
    class Fore:
        CYAN = ""
        YELLOW = ""
        GREEN = ""
        RED = ""
        RESET = ""
        MAGENTA = ""
        BLUE = ""

    class Style:
        RESET_ALL = ""

    def init():
        return None

    init()

from beanie import init_beanie
from core.config import settings
from models.file import File, Folder, ArchiveFile
from models.image import Image
from worker.bullmq_worker import create_worker
from motor.motor_asyncio import AsyncIOMotorClient
from services.mongodb import mongodb_service
# -------------------------------------------------------------------------
def print_banner():
    """Print startup banner"""
    print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════╗
║                     FILE PROCESSING QUEUE API            ║
║                      (BullMQ Producer worker)            ║
╚══════════════════════════════════════════════════════════╝

{Fore.YELLOW}=� Configuration:{Style.RESET_ALL}
  " Redis: {settings.redis_host}:{settings.redis_port}
  " MongoDB: {settings.mongo_uri.split("@")[-1] if "@" in settings.mongo_uri else settings.mongo_uri}
  " Worker Concurrency: {settings.worker_concurrency}
""")


async def init_database():
    """Initialize database connections"""
    print(f"{Fore.CYAN}🔌 Initializing database connections...{Style.RESET_ALL}")

    # Create a fresh client for Beanie
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]

    # Initialize Beanie with all models
    await init_beanie(
        database=db,
        document_models=[File, Folder, ArchiveFile, Image]
    )

    # Also update the mongodb_service to use the same database reference
    mongodb_service.db = db

    print(f"{Fore.GREEN}✓ Database initialized successfully{Style.RESET_ALL}")
    print(f"  - Models initialized: File, Folder, ArchiveFile, Image")


def main():
    """Main function"""
    print_banner()

    # Initialize database before starting worker
    asyncio.run(init_database())

    print(f"{Fore.GREEN}🚀 Starting worker mode...{Style.RESET_ALL}")
    worker = create_worker()
    worker.listen_to_bullmq()


if __name__ == "__main__":
    main()
