from colorama import Fore, Style
from loguru import logger
from typing import Optional

from src.services.mongodb_service import mongodb_service
from src.services.weaviate_service import weaviate_service


class DeleteService:
    """Service for deleting files from storage"""

    @staticmethod
    async def delete_file(
        file_id: str,
        file_path: str,
        collection_name: str
    ) -> dict:
        """
        Delete a file from Weaviate and MongoDB
        """
        logger.info(f"{Fore.BLUE}🗑️ Deleting file: {file_id}{Style.RESET_ALL}")

        try:
            # Check if file_path is provided
            if not file_path:
                logger.warning(f"{Fore.YELLOW}⚠️ No file_path provided{Style.RESET_ALL}")
                return {
                    "file_id": file_id,
                    "collection_name": collection_name,
                    "status": "skipped",
                    "deleted_images_count": 0,
                    "message": f"No file_path provided for file_id: {file_id}"
                }

            # Step 1: Delete from Weaviate
            logger.info(f"{Fore.CYAN}📊 Deleting from Weaviate collection: {collection_name}{Style.RESET_ALL}")
            delete_success = await weaviate_service.delete_by_file_path(
                file_path=file_path,
                collection_name=collection_name
            )

            if not delete_success:
                raise ValueError("Failed to delete documents from Weaviate")

            # Step 2: Get images count associated with this file
            logger.info(f"{Fore.CYAN}🖼️ Counting images associated with file...{Style.RESET_ALL}")
            images = await mongodb_service.get_images_by_file_path(file_path)
            deleted_images_count = len(images)

            # Step 3: Delete image records from MongoDB
            logger.info(f"{Fore.CYAN}🗑️ Deleting image records from MongoDB...{Style.RESET_ALL}")
            await mongodb_service.delete_images_by_file_path(file_path)

            logger.success(f"{Fore.GREEN}✅ File deleted successfully{Style.RESET_ALL}")

            return {
                "file_id": file_id,
                "file_path": file_path,
                "collection_name": collection_name,
                "status": "deleted",
                "deleted_images_count": deleted_images_count,
                "message": f"Successfully deleted all documents and {deleted_images_count} image records"
            }

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Error deleting file: {e}{Style.RESET_ALL}")
            return {
                "file_id": file_id,
                "file_path": file_path,
                "collection_name": collection_name,
                "status": "failed",
                "deleted_images_count": 0,
                "message": str(e)
            }


# Singleton instance
delete_service = DeleteService()