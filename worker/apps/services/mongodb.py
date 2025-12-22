# Standard library imports
from typing import Any, Dict, List, Optional

# Third-party imports
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# Local/project imports
from core.config import settings


# ---------------------------------------------------------------------
class MongoDBService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            self.client = None
            self.db = None
            self.files_collection = None
            self._initialized = True

    async def _ensure_connection(self):
        """Lazy initialization of MongoDB connection"""
        if self.client is None:
            self.client = AsyncIOMotorClient(settings.mongo_uri)
            self.db = self.client[settings.mongo_db_name]
            self.files_collection = self.db.get_collection("files")

    async def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file information from MongoDB"""
        await self._ensure_connection()
        try:
            file_info = await self.files_collection.find_one({"_id": ObjectId(file_id)})
            if file_info:
                # Convert ObjectId to string if needed
                if "_id" in file_info:
                    file_info["_id"] = str(file_info["_id"])
                return file_info
            return None
        except Exception as e:
            print(f"Error fetching file info: {e}")
            return None


    async def save_image_info(self, image_data: Dict[str, Any]) -> bool:
        """Save image information to MongoDB"""
        await self._ensure_connection()
        try:
            # Direct MongoDB insertion
            await self.db.images.insert_one(image_data)
            print(f"Saved image: file_path={image_data.get('file_path')}")
            return True
        except Exception as e:
            print(f"Error saving image info: {e}")
            print(f"Image data: {image_data}")
            return False

    async def get_images_by_file_path(self, file_path: str) -> List[Any]:
        """Get all images associated with a file path"""
        await self._ensure_connection()
        try:
            # Direct MongoDB query
            cursor = self.db.images.find({"file_path": file_path})
            images = []
            async for doc in cursor:
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
                images.append(doc)
            print(f"Found {len(images)} images for file_path: {file_path}")
            return images
        except Exception as e:
            print(f"Error fetching images: {e}")
            return []

    async def delete_images_by_file_path(self, file_path: str) -> int:
        """Delete all images associated with a file path (returns count of deleted images)"""
        await self._ensure_connection()
        try:
            # Direct MongoDB deletion
            result = await self.db.images.delete_many({"file_path": file_path})
            print(f"Deleted {result.deleted_count} images for file_path: {file_path}")
            return result.deleted_count
        except Exception as e:
            print(f"Error deleting images: {e}")
            return 0

    
# Singleton instance
mongodb_service = MongoDBService()