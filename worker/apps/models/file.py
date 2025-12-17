from datetime import datetime, timezone
from typing import Optional
from beanie import Document
from pydantic import Field


class File(Document):
    """File model for storing file metadata"""

    name: str
    file_path: str  # Path in MinIO
    folder_id: Optional[str] = None  # Reference to Folder model
    channel_id: str
    user_id: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None  # File extension (matches Meteor's field name)
    mime_type: Optional[str] = None

    # Indexes will be defined in Settings class

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "files"
        indexes = [
            "name",
            "channel_id",
            "folder_id",
            "created_at",
            "file_type",
        ]

    async def save(self, *args, **kwargs):
        """Override save to update updated_at"""
        self.updated_at = datetime.now(timezone.utc)
        return await super().save(*args, **kwargs)


class Folder(Document):
    """Folder model for storing folder hierarchy"""

    name: str
    folder_path: str  # Full path including name, e.g., "/folder/subfolder/"
    father: Optional[str] = None  # Parent folder ID (using 'father' to match Meteor model)
    channel_id: str
    user_id: Optional[str] = None
    zip_id: Optional[str] = None  # Archive file ID that contains this folder

    # Indexes will be defined in Settings class

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "folders"
        indexes = [
            "name",
            "channel_id",
            "father",
            "folder_path",
            "created_at",
        ]

    async def save(self, *args, **kwargs):
        """Override save to update updated_at"""
        self.updated_at = datetime.now(timezone.utc)
        return await super().save(*args, **kwargs)

    async def get_children_folders(self):
        """Get all immediate child folders"""
        return await Folder.find({"father": str(self.id)}).to_list()

    async def get_files(self):
        """Get all files in this folder"""
        return await File.find({"folder_id": str(self.id)}).to_list()

    async def get_all_children(self):
        """Get all descendants recursively"""
        children = await self.get_children_folders()
        all_children = list(children)

        for child in children:
            grand_children = await child.get_all_children()
            all_children.extend(grand_children)

        return all_children


class ArchiveFile(Document):
    """Archive file model for tracking archive file processing (zip, rar, 7z, tar, etc.)"""

    filename: str
    file_path: str  # Path in MinIO
    channel_id: str
    user_id: Optional[str] = None
    file_size: Optional[int] = None
    archive_type: str  # zip, rar, 7z, tar, gzip, etc.

    # Processing status
    status: str = "PENDING"  # PENDING, PROCESSING, COMPLETED, FAILED
    error_message: Optional[str] = None

    # Processing results
    total_files: int = 0
    total_folders: int = 0

    # Job tracking
    job_id: Optional[str] = None

    # MinIO upload tracking
    minio_uploaded: bool = False

    # Indexes will be defined in Settings class

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "archives"
        indexes = [
            "channel_id",
            "created_at",
            "status",
            "job_id",
            "archive_type",
        ]

    async def save(self, *args, **kwargs):
        """Override save to update updated_at"""
        self.updated_at = datetime.now(timezone.utc)
        return await super().save(*args, **kwargs)


# Keep ZipFile for backward compatibility
class ZipFile(Document):
    """Zip file model for tracking zip file processing"""

    filename: str
    file_path: str  # Path in MinIO
    channel_id: str
    user_id: Optional[str] = None
    file_size: Optional[int] = None

    # Processing status
    status: str = "PENDING"  # PENDING, PROCESSING, COMPLETED, FAILED
    error_message: Optional[str] = None

    # Processing results
    total_files: int = 0
    total_folders: int = 0

    # Job tracking
    job_id: Optional[str] = None

    # MinIO upload tracking
    minio_uploaded: bool = False

    # Indexes will be defined in Settings class

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "zipfiles"
        indexes = [
            "channel_id",
            "created_at",
            "status",
            "job_id",
        ]

    async def save(self, *args, **kwargs):
        """Override save to update updated_at"""
        self.updated_at = datetime.now(timezone.utc)
        return await super().save(*args, **kwargs)