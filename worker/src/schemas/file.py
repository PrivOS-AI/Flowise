from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class FileProcessRequest(BaseModel):
    """Request model for file processing"""
    download_link: str = Field(..., description="URL to download the file")
    filename: str = Field(..., description="Name of the file")
    file_path: str = Field(..., description="Path where the file will be stored")
    channel_id: Optional[str] = Field(default="Document", description="Channel ID for Weaviate collection")


class FileProcessResponse(BaseModel):
    """Response model for file processing"""
    status: str
    chunks_processed: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    file_name: Optional[str] = None


class FileDeleteRequest(BaseModel):
    """Request model for file deletion"""
    file_id: str = Field(..., description="ID of the file to delete")
    file_path: str = Field(..., description="Path of the file to delete")
    collection_name: Optional[str] = Field(default="Document", description="Weaviate collection name")


class FileDeleteResponse(BaseModel):
    """Response model for file deletion"""
    file_id: str
    file_path: str
    collection_name: str
    status: str
    deleted_images_count: Optional[int] = None
    message: str