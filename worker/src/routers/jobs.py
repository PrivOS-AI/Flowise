# Standard library imports
from typing import List, Optional

# Third-party imports
from colorama import Fore, Style
from fastapi import APIRouter, HTTPException, Query
from loguru import logger

# Local/project imports
from schemas.jobs import (ArchiveProcessJobRequest, DeleteFileJobRequest,
                          FileProcessJobRequest, JobResponse,
                          JobStatusResponse, QueueStatsResponse)
from services.bullmq_producer import bullmq_producer

router = APIRouter(prefix="/jobs", tags=["jobs"])


# region File Processing Jobs


@router.post("/process-file", response_model=JobResponse)
async def add_file_process_job(request: FileProcessJobRequest):
    """
    Add a file processing job to the BullMQ queue.

    This endpoint adds a job to process a file:
    1. Download the file from the provided URL
    2. Extract text using Docling
    3. Create chunks and upload to Weaviate

    The job will be processed by the BullMQ worker.
    """
    try:
        logger.info(
            f"{Fore.BLUE}📋 Received file processing job request: {request.filename}{Style.RESET_ALL}"
        )

        # Add job to queue
        result = await bullmq_producer.add_file_process_job(
            download_link=request.download_link,
            filename=request.filename,
            file_path=request.file_path,
            channel_id=request.channel_id,
            ttl=request.ttl,
        )

        logger.success(
            f"{Fore.GREEN}✅ File processing job added to queue: {result['job_id']}{Style.RESET_ALL}"
        )

        return result

    except Exception as e:
        logger.error(
            f"{Fore.RED}❌ Failed to add file processing job: {e}{Style.RESET_ALL}"
        )
        raise HTTPException(status_code=500, detail=str(e))


# endregion


# region Archive Processing Jobs


@router.post("/process-archive", response_model=JobResponse)
async def add_archive_process_job(request: ArchiveProcessJobRequest):
    """
    Add an archive processing job to the BullMQ queue.

    This endpoint adds a job to process an archive file:
    1. Extract files from the archive
    2. Process each extracted file individually
    3. Upload processed content to Weaviate

    The job will be processed by the BullMQ worker.
    """
    try:
        logger.info(
            f"{Fore.BLUE}📋 Received archive processing job request: {request.filename}{Style.RESET_ALL}"
        )

        # Add job to queue
        result = await bullmq_producer.add_archive_process_job(
            archive_id=request.archive_id,
            filename=request.filename,
            file_path=request.file_path,
            channel_id=request.channel_id,
            ttl=request.ttl,
        )

        logger.success(
            f"{Fore.GREEN}✅ Archive processing job added to queue: {result['job_id']}{Style.RESET_ALL}"
        )

        return result

    except Exception as e:
        logger.error(
            f"{Fore.RED}❌ Failed to add archive processing job: {e}{Style.RESET_ALL}"
        )
        raise HTTPException(status_code=500, detail=str(e))


# endregion


# region File Deletion Jobs


@router.post("/delete-file", response_model=JobResponse)
async def add_delete_file_job(request: DeleteFileJobRequest):
    """
    Add a file deletion job to the BullMQ queue.

    This endpoint adds a job to delete a file:
    1. Delete documents from Weaviate
    2. Delete associated image records from MongoDB

    The job will be processed by the BullMQ worker.
    """
    try:
        logger.info(
            f"{Fore.BLUE}📋 Received file deletion job request: {request.file_path}{Style.RESET_ALL}"
        )

        # Add job to queue
        result = await bullmq_producer.add_delete_file_job(
            file_path=request.file_path,
            collection_name=request.collection_name,
            ttl=request.ttl,
        )

        logger.success(
            f"{Fore.GREEN}✅ File deletion job added to queue: {result['job_id']}{Style.RESET_ALL}"
        )

        return result

    except Exception as e:
        logger.error(
            f"{Fore.RED}❌ Failed to add file deletion job: {e}{Style.RESET_ALL}"
        )
        raise HTTPException(status_code=500, detail=str(e))


# endregion


# region Job Status and Monitoring


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get the status of a job in the queue.

    Returns information about the job including:
    - Current status (waiting, active, completed, failed)
    - Progress (if available)
    - Completion timestamp
    - Failure reason (if failed)
    """
    try:
        logger.info(f"{Fore.BLUE}📋 Checking job status: {job_id}{Style.RESET_ALL}")

        status = await bullmq_producer.get_job_status(job_id)

        if status is None:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"{Fore.RED}❌ Failed to get job status: {e}{Style.RESET_ALL}")
        raise HTTPException(status_code=500, detail=str(e))


# region Queue Statistics


@router.get("/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats():
    """
    Get statistics about the job queue.

    Returns:
    - Number of active jobs
    - Number of waiting jobs
    - Number of completed jobs
    - Number of failed jobs
    """
    try:
        logger.info(f"{Fore.BLUE}📊 Getting queue statistics{Style.RESET_ALL}")

        # Get queue counts
        waiting = await bullmq_producer.queue.getWaiting()
        active = await bullmq_producer.queue.getActive()
        completed = await bullmq_producer.queue.getCompleted()
        failed = await bullmq_producer.queue.getFailed()

        stats = QueueStatsResponse(
            queue_name=bullmq_producer.queue.name,
            active=len(active),
            waiting=len(waiting),
            completed=len(completed),
            failed=len(failed),
        )

        logger.info(
            f"{Fore.GREEN}✅ Queue stats - Active: {stats.active}, "
            f"Waiting: {stats.waiting}, Completed: {stats.completed}, Failed: {stats.failed}{Style.RESET_ALL}"
        )

        return stats

    except Exception as e:
        logger.error(f"{Fore.RED}❌ Failed to get queue stats: {e}{Style.RESET_ALL}")
        raise HTTPException(status_code=500, detail=str(e))


# endregion


# region Queue Management


@router.post("/queue/clean")
async def clean_queue(
    completed: bool = Query(default=False, description="Clean completed jobs"),
    failed: bool = Query(default=False, description="Clean failed jobs"),
):
    """
    Clean jobs from the queue.

    Parameters:
    - completed: If True, clean all completed jobs
    - failed: If True, clean all failed jobs
    """
    try:
        logger.info(
            f"{Fore.BLUE}🧹 Cleaning queue - Completed: {completed}, Failed: {failed}{Style.RESET_ALL}"
        )

        cleaned = 0

        if completed:
            completed_jobs = await bullmq_producer.queue.getCompleted()
            for job in completed_jobs:
                await bullmq_producer.queue.clean(job.id)
                cleaned += 1
            logger.info(
                f"{Fore.GREEN}✅ Cleaned {len(completed_jobs)} completed jobs{Style.RESET_ALL}"
            )

        if failed:
            failed_jobs = await bullmq_producer.queue.getFailed()
            for job in failed_jobs:
                await bullmq_producer.queue.clean(job.id)
                cleaned += 1
            logger.info(
                f"{Fore.GREEN}✅ Cleaned {len(failed_jobs)} failed jobs{Style.RESET_ALL}"
            )

        return {"message": "Queue cleaned successfully", "cleaned_jobs": cleaned}

    except Exception as e:
        logger.error(f"{Fore.RED}❌ Failed to clean queue: {e}{Style.RESET_ALL}")
        raise HTTPException(status_code=500, detail=str(e))


# endregion
