#!/usr/bin/env python3
"""
Script to run the FastAPI file processing service
"""

import os
import sys
import subprocess
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
from dotenv import load_dotenv

# Try to load .env file first, then .env.fastapi
if os.path.exists('.env'):
    load_dotenv('.env')
    print("Loaded .env file")
elif os.path.exists('.env.fastapi'):
    load_dotenv('.env.fastapi')
    print("Loaded .env.fastapi file")

# Import settings to validate environment
try:
    from src.core.config import settings
    print(f"Configuration loaded successfully")
    print(f"  - MongoDB: {settings.mongo_uri.split('@')[-1] if '@' in settings.mongo_uri else settings.mongo_uri}")
    print(f"  - Weaviate: {settings.weaviate_url}")
    print(f"  - Server: {settings.host}:{settings.port}")
except Exception as e:
    print(f"Error loading configuration: {e}")
    sys.exit(1)

# Run the FastAPI application
if __name__ == "__main__":
    print("\n🚀 Starting FastAPI file processing service...")
    print("=" * 60)

    # Use uvicorn to run the application
    subprocess.run([
        "uvicorn",
        "app.main:app",
        "--host", settings.host,
        "--port", str(settings.port),
        "--reload" if settings.debug else "",
        "--log-level", "info"
    ], check=True)