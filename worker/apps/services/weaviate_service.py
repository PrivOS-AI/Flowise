import asyncio
from typing import Any, Dict, List

import weaviate
from core.config import settings
from weaviate.classes.config import Configure, DataType, Property
from weaviate.classes.query import Filter
from weaviate.classes.init import Auth
from weaviate.config import AdditionalConfig, Timeout

# -------------------------------------------------------------------------


class WeaviateService:
    def __init__(self):
        # Use the new authentication configuration
        self.client = weaviate.use_async_with_custom(
            http_host=settings.weaviate_http_host,
            http_port=settings.weaviate_http_port,
            http_secure=False,
            grpc_host=settings.weaviate_grpc_host,
            grpc_port=settings.weaviate_grpc_port,
            grpc_secure=False,
            auth_credentials=Auth.api_key(settings.weaviate_api_key),
            headers={
                "X-OpenAI-Api-Key": settings.ollama_api_key,
            },
        )
        self._connected = False

    async def connect(self):
        """Connect to Weaviate if not already connected"""
        if not self._connected:
            await self.client.connect()
            self._connected = True

    async def ensure_connected(self):
        """Ensure connection before performing operations"""
        if not self._connected:
            await self.connect()

    async def create_collection(self, name: str):
        """Tạo collection mới với Ollama vectorizer"""
        # Add vs_ prefix if not already present
        collection_name = name if name.startswith("vs_") else f"vs_{name}"

        try:
            return await self.client.collections.create(
                name=collection_name,
                vectorizer_config=[
                    Configure.NamedVectors.text2vec_openai(
                        name="default",
                        source_properties=["content"],
                        base_url=settings.ollama_api_endpoint,
                        model="qwen3-embedding:8b",
                    )
                ],
                properties=[
                    Property(
                        name="file_path", data_type=DataType.TEXT, skip_vectorization=True
                    ),
                    Property(
                        name="page_no", data_type=DataType.INT, skip_vectorization=True
                    ),
                    Property(
                        name="file_name", data_type=DataType.TEXT, skip_vectorization=True
                    ),
                    Property(name="content", data_type=DataType.TEXT),
                ],
            )
        except Exception as e:
            # If collection already exists, ignore the error
            if "already exists" in str(e).lower():
                print(f"Collection {name} already exists, skipping creation")
                return
            raise e

    async def ensure_schema(self, collection_name: str = "Document"):
        """Ensure collection exists in Weaviate"""
        # Ensure we're connected first
        await self.ensure_connected()

        # Add vs_ prefix if not already present
        full_collection_name = collection_name if collection_name.startswith("vs_") else f"vs_{collection_name}"

        try:
            # Check if collection exists
            if not await self.client.collections.exists(full_collection_name):
                # Create collection using create_collection method
                await self.create_collection(collection_name)  # create_collection will add prefix
                print(f"Created {full_collection_name} collection in Weaviate")
            else:
                print(f"Collection {full_collection_name} already exists in Weaviate")
        except Exception as e:
            print(f"Error ensuring collection: {e}")

    async def upload_chunks(
        self,
        file_path: str,
        file_name: str,
        chunks: List[Dict[str, Any]],
        collection_name: str = "Document",
    ) -> bool:
        """Upload document chunks to Weaviate"""
        try:
            # Ensure collection exists
            await self.ensure_schema(collection_name)

            # Add vs_ prefix if not already present
            full_collection_name = collection_name if collection_name.startswith("vs_") else f"vs_{collection_name}"

            # Get the collection
            collection = self.client.collections.get(full_collection_name)

            # Prepare data objects
            data_objects = []
            for chunk in enumerate(chunks):
                data_obj = {
                    "content": chunk[1]["text"],
                    "file_path": file_path,
                    "file_name": file_name,
                    "page_no": chunk[1].get("page"),
                }
                data_objects.append(data_obj)

            # Use async batch upload with asyncio.gather for parallel processing
            batch_size = 10

            # Create batches
            batches = [
                data_objects[i : i + batch_size]
                for i in range(0, len(data_objects), batch_size)
            ]

            # Process all batches in parallel
            async def process_batch(batch_data, batch_index):
                insert_result = await collection.data.insert_many(batch_data)

                # Check if insertion was successful
                if hasattr(insert_result, "errors") and insert_result.errors:
                    print(
                        f"Warning: Batch {batch_index + 1} failed to insert: {insert_result.errors}"
                    )
                    return 0
                elif hasattr(insert_result, "has_errors") and insert_result.has_errors:
                    print(f"Warning: Batch {batch_index + 1} failed to insert")
                    return 0
                else:
                    print(
                        f"Successfully inserted batch {batch_index + 1} with {len(batch_data)} objects"
                    )
                    return len(batch_data)

            # Process all batches concurrently
            results = await asyncio.gather(
                *[process_batch(batch, i) for i, batch in enumerate(batches)],
                return_exceptions=True,
            )

            # Calculate total inserted
            total_inserted = 0
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    print(f"Error processing batch {i + 1}: {result}")
                else:
                    total_inserted += result

            if total_inserted == len(data_objects):
                print(f"Successfully uploaded all {total_inserted} chunks to Weaviate")
            else:
                print(
                    f"Uploaded {total_inserted} out of {len(data_objects)} chunks to Weaviate"
                )
            return True
        except Exception as e:
            print(f"Error uploading chunks to Weaviate: {e}")
            return False

    async def search_documents(
        self, query: str, limit: int = 10, collection_name: str = "Document"
    ) -> List[Dict[str, Any]]:
        """Search documents in Weaviate"""
        try:
            # Ensure we're connected first
            await self.ensure_connected()

            # Add vs_ prefix if not already present
            full_collection_name = collection_name if collection_name.startswith("vs_") else f"vs_{collection_name}"

            # Get the collection
            collection = self.client.collections.get(full_collection_name)

            # Search with near text
            result = await collection.query.near_text(
                query=query,
                limit=limit,
                return_properties=["content", "file_path", "file_name", "page_no"],
            )

            return result.objects
        except Exception as e:
            print(f"Error searching documents: {e}")
            return []

    async def delete_by_file_path(
        self, file_path: str, collection_name: str = "Document"
    ) -> bool:
        """Delete all documents with the specified file_path from Weaviate"""
        try:
            # Ensure we're connected first
            await self.ensure_connected()

            # Add vs_ prefix if not already present
            full_collection_name = collection_name if collection_name.startswith("vs_") else f"vs_{collection_name}"

            # Get the collection
            collection = self.client.collections.use(full_collection_name)

            # First, let's count how many objects will be deleted
            count_result = await collection.query.fetch_objects(
                filters=Filter.by_property("file_path").equal(file_path),
                return_properties=["file_path"],
            )

            delete_count = len(count_result.objects)
            print(
                f"Found {delete_count} documents to delete with file_path: {file_path}"
            )

            if delete_count == 0:
                print(f"No documents found with file_path: {file_path}")
                return True

            # Delete all objects with the specified file_path using Filter
            delete_result = await collection.data.delete_many(
                where=Filter.by_property("file_path").equal(file_path)
            )

            print(f"Delete result: {delete_result}")

            # Check if we have a successful result
            if hasattr(delete_result, "successful") and delete_result.successful > 0:
                print(
                    f"Successfully deleted {delete_result.successful} documents with file_path: {file_path}"
                )
                return True
            elif hasattr(delete_result, "matches") and delete_result.matches > 0:
                print(
                    f"Successfully deleted {delete_result.matches} documents with file_path: {file_path}"
                )
                return True
            else:
                print(
                    f"No documents were deleted for file_path: {file_path}. Result: {delete_result}"
                )
                return False

        except Exception as e:
            print(f"Error deleting documents by file_path {file_path}: {e}")
            import traceback

            traceback.print_exc()
            return False


# Singleton instance
weaviate_service = WeaviateService()
