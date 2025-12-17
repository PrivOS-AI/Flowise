import asyncio
import io
import os
from datetime import timedelta
from typing import Optional
from urllib.parse import urljoin

from minio import Minio
from minio.error import S3Error

from core.config import settings


class MinIOService:
    """MinIO service for file operations"""

    def __init__(self):
        self.client: Optional[Minio] = None
        self.bucket = settings.minio_bucket
        self.endpoint = settings.minio_endpoint
        self.access_key = settings.minio_access_key
        self.secret_key = settings.minio_secret_key
        self.secure = getattr(settings, 'minio_secure', False)

        self._initialize_client()

    def _initialize_client(self):
        """Initialize MinIO client"""
        try:
            self.client = Minio(
                endpoint=self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure
            )

            # Ensure bucket exists
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket, region=self.region)
                print(f"✓ Created MinIO bucket: {self.bucket}")
            else:
                print(f"✓ MinIO bucket exists: {self.bucket}")

        except Exception as e:
            print(f"❌ Failed to initialize MinIO client: {e}")
            self.client = None

    async def upload_file(
        self,
        object_name: str,
        file_data: bytes | io.BytesIO,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None
    ) -> bool:
        """Upload file to MinIO"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return False

        try:
            # Convert bytes to BytesIO if needed
            if isinstance(file_data, bytes):
                file_data = io.BytesIO(file_data)

            # Wrap synchronous call in asyncio.to_thread to avoid blocking
            await asyncio.to_thread(
                self.client.put_object,
                self.bucket,
                object_name,
                file_data,
                length=file_data.getbuffer().nbytes,
                content_type=content_type,
                metadata=metadata or {}
            )
            print(f"✓ Uploaded file to MinIO: {object_name}")
            return True

        except Exception as e:
            print(f"❌ Failed to upload file to MinIO: {e}")
            return False

    async def download_file(self, object_name: str) -> Optional[bytes]:
        """Download file from MinIO"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return None

        try:
            # Wrap synchronous call in asyncio.to_thread to avoid blocking
            response = await asyncio.to_thread(
                self.client.get_object,
                self.bucket,
                object_name
            )

            # Read the data
            data = response.read()
            response.close()
            response.release_conn()

            print(f"✓ Downloaded file from MinIO: {object_name}")
            return data

        except S3Error as e:
            if e.code == "NoSuchKey":
                print(f"⚠ File not found in MinIO: {object_name}")
                return None
            print(f"❌ Failed to download file from MinIO: {e}")
            return None
        except Exception as e:
            print(f"❌ Failed to download file from MinIO: {e}")
            return None

    async def download_file_to_path(self, object_name: str, file_path: str) -> bool:
        """Download file from MinIO to local path"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return False

        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)

            # Wrap synchronous call in asyncio.to_thread to avoid blocking
            await asyncio.to_thread(
                self.client.fget_object,
                self.bucket,
                object_name,
                file_path
            )

            print(f"✓ Downloaded file from MinIO to: {file_path}")
            return True

        except S3Error as e:
            if e.code == "NoSuchKey":
                print(f"⚠ File not found in MinIO: {object_name}")
                return False
            print(f"❌ Failed to download file from MinIO: {e}")
            return False
        except Exception as e:
            print(f"❌ Failed to download file from MinIO: {e}")
            return False

    async def delete_file(self, object_name: str) -> bool:
        """Delete file from MinIO"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return False

        try:
            await asyncio.to_thread(
                self.client.remove_object,
                self.bucket,
                object_name
            )
            print(f"✓ Deleted file from MinIO: {object_name}")
            return True

        except Exception as e:
            print(f"❌ Failed to delete file from MinIO: {e}")
            return False

    async def file_exists(self, object_name: str) -> bool:
        """Check if file exists in MinIO"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return False

        try:
            await asyncio.to_thread(
                self.client.stat_object,
                self.bucket,
                object_name
            )
            return True

        except S3Error as e:
            if e.code == "NoSuchKey":
                return False
            print(f"❌ Failed to check file existence: {e}")
            return False
        except Exception as e:
            print(f"❌ Failed to check file existence: {e}")
            return False

    async def list_files(self, prefix: str = "", recursive: bool = False) -> list:
        """List files in MinIO bucket"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return []

        try:
            objects = await asyncio.to_thread(
                lambda: list(self.client.list_objects(self.bucket, prefix=prefix, recursive=recursive))
            )

            # Filter out directories (objects that end with '/')
            files = [obj for obj in objects if not obj.object_name.endswith("/")]
            return files

        except Exception as e:
            print(f"❌ Failed to list files: {e}")
            return []

    async def get_presigned_url(self, object_name: str, expires: int = 3600) -> Optional[str]:
        """Get presigned URL for file download"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return None

        try:
            # Convert expires seconds to timedelta
            expires_delta = timedelta(seconds=expires)
            url = await asyncio.to_thread(
                self.client.presigned_get_object,
                self.bucket,
                object_name,
                expires=expires_delta
            )
            return url

        except Exception as e:
            print(f"❌ Failed to generate presigned URL: {e}")
            return None

    async def get_presigned_upload_url(self, object_name: str, expires: int = 3600) -> Optional[str]:
        """Get presigned URL for file upload"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return None

        try:
            # Convert expires seconds to timedelta
            expires_delta = timedelta(seconds=expires)
            url = await asyncio.to_thread(
                self.client.presigned_put_object,
                self.bucket,
                object_name,
                expires=expires_delta
            )
            return url

        except Exception as e:
            print(f"❌ Failed to generate presigned upload URL: {e}")
            return None

    async def copy_file(self, source_object: str, destination_object: str) -> bool:
        """Copy file within MinIO"""
        if not self.client:
            print("❌ MinIO client not initialized")
            return False

        try:
            from minio.copyobj import CopyObjectResult

            result = await asyncio.to_thread(
                self.client.copy_object,
                self.bucket,
                destination_object,
                self.bucket + "/" + source_object
            )

            print(f"✓ Copied file in MinIO: {source_object} -> {destination_object}")
            return True

        except Exception as e:
            print(f"❌ Failed to copy file: {e}")
            return False

    async def move_file(self, source_object: str, destination_object: str) -> bool:
        """Move file within MinIO (copy + delete)"""
        if await self.copy_file(source_object, destination_object):
            return await self.delete_file(source_object)
        return False


# Singleton instance
minio_service = MinIOService()