# Standard library imports
import asyncio
import mimetypes
import os
import shutil
import subprocess
import tarfile
import tempfile
import traceback
import zipfile
from pathlib import Path
from typing import Dict, List, Optional
from models.file import Folder

try:
    import patoolib  # noqa: F401

    PATOOL_AVAILABLE = True
except ImportError:
    PATOOL_AVAILABLE = False

try:
    import py7zr

    PY7ZR_AVAILABLE = True
except ImportError:
    PY7ZR_AVAILABLE = False

try:
    import rarfile

    RARFILE_AVAILABLE = True
except ImportError:
    RARFILE_AVAILABLE = False

# Third-party imports
from loguru import logger

# Local/project imports
from core.config import settings
from models.file import File
from services.minio_service import minio_service


class ArchiveService:
    """Service for processing various archive file formats"""

    # Supported file extensions for docling processing
    DOCLING_SUPPORTED_EXTENSIONS = {
        ".pdf",
        ".docx",
        ".doc",
        ".txt",
        ".rtf",
        ".odt",
        ".xls",
        ".xlsx",
        ".ods",
        ".ppt",
        ".pptx",
        ".odp",
        ".html",
        ".htm",
        ".xml",
        ".csv",
        ".json",
        ".yaml",
        ".yml",
    }

    # Archive format mapping
    ARCHIVE_FORMATS = {
        ".zip": {"type": "zip", "module": "zipfile"},
        ".tar": {"type": "tar", "module": "tarfile"},
        ".gz": {"type": "gzip", "module": "tarfile"},
        ".tgz": {"type": "gzip", "module": "tarfile"},
        ".bz2": {"type": "bzip2", "module": "tarfile"},
        ".xz": {"type": "xz", "module": "tarfile"},
        ".7z": {"type": "7z", "module": "py7zr"},
        ".rar": {"type": "rar", "module": "rarfile"},
        ".udf": {"type": "7zip", "module": "7zip"},
    }

    def __init__(self):
        self.redis_config = {
            "host": settings.redis_host,
            "port": settings.redis_port,
            "password": settings.redis_password,
        }

    def is_archive_file(self, filename: str) -> bool:
        """Check if file is an archive based on extension"""
        extension = Path(filename).suffix.lower()
        return extension in self.ARCHIVE_FORMATS

    def get_archive_type(self, filename: str) -> Optional[Dict]:
        """Get archive type info for a file"""
        extension = Path(filename).suffix.lower()
        return self.ARCHIVE_FORMATS.get(extension)

    async def extract_archive(
        self, file_data: bytes, filename: str, extract_to: str
    ) -> List[str]:
        """
        Extract archive file to specified directory

        Args:
            file_data: Raw bytes of the archive file
            filename: Name of the archive file
            extract_to: Directory to extract files to

        Returns:
            List of extracted file paths
        """
        archive_info = self.get_archive_type(filename)
        if not archive_info:
            raise ValueError(f"Unsupported archive format: {filename}")

        # Ensure extraction directory exists
        os.makedirs(extract_to, exist_ok=True)

        # Create a temporary file for the archive
        with tempfile.NamedTemporaryFile(delete=False, suffix=filename) as temp_file:
            temp_file.write(file_data)
            temp_file_path = temp_file.name

        try:
            match archive_info["type"]:
                case "zip":
                    return await self._extract_zip(temp_file_path, extract_to)
                case "tar":
                    return await self._extract_tar(temp_file_path, extract_to)
                case "gzip":
                    return await self._extract_gzip(temp_file_path, extract_to)
                case "7z":
                    return await self._extract_7z(temp_file_path, extract_to)
                case "7zip":
                    return await self._extract_7zip(temp_file_path, extract_to)
                case "rar":
                    return await self._extract_rar(temp_file_path, extract_to)
                case _:
                    # Try using patool for unknown formats
                    return await self._extract_with_patool(temp_file_path, extract_to)
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)

    async def _extract_zip(self, archive_path: str, extract_to: str) -> List[str]:
        """Extract ZIP file"""
        extracted_files = []

        def _extract():
            with zipfile.ZipFile(archive_path, "r") as zip_ref:
                zip_ref.extractall(extract_to)
                return zip_ref.namelist()

        # Run in thread pool to avoid blocking
        extracted_files = await asyncio.to_thread(_extract)
        return extracted_files

    async def _extract_tar(self, archive_path: str, extract_to: str) -> List[str]:
        """Extract TAR file"""
        extracted_files = []

        def _extract():
            with tarfile.open(archive_path, "r:*") as tar_ref:
                tar_ref.extractall(extract_to)
                return tar_ref.getnames()

        # Run in thread pool to avoid blocking
        extracted_files = await asyncio.to_thread(_extract)
        return extracted_files

    async def _extract_gzip(self, archive_path: str, extract_to: str) -> List[str]:
        """Extract GZIP/TAR.GZ file"""
        extracted_files = []

        def _extract():
            # Handle .tar.gz, .tgz files
            if archive_path.endswith((".tar.gz", ".tgz")):
                with tarfile.open(archive_path, "r:gz") as tar_ref:
                    tar_ref.extractall(extract_to)
                    return tar_ref.getnames()
            else:
                # Handle plain .gz files (decompress to file)
                import gzip

                output_path = os.path.join(
                    extract_to, os.path.basename(archive_path[:-3])
                )
                with gzip.open(archive_path, "rb") as gz_file:
                    with open(output_path, "wb") as out_file:
                        shutil.copyfileobj(gz_file, out_file)
                return [os.path.basename(output_path)]

        # Run in thread pool to avoid blocking
        extracted_files = await asyncio.to_thread(_extract)
        return extracted_files

    async def _extract_7z(self, archive_path: str, extract_to: str) -> List[str]:
        """Extract 7Z file"""
        if not PY7ZR_AVAILABLE:
            raise ImportError(
                "py7zr is not installed. Install it with: pip install py7zr"
            )

        extracted_files = []

        def _extract():
            with py7zr.SevenZipFile(archive_path, mode="r") as archive:
                archive.extractall(extract_to)
                return archive.getnames()

        # Run in thread pool to avoid blocking
        extracted_files = await asyncio.to_thread(_extract)
        return extracted_files

    async def _extract_rar(self, archive_path: str, extract_to: str) -> List[str]:
        """Extract RAR file"""
        if not RARFILE_AVAILABLE:
            raise ImportError(
                "rarfile is not installed. Install it with: pip install rarfile"
            )

        # Note: rarfile also requires unrar command to be installed on the system
        extracted_files = []

        def _extract():
            with rarfile.RarFile(archive_path, "r") as rar_ref:
                rar_ref.extractall(extract_to)
                return rar_ref.namelist()

        # Run in thread pool to avoid blocking
        extracted_files = await asyncio.to_thread(_extract)
        return extracted_files

    async def _extract_7zip(self, archive_path: str, extract_to: str) -> List[str]:
        """Extract file using 7zip command-line tool"""
        extracted_files = []

        def _extract():
            try:
                # Use 7z command to extract
                cmd = ["7z", "x", archive_path, f"-o{extract_to}", "-y"]
                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=300
                )

                if result.returncode == 0:
                    # Get list of extracted files
                    for root, _, files in os.walk(extract_to):
                        for file in files:
                            rel_path = os.path.relpath(
                                os.path.join(root, file), extract_to
                            )
                            extracted_files.append(rel_path)
                    return extracted_files
                else:
                    raise Exception(f"7z extraction failed: {result.stderr}")

            except subprocess.TimeoutExpired:
                raise Exception("7z extraction timeout for archive")
            except FileNotFoundError:
                raise Exception(
                    "7z command not found. Please install p7zip-full or 7zip"
                )
            except Exception as e:
                raise Exception(f"7z extraction error: {e}")

        # Run in thread pool to avoid blocking
        try:
            extracted_files = await asyncio.to_thread(_extract)
            print("Successfully extracted archive with 7z")
            return extracted_files
        except Exception as e:
            logger.error(f"Failed to extract with 7z: {e}")
            # Fall back to patool if 7z fails
            print("Falling back to patool...")
            return await self._extract_with_patool(archive_path, extract_to)

    async def _extract_with_patool(
        self, archive_path: str, extract_to: str
    ) -> List[str]:
        """Extract archive using patool (fallback for other formats)"""
        if not PATOOL_AVAILABLE:
            raise ImportError(
                "patool is not installed. Install it with: pip install patool"
            )

        def _extract():
            # Ensure extract directory exists
            os.makedirs(extract_to, exist_ok=True)

            # Extract using patool command directly
            import subprocess

            result = subprocess.run(
                ["patool", "extract", "--outdir", extract_to, archive_path],
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                # Check if extraction actually succeeded despite the error
                # patool sometimes reports error but extraction works
                if os.listdir(extract_to):
                    print(
                        f"patool reported error but files were extracted: {result.stderr}"
                    )
                else:
                    raise Exception(f"patool extraction failed: {result.stderr}")

            # Get list of extracted files
            extracted = []
            for root, dirs, files in os.walk(extract_to):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), extract_to)
                    extracted.append(rel_path)
            return extracted

        # Run in thread pool to avoid blocking
        extracted_files = await asyncio.to_thread(_extract)
        return extracted_files

    async def process_archive_file(
        self, archive_id: str, archive_file, channel_id: str, user_id: str = None
    ) -> Dict:
        """
        Process an archive file - extract contents and create jobs

        Args:
            archive_id: MongoDB ID of the archive file
            archive_file: ArchiveFile object from MongoDB
            channel_id: Channel ID
            user_id: User ID

        Returns:
            Dict with processing results
        """
        try:
            print(f"Processing archive file: {archive_file.filename}")

            # Update status to PROCESSING
            archive_file.status = "PROCESSING"
            await archive_file.save()

            # Download archive file from MinIO
            print(
                f"Attempting to download archive file from MinIO: {archive_file.file_path}"
            )
            archive_data = await minio_service.download_file(archive_file.file_path)
            if not archive_data:
                # Check if MinIO service is initialized
                if not minio_service.client:
                    print("❌ MinIO client not initialized")
                else:
                    print(
                        f"✅ MinIO client initialized, bucket: {minio_service.bucket}"
                    )
                    # Try to check if file exists
                    try:
                        await asyncio.to_thread(
                            minio_service.client.stat_object,
                            minio_service.bucket,
                            archive_file.file_path,
                        )
                        print(f"✅ File exists in MinIO: {archive_file.file_path}")
                    except Exception as e:
                        print(
                            f"❌ File does not exist in MinIO: {archive_file.file_path}"
                        )
                        print(f"MinIO error: {e}")
                raise ValueError(
                    f"Failed to download archive file: {archive_file.file_path}"
                )

            # Create a root folder for the archive (without extension)
            archive_name = Path(archive_file.filename).stem
            archive_folder = await self._create_archive_root_folder(
                archive_name, channel_id, archive_id, user_id
            )

            # Create temporary directory for extraction
            temp_dir = f"temp/archive_extraction/{archive_id}"
            os.makedirs(temp_dir, exist_ok=True)

            # Extract archive
            extracted_files = await self.extract_archive(
                archive_data, archive_file.filename, temp_dir
            )
            print(
                f"Extracted {len(extracted_files)} files from {archive_file.filename}"
            )

            # Create folder structure with archive folder as root
            folder_map = await self._create_folder_structure(
                archive_id, temp_dir, channel_id, archive_folder.id
            )

            # Process and upload files
            processed_files = await self._process_extracted_files(
                archive_id, temp_dir, folder_map, channel_id, user_id, archive_folder.id
            )

            # Update archive file record with results
            archive_file.status = "COMPLETED"
            archive_file.total_files = len(processed_files)
            archive_file.total_folders = len(folder_map)
            await archive_file.save()

            # Clean up temporary directory
            shutil.rmtree(temp_dir, ignore_errors=True)
            print(f"Cleaned up temporary directory: {temp_dir}")

            return {
                "status": "success",
                "total_files": len(processed_files),
                "total_folders": len(folder_map),
                "archive_folder_id": archive_folder.id,
                "archive_folder_name": archive_folder.name,
                "files": processed_files,
            }

        except Exception as e:
            print(f"Error processing archive file {archive_id}: {e}")
            traceback.print_exc()

            # Update archive file status to FAILED
            try:
                archive_file = await archive_file.get(archive_id)
                if archive_file:
                    archive_file.status = "FAILED"
                    archive_file.error_message = str(e)
                    await archive_file.save()
            except:  # noqa: E722
                pass

            # Clean up on error
            try:
                shutil.rmtree(
                    f"temp/archive_extraction/{archive_id}", ignore_errors=True
                )
            except:  # noqa: E722
                pass

            raise

    async def _create_archive_root_folder(
        self, archive_name: str, channel_id: str, archive_id: str, user_id: str = None
    ) -> Folder:
        """
        Create root folder for the archive

        Args:
            archive_name: Name of the archive (without extension)
            channel_id: Channel ID
            archive_id: ID of the archive file
            user_id: User ID

        Returns:
            Folder object for the archive root folder
        """

        # Create root folder for the archive
        folder_path = f"/{archive_name}"
        folder = Folder(
            name=archive_name,
            folder_path=folder_path,
            father=None,  # Root folder has no parent
            channel_id=channel_id,
            user_id=user_id,
            zip_id=archive_id,  # Reuse zip_id field for archives
        )
        await folder.insert()

        print(f"Created archive root folder: {folder_path} -> ID: {folder.id}")
        return folder

    async def _create_folder_structure(
        self,
        archive_id: str,
        extract_dir: str,
        channel_id: str,
        archive_root_folder_id: str = None,
    ) -> Dict[str, str]:
        """
        Create folder structure from extracted archive contents

        Args:
            archive_id: ID of the archive file
            extract_dir: Directory where files were extracted
            channel_id: Channel ID
            archive_root_folder_id: ID of the root folder for the archive

        Returns:
            Dict mapping folder paths to folder IDs
        """
        folder_map = {}

        # Find all directories
        all_dirs = []
        for root, dirs, _ in os.walk(extract_dir):
            for dir_name in dirs:
                full_path = os.path.join(root, dir_name)
                rel_path = os.path.relpath(full_path, extract_dir)
                all_dirs.append(rel_path)

        # Sort to ensure parents are created before children
        all_dirs.sort()

        for rel_path in all_dirs:
            # Convert Windows path to forward slashes
            rel_path = rel_path.replace("\\", "/")
            path_obj = Path(rel_path)
            folder_name = path_obj.name
            folder_path = f"/{rel_path}"

            # Get parent folder path
            parent_path = str(path_obj.parent)
            if parent_path == ".":
                # Top-level folder: parent is the archive root folder
                parent_id = archive_root_folder_id
            else:
                # Child folder: find parent in folder_map
                parent_path = f"/{parent_path}".replace("\\", "/")
                parent_id = folder_map.get(parent_path)

            # Create folder record
            from models.file import Folder

            folder = Folder(
                name=folder_name,
                folder_path=folder_path,
                father=(
                    str(parent_id) if parent_id else None
                ),  # Using 'father' to match Meteor model
                channel_id=channel_id,
                zip_id=archive_id,  # Reuse zip_id field for archives
            )
            await folder.insert()
            folder_id = str(folder.id)
            folder_map[folder_path] = folder_id

            print(
                f"Created folder: {folder_path} -> ID: {folder_id} (parent: {parent_id or 'None'})"
            )
            print(f"Updated folder_map: {folder_map}")

        return folder_map

    async def _process_extracted_files(
        self,
        archive_id: str,
        extract_dir: str,
        folder_map: Dict[str, str],
        channel_id: str,
        user_id: Optional[str],
        archive_root_folder_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        Process all extracted files and upload to MinIO

        Args:
            archive_id: ID of the archive file
            extract_dir: Directory where files were extracted
            folder_map: Mapping of folder paths to folder IDs
            channel_id: Channel ID
            user_id: User ID

        Returns:
            List of processed file information
        """
        processed_files = []
        docling_files = []  # Files to be processed with docling

        # First pass: identify files and upload non-docling files to MinIO
        # Also check for nested archives
        nested_archives = []
        for root, _, files in os.walk(extract_dir):
            for file_name in files:
                full_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(full_path, extract_dir)
                rel_path = rel_path.replace("\\", "/")

                # Skip empty files
                if os.path.getsize(full_path) == 0:
                    print(f"Skipping empty file: {rel_path}")
                    continue

                # Get file info
                file_size = os.path.getsize(full_path)
                path_obj = Path(rel_path)
                extension = path_obj.suffix.lower()
                mime_type, _ = mimetypes.guess_type(file_name)

                # Check if this is a nested archive
                if self.is_archive_file(file_name):
                    print(f"Found nested archive: {file_name}")
                    nested_archives.append(
                        {
                            "full_path": full_path,
                            "rel_path": rel_path,
                            "file_name": file_name,
                            "file_size": file_size,
                            "extension": extension,
                            "folder_id": None,  # Will be determined below
                        }
                    )

                # Determine folder ID
                folder_id = None
                parent_path = str(path_obj.parent)
                if parent_path == ".":
                    # File at root level: use archive root folder
                    folder_id = archive_root_folder_id
                else:
                    # File in subfolder: find parent in folder_map
                    parent_path = f"/{parent_path}".replace("\\", "/")
                    folder_id = folder_map.get(parent_path)
                    print(
                        f"File {file_name}: parent_path={parent_path}, folder_id={folder_id}"
                    )
                    if folder_id:
                        print(f"Found folder in map: {folder_map}")
                    else:
                        print(f"Folder NOT found in map for path: {parent_path}")
                        print(
                            f"Available paths in folder_map: {list(folder_map.keys())}"
                        )

                # Update folder_id for nested archives
                if nested_archives and nested_archives[-1]["file_name"] == file_name:
                    nested_archives[-1]["folder_id"] = folder_id

                # Check if file should be processed with docling
                if extension in self.DOCLING_SUPPORTED_EXTENSIONS:
                    docling_files.append(
                        {
                            "full_path": full_path,
                            "rel_path": rel_path,
                            "file_name": file_name,
                            "file_size": file_size,
                            "extension": extension,
                            "mime_type": mime_type,
                            "folder_id": folder_id,
                        }
                    )
                    continue

                # Create file record first to get ID
                file_record = File(
                    name=file_name,
                    file_path="",  # Will be updated after MinIO upload
                    folder_id=str(folder_id) if folder_id else None,
                    channel_id=channel_id,
                    user_id=user_id,
                    file_size=file_size,
                    file_type=extension,  # Use file_type to match Meteor model
                    mime_type=mime_type,
                )
                await file_record.insert()

                # Generate MinIO path using the same pattern as regular files
                # extension already includes the dot (e.g., ".pdf"), so no need to add another dot
                minio_path = (
                    f"{channel_id}/{file_record.id}{extension}"
                    if extension
                    else f"{channel_id}/{file_record.id}"
                )

                # Upload to MinIO
                success = await self._upload_file_to_minio(
                    full_path, minio_path, mime_type
                )

                if success:
                    # Update file record with MinIO path
                    file_record.file_path = minio_path
                    await file_record.save()

                    processed_files.append(
                        {
                            "file_name": file_name,
                            "file_path": minio_path,
                            "size": file_size,
                            "type": "uploaded",
                            "mime_type": mime_type,
                        }
                    )

                    print(f"Uploaded file: {rel_path}")

        # Process nested archives
        if nested_archives:
            print(f"Processing {len(nested_archives)} nested archives...")
            await self._process_nested_archives(
                nested_archives,
                archive_id,
                channel_id,
                user_id,
                folder_map,
                processed_files,
            )

        # Second pass: process docling-supported files
        if docling_files:
            print(f"Processing {len(docling_files)} files with docling...")
            await self._process_docling_files_batch(
                docling_files,
                archive_id,
                channel_id,
                user_id,
                processed_files,
                batch_size=5,
            )

        return processed_files

    async def _upload_file_to_minio(
        self, file_path: str, minio_path: str, mime_type: Optional[str]
    ) -> bool:
        """Upload a file to MinIO"""
        try:
            with open(file_path, "rb") as f:
                file_data = f.read()
            return await minio_service.upload_file(
                minio_path, file_data, mime_type or "application/octet-stream"
            )
        except Exception as e:
            print(f"Failed to upload {file_path}: {e}")
            return False

    async def _process_nested_archives(
        self,
        nested_archives: List[Dict],
        archive_id: str,
        channel_id: str,
        user_id: Optional[str],
        folder_map: Dict[str, str],
        processed_files: List[Dict],
    ):
        """Process nested archive files with full folder and docling support"""

        for archive_info in nested_archives:
            try:
                print(f"Processing nested archive: {archive_info['file_name']}")

                # Read the nested archive file
                with open(archive_info["full_path"], "rb") as f:
                    archive_data = f.read()

                # Create temporary directory for nested extraction
                nested_temp_dir = f"temp/archive_extraction/{archive_id}/nested_{Path(archive_info['rel_path']).stem}"
                os.makedirs(nested_temp_dir, exist_ok=True)

                # Track nested folder structure
                nested_folder_map = {}

                try:
                    # Extract nested archive
                    nested_files = await self.extract_archive(
                        archive_data, archive_info["file_name"], nested_temp_dir
                    )
                    print(
                        f"Extracted {len(nested_files)} files from nested archive {archive_info['file_name']}"
                    )

                    # Create folder structure for nested archive
                    nested_folder_map = await self._create_nested_folder_structure(
                        nested_temp_dir, archive_info["folder_id"], channel_id
                    )

                    # Separate regular files and docling files
                    regular_files = []
                    docling_files = []
                    deeper_nested_archives = []

                    for root, _, files in os.walk(nested_temp_dir):
                        for file_name in files:
                            full_path = os.path.join(root, file_name)
                            rel_path = os.path.relpath(full_path, nested_temp_dir)
                            rel_path = rel_path.replace("\\", "/")

                            # Skip empty files
                            if os.path.getsize(full_path) == 0:
                                continue

                            # Get file info
                            file_size = os.path.getsize(full_path)
                            path_obj = Path(rel_path)
                            extension = path_obj.suffix.lower()
                            mime_type, _ = mimetypes.guess_type(file_name)

                            # Check for deeper nested archives
                            if self.is_archive_file(file_name):
                                print(f"Found deeper nested archive: {file_name}")
                                deeper_nested_archives.append(
                                    {
                                        "full_path": full_path,
                                        "rel_path": rel_path,
                                        "file_name": file_name,
                                        "file_size": file_size,
                                        "extension": extension,
                                        "folder_id": self._get_nested_folder_id(
                                            rel_path,
                                            archive_info["folder_id"],
                                            nested_folder_map,
                                        ),
                                    }
                                )
                                continue

                            # Determine folder ID
                            folder_id = self._get_nested_folder_id(
                                rel_path, archive_info["folder_id"], nested_folder_map
                            )

                            # Check if file should be processed with docling
                            if extension in self.DOCLING_SUPPORTED_EXTENSIONS:
                                docling_files.append(
                                    {
                                        "full_path": full_path,
                                        "rel_path": rel_path,
                                        "file_name": file_name,
                                        "file_size": file_size,
                                        "extension": extension,
                                        "mime_type": mime_type,
                                        "folder_id": folder_id,
                                    }
                                )
                            else:
                                regular_files.append(
                                    {
                                        "full_path": full_path,
                                        "rel_path": rel_path,
                                        "file_name": file_name,
                                        "file_size": file_size,
                                        "extension": extension,
                                        "mime_type": mime_type,
                                        "folder_id": folder_id,
                                    }
                                )

                    # Process regular files
                    for file_info in regular_files:
                        file_record = File(
                            name=file_info["file_name"],
                            file_path="",  # Will be updated after MinIO upload
                            folder_id=(
                                str(file_info["folder_id"])
                                if file_info["folder_id"]
                                else None
                            ),
                            channel_id=channel_id,
                            user_id=user_id,
                            file_size=file_info["file_size"],
                            file_type=file_info["extension"],
                            mime_type=file_info["mime_type"],
                        )
                        await file_record.insert()

                        # Generate MinIO path
                        extension = file_info["extension"]
                        minio_path = (
                            f"{channel_id}/{file_record.id}{extension}"
                            if extension
                            else f"{channel_id}/{file_record.id}"
                        )

                        # Upload to MinIO
                        success = await self._upload_file_to_minio(
                            file_info["full_path"], minio_path, file_info["mime_type"]
                        )

                        if success:
                            file_record.file_path = minio_path
                            await file_record.save()

                            processed_files.append(
                                {
                                    "file_name": file_info["file_name"],
                                    "file_path": minio_path,
                                    "size": file_info["file_size"],
                                    "type": "nested_archive_file",
                                    "mime_type": file_info["mime_type"],
                                    "parent_archive": archive_info["file_name"],
                                }
                            )

                            print(f"Uploaded nested file: {file_info['file_name']}")

                    # Process docling files
                    if docling_files:
                        print(
                            f"Processing {len(docling_files)} docling files from nested archive..."
                        )
                        await self._process_docling_files_batch(
                            docling_files,
                            archive_id,
                            channel_id,
                            user_id,
                            processed_files,
                            batch_size=5,
                        )

                    # Process deeper nested archives recursively
                    if deeper_nested_archives:
                        print(
                            f"Processing {len(deeper_nested_archives)} deeper nested archives..."
                        )
                        await self._process_nested_archives(
                            deeper_nested_archives,
                            archive_id,
                            channel_id,
                            user_id,
                            {**folder_map, **nested_folder_map},
                            processed_files,
                        )

                finally:
                    # Clean up nested temporary directory
                    shutil.rmtree(nested_temp_dir, ignore_errors=True)

            except Exception as e:
                print(
                    f"Error processing nested archive {archive_info['file_name']}: {e}"
                )
                traceback.print_exc()

    async def _create_nested_folder_structure(
        self,
        extract_dir: str,
        parent_folder_id: Optional[str],
        channel_id: str,
    ) -> Dict[str, str]:
        """Create folder structure for nested archive"""
        folder_map = {}

        # Find all directories
        all_dirs = []
        for root, dirs, _ in os.walk(extract_dir):
            for dir_name in dirs:
                full_path = os.path.join(root, dir_name)
                rel_path = os.path.relpath(full_path, extract_dir)
                all_dirs.append(rel_path)

        # Sort to ensure parents are created before children
        all_dirs.sort()

        for rel_path in all_dirs:
            rel_path = rel_path.replace("\\", "/")
            path_obj = Path(rel_path)
            folder_name = path_obj.name

            # Get parent folder path
            parent_path = str(path_obj.parent)
            if parent_path == ".":
                # Top-level nested folder: use parent folder of nested archive
                folder_parent_id = parent_folder_id
            else:
                # Child folder: find parent in folder_map
                parent_path = f"/{parent_path}".replace("\\", "/")
                folder_parent_id = folder_map.get(parent_path)

            # Create folder record
            folder = Folder(
                name=folder_name,
                folder_path=f"/{rel_path}",
                father=str(folder_parent_id) if folder_parent_id else None,
                channel_id=channel_id,
            )
            await folder.insert()
            folder_id = str(folder.id)
            folder_map[f"/{rel_path}"] = folder_id

            print(f"Created nested folder: /{rel_path} -> ID: {folder_id}")

        return folder_map

    def _get_nested_folder_id(
        self,
        rel_path: str,
        parent_folder_id: Optional[str],
        nested_folder_map: Dict[str, str],
    ) -> Optional[str]:
        """Get folder ID for a file in nested archive"""
        path_obj = Path(rel_path)
        parent_path = str(path_obj.parent)

        if parent_path == ".":
            # File at root of nested archive
            return parent_folder_id
        else:
            # File in subfolder
            parent_path = f"/{parent_path}".replace("\\", "/")
            return nested_folder_map.get(parent_path)

    async def _process_docling_files_batch(
        self,
        docling_files: List[Dict],
        archive_id: str,
        channel_id: str,
        user_id: Optional[str],
        processed_files: List[Dict],
        batch_size: int = 5,
    ):
        """
        Process docling files in parallel batches

        Args:
            docling_files: List of file info dicts
            archive_id: Archive ID for reference
            channel_id: Channel ID
            user_id: User ID
            processed_files: List to append results to
            batch_size: Number of files to process in parallel
        """
        from services.docling_service import docling_service

        total_files = len(docling_files)
        processed_count = 0

        # Process files in batches
        for i in range(0, total_files, batch_size):
            batch = docling_files[i : i + batch_size]
            print(
                f"Processing batch {i//batch_size + 1}: files {i+1}-{min(i+batch_size, total_files)}"
            )

            # Create asyncio tasks for this batch
            tasks = []
            for file_info in batch:
                task = asyncio.create_task(
                    self._process_single_docling_file(
                        file_info, archive_id, channel_id, user_id, docling_service
                    )
                )
                tasks.append(task)

            # Wait for all files in batch to complete
            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results
                for idx, result in enumerate(results):
                    if isinstance(result, Exception):
                        print(
                            f"Error processing file {batch[idx]['file_name']}: {result}"
                        )
                    else:
                        processed_files.append(result)
                        processed_count += 1
                        print(f"✓ Processed docling file: {result['file_name']}")

            except Exception as e:
                print(f"Error processing batch {i//batch_size + 1}: {e}")

        print(f"Completed processing {processed_count}/{total_files} docling files")

    async def _process_single_docling_file(
        self,
        file_info: Dict,
        archive_id: str,
        channel_id: str,
        user_id: Optional[str],
        docling_service,
    ) -> Dict:
        """Process a single docling file and return result"""
        try:
            print(f"Processing docling file: {file_info['file_name']}")

            # Process file directly from temp path (no download needed)
            result = await docling_service.extract_and_chunk(file_info["full_path"])

            # Create file record first to get ID
            file_record = File(
                name=file_info["file_name"],
                file_path="",  # Will be updated after MinIO upload
                folder_id=(
                    str(file_info["folder_id"]) if file_info["folder_id"] else None
                ),
                channel_id=channel_id,
                user_id=user_id,
                file_size=file_info["file_size"],
                file_type=file_info["extension"],  # Use file_type to match Meteor model
                mime_type=file_info["mime_type"],
            )
            await file_record.insert()

            # Generate MinIO path
            extension = file_info["extension"]
            minio_path = (
                f"{channel_id}/{file_record.id}{extension}"
                if extension
                else f"{channel_id}/{file_record.id}"
            )

            # Upload to MinIO
            upload_success = await self._upload_file_to_minio(
                file_info["full_path"], minio_path, file_info["mime_type"]
            )

            if not upload_success:
                print(f"Failed to upload {file_info['file_name']} to MinIO")
                return {
                    "file_name": file_info["file_name"],
                    "file_path": minio_path,
                    "size": file_info["file_size"],
                    "type": "docling",
                    "mime_type": file_info["mime_type"],
                    "error": "Failed to upload to MinIO",
                }

            # Update file record with MinIO path
            file_record.file_path = minio_path
            await file_record.save()

            # Upload chunks to Weaviate if available
            chunks = result.get("chunks", [])
            if chunks:
                print(
                    f"Uploading {len(chunks)} chunks to Weaviate for {file_info['file_name']}..."
                )
                from services.weaviate_service import weaviate_service

                # Create collection name based on channel_id (sanitize for Weaviate)
                collection_name = channel_id.replace("-", "_")

                # Try to upload chunks to Weaviate
                try:
                    success = await weaviate_service.upload_chunks(
                        file_path=minio_path,  # This is the correct path for deletion
                        file_name=file_info["file_name"],
                        chunks=chunks,
                        collection_name=collection_name,
                    )
                    if success:
                        print(
                            f"✓ Successfully uploaded chunks to Weaviate collection: {collection_name}"
                        )
                        result["weaviate_uploaded"] = True
                        result["weaviate_collection"] = collection_name
                    else:
                        print("✗ Failed to upload chunks to Weaviate")
                        result["weaviate_uploaded"] = False
                except Exception as e:
                    print(f"✗ Error uploading chunks to Weaviate: {e}")
                    result["weaviate_uploaded"] = False
                    result["weaviate_error"] = str(e)

            return {
                "file_name": file_info["file_name"],
                "file_path": minio_path,
                "size": file_info["file_size"],
                "type": "docling",
                "mime_type": file_info["mime_type"],
                "result": result,  # Include docling processing result with Weaviate info
            }

        except Exception as e:
            print(f"Error processing docling file {file_info['file_name']}: {e}")
            return {
                "file_name": file_info["file_name"],
                "file_path": "",
                "size": file_info.get("file_size", 0),
                "type": "docling",
                "mime_type": file_info.get("mime_type", ""),
                "error": str(e),
            }


# Singleton instance
archive_service = ArchiveService()
