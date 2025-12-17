import asyncio
import aiohttp
from io import BytesIO
from colorama import Fore, Style
from loguru import logger

from src.services.docling_service import docling_service
from src.services.weaviate_service import weaviate_service
from src.utils.format_validator import format_validation_error
from src.schemas.file import FileProcessRequest, FileProcessResponse


class FileService:
    """Service for processing files"""

    @staticmethod
    async def process_file(request: FileProcessRequest) -> FileProcessResponse:
        """
        Process a single file: download, extract text, and upload to Weaviate
        """
        logger.info(f"{Fore.BLUE}🔄 Processing file: {request.filename}{Style.RESET_ALL}")

        try:
            # Step 1: Validate file format
            if not request.filename:
                logger.warning(f"{Fore.YELLOW}⚠️ No filename provided{Style.RESET_ALL}")
                return FileProcessResponse(
                    status="skipped",
                    message="No filename provided"
                )

            is_valid, error_msg = format_validation_error(request.filename)
            if not is_valid:
                logger.warning(
                    f"{Fore.YELLOW}⚠️ Skipping unsupported file format: {request.filename} - {error_msg}{Style.RESET_ALL}"
                )
                return FileProcessResponse(
                    status="skipped",
                    file_name=request.filename,
                    message=f"Unsupported file format: {error_msg}"
                )

            logger.info(f"{Fore.GREEN}✓ File format validation passed for: {request.filename}{Style.RESET_ALL}")

            # Step 2: Download file
            logger.info(f"{Fore.CYAN}⬇️ Downloading file...{Style.RESET_ALL}")
            async with aiohttp.ClientSession() as session:
                async with session.get(request.download_link) as response:
                    if response.status == 200:
                        file_data = await response.read()
                    else:
                        raise ValueError(f"Failed to download file: HTTP {response.status}")

            file_stream = BytesIO(file_data)

            # Step 3: Extract text and create chunks with Docling
            logger.info(f"{Fore.CYAN}📝 Extracting text with Docling...{Style.RESET_ALL}")
            extraction_result = await docling_service.extract_and_chunk_from_stream(
                file_stream, request.filename, request.file_path, request.download_link
            )

            # Step 4: Upload chunks to Weaviate
            channel_id = request.channel_id
            if channel_id != "Document" and not channel_id.startswith("vs_"):
                channel_id = f"vs_{channel_id}"

            logger.info(f"{Fore.CYAN}📊 Uploading to Weaviate collection: {channel_id}{Style.RESET_ALL}")
            upload_success = await weaviate_service.upload_chunks(
                file_path=request.file_path,
                file_name=request.filename,
                chunks=extraction_result["chunks"],
                collection_name=channel_id,
            )

            if not upload_success:
                raise ValueError("Failed to upload chunks to Weaviate")

            logger.success(
                f"{Fore.GREEN}✅ File processed successfully! "
                f"Processed {len(extraction_result['chunks'])} chunks.{Style.RESET_ALL}"
            )

            return FileProcessResponse(
                status="completed",
                chunks_processed=len(extraction_result["chunks"]),
                metadata=extraction_result["metadata"],
                file_name=request.filename,
                message="File processed successfully"
            )

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Error processing file: {e}{Style.RESET_ALL}")
            return FileProcessResponse(
                status="failed",
                file_name=request.filename,
                message=str(e)
            )


# Singleton instance
file_service = FileService()