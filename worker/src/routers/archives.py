from fastapi import APIRouter, HTTPException, BackgroundTasks
from colorama import Fore, Style
from loguru import logger

from src.schemas.archive import ArchiveProcessRequest, ArchiveProcessResponse
from src.services.archive_service import archive_service

router = APIRouter(
    prefix="/archives",
    tags=["archives"]
)


@router.post("/process", response_model=ArchiveProcessResponse)
async def process_archive(
    request: ArchiveProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    Process an archive file asynchronously.

    This endpoint:
    1. Extracts files from the archive
    2. Processes each extracted file individually
    3. Uploads processed content to Weaviate
    """
    try:
        logger.info(f"{Fore.BLUE}📋 Received archive processing request: {request.filename}{Style.RESET_ALL}")

        # Process the archive
        result = await archive_service.process_archive(request)

        if result.failed_files > 0 and result.processed_files == 0:
            logger.error(f"{Fore.RED}❌ Archive processing failed completely{Style.RESET_ALL}")
            raise HTTPException(status_code=400, detail=result.message)
        elif result.failed_files > 0:
            logger.warning(f"{Fore.YELLOW}⚠️ Archive processed with {result.failed_files} failures{Style.RESET_ALL}")
        else:
            logger.success(f"{Fore.GREEN}✅ Archive processing completed successfully{Style.RESET_ALL}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"{Fore.RED}❌ Unexpected error processing archive: {e}{Style.RESET_ALL}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{archive_id}")
async def get_archive_status(archive_id: str):
    """
    Get the processing status of an archive.

    Note: This is a placeholder. In a real implementation, you would
    track job status in a database or cache like Redis.
    """
    # This would typically query a job status store
    # For now, return a simple response
    return {
        "archive_id": archive_id,
        "status": "unknown",
        "message": "Status tracking not implemented. Use job queues for status tracking."
    }