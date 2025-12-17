from pydantic import BaseModel, Field
from typing import Optional


class ArchiveProcessRequest(BaseModel):
    """Request model for archive processing"""
    archive_id: str = Field(..., description="ID of the archive file")
    filename: str = Field(..., description="Name of the archive file")
    file_path: str = Field(..., description="Path of the archive file")
    channel_id: Optional[str] = Field(default=None, description="Channel ID for Weaviate collection")
    user_id: Optional[str] = Field(default=None, description="User ID")


class ArchiveProcessResponse(BaseModel):
    """Response model for archive processing"""
    archive_id: str
    total_folders: int = Field(default=0, description="Total number of folders extracted")
    total_files: int = Field(default=0, description="Total number of files extracted")
    processed_files: int = Field(default=0, description="Number of successfully processed files")
    failed_files: int = Field(default=0, description="Number of failed files")
    message: str