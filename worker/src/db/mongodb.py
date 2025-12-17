from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from src.core.config import settings
from typing import List
import logging

logger = logging.getLogger(__name__)

# MongoDB client instance
client: AsyncIOMotorClient = None
database = None


async def connect_to_mongo():
    """Create database connection"""
    global client, database

    try:
        client = AsyncIOMotorClient(settings.mongo_uri)
        database = client[settings.mongo_db_name]
        logger.info(f"Connected to MongoDB: {settings.mongo_db_name}")
        return database
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """Close database connection"""
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


async def init_beanie_models(models: List):
    """Initialize Beanie with the given models"""
    try:
        await init_beanie(database=database, document_models=models)
        logger.info(f"Initialized Beanie with {len(models)} models")
    except Exception as e:
        logger.error(f"Failed to initialize Beanie: {e}")
        raise


async def get_database():
    """Get database instance"""
    if not database:
        await connect_to_mongo()
    return database