import asyncio

from services.weaviate_service import weaviate_service


async def clear_weaviate():
    """Clear Weaviate collection"""
    await weaviate_service.connect()
    await weaviate_service.ensure_schema("Document")
    await weaviate_service.client.collections.delete_all()

asyncio.run(clear_weaviate())