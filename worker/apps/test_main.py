import asyncio

from services.weaviate_service import weaviate_service


async def search_with_embeddings():
    """Search Weaviate and display all fields including embeddings"""

    # Connect to Weaviate
    await weaviate_service.connect()

    # Search query
    # query = input("Enter search query: ")
    # limit = int(input("Enter number of results (default 10): ") or "10")

    # print(f"\n🔍 Searching for: '{query}'")
    print("=" * 80)

    # Ensure collection exists
    await weaviate_service.ensure_schema("GENERAL")

    # Get the collection
    collection = weaviate_service.client.collections.get("GENERAL")

    result = await collection.query.near_text("http://localhost")
    import pdb; pdb.set_trace()

import asyncio

asyncio.run(search_with_embeddings())
