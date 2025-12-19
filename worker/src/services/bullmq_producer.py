from bullmq import Queue
from typing import Dict, Any, Optional
from loguru import logger
from colorama import Fore, Style

from core.config import settings


class BullMQProducer:
    """Producer service for adding jobs to BullMQ queue"""

    def __init__(self):
        """Initialize the BullMQ producer"""
        self.queue = None
        self._initialize_connection()

    def _initialize_connection(self):
        """Initialize Redis connection and queue"""
        try:
            # Create Redis connection configuration for BullMQ
            redis_config = {
                "host": settings.redis_host,
                "port": settings.redis_port,
            }

            if settings.redis_password:
                redis_config["password"] = settings.redis_password

            # Create BullMQ queue with Redis config
            self.queue = Queue(settings.queue_name, {
                "connection": redis_config
            })

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Failed to initialize BullMQ producer: {e}{Style.RESET_ALL}")
            raise

    async def add_file_process_job(
        self,
        download_link: str,
        filename: str,
        file_path: str,
        channel_id: Optional[str] = "Document",
        ttl: Optional[int] = 86400000
    ) -> Dict[str, Any]:
        """
        Add a file processing job to the queue

        Args:
            download_link: URL to download the file
            filename: Name of the file
            file_path: Path where the file will be stored
            channel_id: Channel ID for Weaviate collection
            ttl: Time to live in milliseconds (job will be removed from Redis after this time)

        Returns:
            Job information including job ID
        """
        try:
            job_data = {
                "downloadLink": download_link,
                "filename": filename,
                "filePath": file_path,
                "channelId": channel_id
            }

            # Add job to queue with TTL
            job_opts = {}
            if ttl:
                job_opts = {
                    "removeOnComplete": ttl,
                    "removeOnFail": ttl
                }

            job = await self.queue.add("process-file", job_data, job_opts)

            logger.info(
                f"{Fore.GREEN}✅ Added file processing job: {job.id} - {filename}{Style.RESET_ALL}"
            )

            return {
                "job_id": job.id,
                "job_name": "process-file",
                "data": job_data,
                "queue": settings.queue_name,
                "status": "queued"
            }

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Failed to add file processing job: {e}{Style.RESET_ALL}")
            raise

    async def add_archive_process_job(
        self,
        archive_id: str,
        filename: str,
        file_path: str,
        channel_id: Optional[str] = None,
        ttl: Optional[int] = 86400000
    ) -> Dict[str, Any]:
        """
        Add an archive processing job to the queue

        Args:
            archive_id: ID of the archive file
            filename: Name of the archive file
            file_path: Path of the archive file
            channel_id: Channel ID for Weaviate collection
            ttl: Time to live in milliseconds (job will be removed from Redis after this time)

        Returns:
            Job information including job ID
        """
        try:
            job_data = {
                "archive_id": archive_id,
                "filename": filename,
                "file_path": file_path,
                "channel_id": channel_id
            }

            # Add job to queue with TTL
            job_opts = {}
            if ttl:
                job_opts = {
                    "removeOnComplete": ttl,
                    "removeOnFail": ttl
                }

            job = await self.queue.add("process-archive", job_data, job_opts)

            logger.info(
                f"{Fore.GREEN}✅ Added archive processing job: {job.id} - {filename}{Style.RESET_ALL}"
            )

            return {
                "job_id": job.id,
                "job_name": "process-archive",
                "data": job_data,
                "queue": settings.queue_name,
                "status": "queued"
            }

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Failed to add archive processing job: {e}{Style.RESET_ALL}")
            raise

    async def add_delete_file_job(
        self,
        file_path: str,
        collection_name: Optional[str] = "Document",
        ttl: Optional[int] = 86400000
    ) -> Dict[str, Any]:
        """
        Add a file deletion job to the queue

        Args:
            file_path: Path of the file to delete
            collection_name: Weaviate collection name
            ttl: Time to live in milliseconds (job will be removed from Redis after this time)

        Returns:
            Job information including job ID
        """
        try:
            job_data = {
                "file_path": file_path,
                "collection_name": collection_name
            }

            # Add job to queue with TTL
            job_opts = {}
            if ttl:
                job_opts = {
                    "removeOnComplete": ttl,
                    "removeOnFail": ttl
                }

            job = await self.queue.add("delete-file", job_data, job_opts)

            logger.info(
                f"{Fore.GREEN}✅ Added file deletion job: {job.id} - {file_path}{Style.RESET_ALL}"
            )

            return {
                "job_id": job.id,
                "job_name": "delete-file",
                "data": job_data,
                "queue": settings.queue_name,
                "status": "queued"
            }

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Failed to add file deletion job: {e}{Style.RESET_ALL}")
            raise

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a job

        Args:
            job_id: ID of the job

        Returns:
            Job status information or None if not found
        """
        try:
            job = await self.queue.getJob(job_id)
            if job:
                return {
                    "job_id": job.id,
                    "job_name": job.name,
                    "data": job.data,
                    "status": job.status,
                    "progress": job.progress,
                    "finished_on": job.finishedOn,
                    "processed_on": job.processedOn,
                    "failed_reason": job.failedReason
                }
            return None
        except Exception as e:
            logger.error(f"{Fore.RED}❌ Failed to get job status: {e}{Style.RESET_ALL}")
            return None

    async def close(self):
        """Close the queue connection"""
        try:
            if self.queue:
                await self.queue.close()
            logger.info(f"{Fore.YELLOW}⚠️ BullMQ producer closed{Style.RESET_ALL}")
        except Exception as e:
            logger.error(f"{Fore.RED}❌ Error closing BullMQ producer: {e}{Style.RESET_ALL}")


# Singleton instance
bullmq_producer = BullMQProducer()