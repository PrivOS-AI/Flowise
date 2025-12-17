from colorama import Fore, Style
from loguru import logger

from src.schemas.archive import ArchiveProcessRequest, ArchiveProcessResponse


class ArchiveService:
    """Service for processing archive files"""

    @staticmethod
    async def process_archive(request: ArchiveProcessRequest) -> ArchiveProcessResponse:
        """
        Process an archive file: extract and process all contained files
        """
        logger.info(f"{Fore.BLUE}📦 Processing archive: {request.filename}{Style.RESET_ALL}")

        try:
            # Import here to avoid circular imports
            from worker.apps.services.archive_service import archive_service
            from worker.apps.models.file import ArchiveFile

            # Get the archive file
            archive_file = await ArchiveFile.get(request.archive_id)
            if not archive_file:
                raise ValueError(f"Archive file not found: {request.archive_id}")

            # Debug: Log archive file details
            logger.info(f"{Fore.YELLOW}📝 Archive file details:{Style.RESET_ALL}")
            logger.info(f"  - ID: {archive_file.id}")
            logger.info(f"  - Filename: {archive_file.filename}")
            logger.info(f"  - File path: {archive_file.file_path}")
            logger.info(f"  - Channel ID: {archive_file.channel_id}")
            logger.info(f"  - User ID: {archive_file.user_id}")

            # Check if file_path exists
            if not archive_file.file_path:
                raise ValueError(f"Archive file has no file_path")

            # Process the archive file
            logger.info(f"{Fore.CYAN}📂 Extracting and processing archive file...{Style.RESET_ALL}")
            result = await archive_service.process_archive_file(
                request.archive_id,
                archive_file,
                request.channel_id,
                request.user_id
            )

            logger.success(
                f"{Fore.GREEN}✅ Archive processing completed! "
                f"Extracted {result.get('total_folders', 0)} folders and {result.get('total_files', 0)} files.{Style.RESET_ALL}"
            )

            return ArchiveProcessResponse(
                archive_id=request.archive_id,
                total_folders=result.get('total_folders', 0),
                total_files=result.get('total_files', 0),
                processed_files=result.get('processed_files', 0),
                failed_files=result.get('failed_files', 0),
                message="Archive processed successfully"
            )

        except Exception as e:
            logger.error(f"{Fore.RED}❌ Error processing archive: {e}{Style.RESET_ALL}")
            return ArchiveProcessResponse(
                archive_id=request.archive_id,
                total_folders=0,
                total_files=0,
                processed_files=0,
                failed_files=1,
                message=str(e)
            )


# Singleton instance
archive_service = ArchiveService()