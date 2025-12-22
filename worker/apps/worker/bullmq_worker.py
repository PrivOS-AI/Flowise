# Standard library imports
import asyncio
from io import BytesIO

# Third-party imports
import aiohttp
from beanie import init_beanie
from bullmq import Worker
from colorama import Fore, Style
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient

# Local/project imports
from core.config import settings
from models.file import ArchiveFile, File, Folder
from models.image import Image
from services.archive_service import archive_service
from services.docling_service import docling_service
from services.mongodb import mongodb_service
from services.weaviate_service import weaviate_service
from utils.format_validator import format_validation_error

# -----------------------------------------------------------------


class BullMQCompatibleWorker:
    """
    Worker implementation using the official bullmq Python library
    """

    def __init__(self):
        self.redis_opts = {
            "host": settings.redis_host,
            "port": settings.redis_port,
            "password": settings.redis_password,
        }
        self.queue_name = "file-processing"
        self.db_initialized = False

    async def _ensure_db_initialized(self):
        """Ensure database is initialized"""
        if not self.db_initialized:
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

            self.db_initialized = True
            logger.info(f"{Fore.GREEN}✓ Database initialized in worker{Style.RESET_ALL}")

    async def process_job(self, job, token):
        """
        Process a job from the queue
        """
        # Ensure database is initialized
        await self._ensure_db_initialized()

        # job.data is a dict
        job_data = job.data
        job_id = job.id
        job_name = job.name

        logger.info(
            f"{Fore.YELLOW}📋 Found BullMQ job: {job_name} (ID: {job_id}){Style.RESET_ALL}"
        )

        if job_name == "process-file":
            return await self._handle_process_file(job, job_data, job_id)
        elif job_name == "process-archive":
            return await self._handle_process_archive(job, job_data, job_id)
        elif job_name == "process-zip":
            # Redirect process-zip to process-archive for backward compatibility
            logger.warning(f"{Fore.YELLOW}⚠️ Legacy process-zip job detected, redirecting to process-archive{Style.RESET_ALL}")
            return await self._handle_process_archive(job, job_data, job_id)
        elif job_name == "delete-file":
            return await self._handle_delete_file(job, job_data, job_id)
        else:
            logger.error(f"{Fore.RED}❌ Unknown job type: {job_name}{Style.RESET_ALL}")
            return {"error": f"Unknown job type: {job_name}"}

    async def _handle_process_file(self, job, job_data, job_id):
        """Handle process-file job"""
        # Get download link and other info from job data
        download_link = job_data.get("downloadLink")
        filename = job_data.get("filename")
        file_path = job_data.get("filePath")
        channel_id = job_data.get("channelId", "Document")

        # Add 'vs_' prefix to make it a valid Weaviate collection name
        if channel_id != "Document" and not channel_id.startswith("vs_"):
            channel_id = f"vs_{channel_id}"

        if not download_link:
            raise ValueError("No download link provided in job data")

        logger.info(
            f"{Fore.BLUE}🔄 Processing job {job_id} for file: {filename}{Style.RESET_ALL}"
        )

        await job.updateProgress(0)

        try:
            # Step 1: Validate file format
            if not filename:
                logger.warning(
                    f"{Fore.YELLOW}⚠️ No filename provided in job data{Style.RESET_ALL}"
                )
                return {"status": "skipped", "reason": "No filename provided"}

            # Check if file is an archive format first
            if archive_service.is_archive_file(filename):
                logger.warning(
                    f"{Fore.YELLOW}⚠️ File {filename} is an archive format. It should be processed with process-archive job, not process-file.{Style.RESET_ALL}"
                )
                return {
                    "status": "skipped",
                    "reason": f"Archive file '{filename}' detected. Use process-archive endpoint instead.",
                    "filename": filename,
                    "message": "Archive files should be processed via the archive processing endpoint",
                }

            is_valid, error_msg = format_validation_error(filename)
            if not is_valid:
                logger.warning(
                    f"{Fore.YELLOW}⚠️ Skipping unsupported file format: {filename} - {error_msg}{Style.RESET_ALL}"
                )
                # Mark job as completed but skipped, not failed
                return {
                    "status": "skipped",
                    "reason": f"Unsupported file format: {error_msg}",
                    "filename": filename,
                    "message": "File format not supported by Docling",
                }

            logger.info(
                f"{Fore.GREEN}✓ File format validation passed for: {filename}{Style.RESET_ALL}"
            )

            await job.updateProgress(25)

            # Step 2: Download file from the provided link
            logger.info(
                f"{Fore.CYAN}⬇️ Downloading file from provided link...{Style.RESET_ALL}"
            )
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(download_link) as response:
                        if response.status == 200:
                            file_data = await response.read()
                        else:
                            raise ValueError(f"Failed to download file: HTTP {response.status}")
            except Exception as e:
                raise ValueError(f"Failed to download file from provided link: {e}")

            # Create BytesIO from the file data
            file_stream = BytesIO(file_data)

            await job.updateProgress(50)

            # Step 3: Extract text and create chunks with Docling
            logger.info(
                f"{Fore.CYAN}📝 Extracting text with Docling from stream...{Style.RESET_ALL}"
            )
            extraction_result = await docling_service.extract_and_chunk_from_stream(
                file_stream, filename, file_path, download_link
            )

            await job.updateProgress(75)

            # Step 4: Upload chunks to Weaviate
            logger.info(f"{Fore.CYAN}📊 Uploading to Weaviate...{Style.RESET_ALL}")
            upload_success = await weaviate_service.upload_chunks(
                file_path=file_path,
                file_name=filename,
                chunks=extraction_result["chunks"],
                collection_name=channel_id,
            )

            if not upload_success:
                raise ValueError("Failed to upload chunks to Weaviate")

            # Prepare result
            result = {
                "chunksProcessed": len(extraction_result["chunks"]),
                "metadata": extraction_result["metadata"],
            }

            if result.get("status") == "skipped":
                logger.info(
                    f"{Fore.YELLOW}⏩ Job {job_id} skipped: {result.get('reason', 'Unknown reason')}{Style.RESET_ALL}"
                )
            else:
                logger.success(
                    f"{Fore.GREEN}✅ Job {job_id} completed successfully! Processed {result.get('chunksProcessed', 0)} chunks.{Style.RESET_ALL}"
                )
            await job.updateProgress(100)
            return result

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Error processing job: {e}{Style.RESET_ALL}")
            # Raising exception marks job as failed in BullMQ
            raise e

    async def _handle_process_archive(self, job, job_data, job_id):
        """Handle process-archive job for various archive formats"""
        archive_id = job_data.get("archive_id")
        filename = job_data.get("filename")
        channel_id = job_data.get("channel_id")
        # user_id is no longer required, set to None for compatibility
        user_id = None

        if not archive_id:
            raise ValueError("No archive_id provided in job data")

        logger.info(
            f"{Fore.BLUE}📦 Processing archive job {job_id} for file: {filename}{Style.RESET_ALL}"
        )

        await job.updateProgress(0)

        try:
            # Get the archive file
            archive_file = await ArchiveFile.get(archive_id)
            if not archive_file:
                raise ValueError(f"Archive file not found: {archive_id}")

            # Debug: Log archive file details
            logger.info(f"{Fore.YELLOW}📝 Archive file details:{Style.RESET_ALL}")
            logger.info(f"  - ID: {archive_file.id}")
            logger.info(f"  - Filename: {archive_file.filename}")
            logger.info(f"  - File path: {archive_file.file_path}")
            logger.info(f"  - Channel ID: {archive_file.channel_id}")
            logger.info(f"  - User ID: {archive_file.user_id}")

            # Check if file_path exists
            if not archive_file.file_path:
                raise ValueError(f"Archive file has no file_path. Archive data: {archive_file.dict()}")

            # Process the archive file
            logger.info(f"{Fore.CYAN}📂 Extracting and processing archive file...{Style.RESET_ALL}")
            result = await archive_service.process_archive_file(
                archive_id, archive_file, channel_id, user_id
            )

            await job.updateProgress(100)

            logger.success(
                f"{Fore.GREEN}✅ Archive job {job_id} completed successfully! "
                f"Extracted {result.get('total_folders', 0)} folders and {result.get('total_files', 0)} files.{Style.RESET_ALL}"
            )

            return result

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Error processing archive job: {e}{Style.RESET_ALL}")
            # Raising exception marks job as failed in BullMQ
            raise e

    async def _handle_delete_file(self, job, job_data, job_id):
        """Handle delete-file job"""
        file_id = job_data.get("file_id")  # Optional - not always provided
        file_path = job_data.get("file_path")
        collection_name = job_data.get("collection_name", "Document")

        # Add 'vs_' prefix to match the naming convention used in process-file
        if collection_name != "Document" and not collection_name.startswith("vs_"):
            collection_name = f"vs_{collection_name}"

        logger.info(
            f"{Fore.BLUE}🗑️ Deleting documents for file_path: {file_path}{Style.RESET_ALL}"
        )

        await job.updateProgress(10)

        try:
            # Skip database queries since all necessary data is provided in job_data

            # Check if file_path is provided
            if not file_path:
                logger.warning(f"{Fore.YELLOW}⚠️ No file_path provided in job data{Style.RESET_ALL}")
                return {
                    "file_id": file_id,
                    "collection_name": collection_name,
                    "status": "skipped",
                    "message": f"No file_path provided for file_id: {file_id}",
                }

            await job.updateProgress(25)

            # Step 1: Delete from Weaviate
            logger.info(f"{Fore.CYAN}📊 Deleting from Weaviate from collection '{collection_name}'...{Style.RESET_ALL}")
            delete_success = await weaviate_service.delete_by_file_path(
                file_path=file_path, collection_name=collection_name
            )

            await job.updateProgress(60)

            if not delete_success:
                # Log more details but don't fail the entire job - Weaviate might not have any documents for this file
                logger.warning(f"{Fore.YELLOW}⚠️ Weaviate deletion returned False, but continuing with MongoDB cleanup{Style.RESET_ALL}")
                # Don't raise an error here - continue with MongoDB cleanup
                delete_success = True  # Mark as success for the overall job

            # Step 2: Get images count associated with this file (no MinIO deletion)
            logger.info(f"{Fore.CYAN}🖼️ Counting images associated with file...{Style.RESET_ALL}")
            images = await mongodb_service.get_images_by_file_path(file_path)
            deleted_images_count = len(images)

            await job.updateProgress(80)

            # Step 3: Delete image records from MongoDB
            logger.info(f"{Fore.CYAN}🗑️ Deleting image records from MongoDB...{Style.RESET_ALL}")
            await mongodb_service.delete_images_by_file_path(file_path)

            await job.updateProgress(95)

            # Prepare result
            result = {
                "file_path": file_path,
                "collection_name": collection_name,
                "status": "deleted",
                "deleted_images_count": deleted_images_count,
                "message": f"Successfully deleted all documents and {deleted_images_count} image records for file_path: {file_path}",
            }

            # Include file_id in result if it exists
            if file_id:
                result["file_id"] = file_id

            logger.success(
                f"{Fore.GREEN}✅ Delete job {job_id} completed successfully for file_path {file_path}{Style.RESET_ALL}"
            )

            await job.updateProgress(100)
            return result

        except Exception as e:
            logger.error(
                f"{Fore.RED}❌ Error deleting file at path {file_path}: {e}{Style.RESET_ALL}"
            )
            # Raising exception marks job as failed in BullMQ
            raise e

    async def _run(self):
        """
        Internal async run method
        """
        logger.info(
            f"{Fore.GREEN}🎧 Listening to BullMQ queue: {self.queue_name}{Style.RESET_ALL}"
        )

        worker = Worker(
            self.queue_name, self.process_job, {"connection": self.redis_opts}
        )

        # Keep the worker running
        # We can use an event to wait indefinitely
        try:
            # Create a future that will never complete to keep the loop running
            await asyncio.get_running_loop().create_future()
        except asyncio.CancelledError:
            await worker.close()

    def listen_to_bullmq(self):
        """
        Start the worker (blocking)
        """
        asyncio.run(self._run())


def create_worker():
    """Create and return worker instance"""
    return BullMQCompatibleWorker()
