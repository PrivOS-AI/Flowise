from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any
from colorama import Fore, Style
from loguru import logger

from src.schemas.file import FileProcessRequest, FileProcessResponse, FileDeleteRequest, FileDeleteResponse
from src.services.file_service import file_service
from src.services.delete_service import delete_service

router = APIRouter(
    prefix="/files",
    tags=["files"]
)


@router.post("/process", response_model=FileProcessResponse)
async def process_file(
    request: FileProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    Process a file asynchronously.

    This endpoint:
    1. Downloads the file from the provided URL
    2. Extracts text using Docling
    3. Creates chunks and uploads to Weaviate
    """
    try:
        logger.info(f"{Fore.BLUE}📋 Received file processing request: {request.filename}{Style.RESET_ALL}")

        # Process the file
        result = await file_service.process_file(request)

        if result.status == "skipped":
            logger.info(f"{Fore.YELLOW}⏩ File processing skipped: {result.message}{Style.RESET_ALL}")
        elif result.status == "failed":
            logger.error(f"{Fore.RED}❌ File processing failed: {result.message}{Style.RESET_ALL}")
            raise HTTPException(status_code=400, detail=result.message)
        else:
            logger.success(f"{Fore.GREEN}✅ File processing completed successfully{Style.RESET_ALL}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"{Fore.RED}❌ Unexpected error processing file: {e}{Style.RESET_ALL}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete", response_model=FileDeleteResponse)
async def delete_file(request: FileDeleteRequest):
    """
    Delete a file from Weaviate and MongoDB.

    This endpoint:
    1. Deletes documents from Weaviate
    2. Deletes associated image records from MongoDB
    """
    try:
        logger.info(f"{Fore.BLUE}📋 Received file deletion request: {request.file_id}{Style.RESET_ALL}")

        # Add 'vs_' prefix to collection name if needed
        collection_name = request.collection_name
        if collection_name != "Document" and not collection_name.startswith("vs_"):
            collection_name = f"vs_{collection_name}"

        # Delete the file
        result = await delete_service.delete_file(
            file_id=request.file_id,
            file_path=request.file_path,
            collection_name=collection_name
        )

        if result.status == "skipped":
            logger.info(f"{Fore.YELLOW}⏩ File deletion skipped: {result.message}{Style.RESET_ALL}")
        elif result.status == "failed":
            logger.error(f"{Fore.RED}❌ File deletion failed: {result.message}{Style.RESET_ALL}")
            raise HTTPException(status_code=400, detail=result.message)
        else:
            logger.success(f"{Fore.GREEN}✅ File deletion completed successfully{Style.RESET_ALL}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"{Fore.RED}❌ Unexpected error deleting file: {e}{Style.RESET_ALL}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{file_id}")
async def get_file_status(file_id: str):
    """
    Get the processing status of a file.

    Note: This is a placeholder. In a real implementation, you would
    track job status in a database or cache like Redis.
    """
    # This would typically query a job status store
    # For now, return a simple response
    return {
        "file_id": file_id,
        "status": "unknown",
        "message": "Status tracking not implemented. Use job queues for status tracking."
    }