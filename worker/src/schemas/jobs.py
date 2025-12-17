from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class FileProcessJobRequest(BaseModel):
    """Request model for adding a file processing job"""
    download_link: str = Field(..., description="URL to download the file")
    filename: str = Field(..., description="Name of the file")
    file_path: str = Field(..., description="Path where the file will be stored")
    channel_id: Optional[str] = Field(default="Document", description="Channel ID for Weaviate collection")


class ArchiveProcessJobRequest(BaseModel):
    """Request model for adding an archive processing job"""
    archive_id: str = Field(..., description="ID of the archive file")
    filename: str = Field(..., description="Name of the archive file")
    file_path: str = Field(..., description="Path of the archive file")
    channel_id: Optional[str] = Field(default=None, description="Channel ID for Weaviate collection")
    user_id: Optional[str] = Field(default=None, description="User ID")


class DeleteFileJobRequest(BaseModel):
    """Request model for adding a file deletion job"""
    file_id: str = Field(..., description="ID of the file to delete")
    file_path: str = Field(..., description="Path of the file to delete")
    collection_name: Optional[str] = Field(default="Document", description="Weaviate collection name")


class JobResponse(BaseModel):
    """Response model for job submission"""
    job_id: str = Field(..., description="ID of the queued job")
    job_name: str = Field(..., description="Name/type of the job")
    data: Dict[str, Any] = Field(..., description="Job data")
    queue: str = Field(..., description="Queue name")
    status: str = Field(..., description="Initial status of the job")


class JobStatusResponse(BaseModel):
    """Response model for job status"""
    job_id: Optional[str] = Field(None, description="ID of the job")
    job_name: Optional[str] = Field(None, description="Name/type of the job")
    data: Optional[Dict[str, Any]] = Field(None, description="Job data")
    status: Optional[str] = Field(None, description="Current status of the job")
    progress: Optional[int] = Field(None, description="Job progress (0-100)")
    finished_on: Optional[int] = Field(None, description="Timestamp when job finished")
    processed_on: Optional[int] = Field(None, description="Timestamp when job was processed")
    failed_reason: Optional[str] = Field(None, description="Reason for failure if job failed")


class QueueStatsResponse(BaseModel):
    """Response model for queue statistics"""
    queue_name: str = Field(..., description="Name of the queue")
    active: int = Field(default=0, description="Number of active jobs")
    waiting: int = Field(default=0, description="Number of waiting jobs")
    completed: int = Field(default=0, description="Number of completed jobs")
    failed: int = Field(default=0, description="Number of failed jobs")