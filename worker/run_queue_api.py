#!/usr/bin/env python3
"""
Script to run the FastAPI BullMQ Queue Producer service
"""

import os
import sys
import subprocess
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
from dotenv import load_dotenv

# Try to load .env file
if os.path.exists('.env'):
    load_dotenv('.env')
    print("Loaded .env file")

# Import settings to validate environment
try:
    from src.core.config import settings
    print(f"Configuration loaded successfully")
    print(f"  - Redis: {settings.redis_host}:{settings.redis_port}")
    print(f"  - Queue: {settings.queue_name}")
    print(f"  - Server: {settings.host}:{settings.port}")
except Exception as e:
    print(f"Error loading configuration: {e}")
    sys.exit(1)

# Run the FastAPI application
if __name__ == "__main__":
    print("\n🚀 Starting BullMQ Queue Producer Service...")
    print("=" * 60)
    print("This service provides REST API endpoints to add jobs to BullMQ queue")
    print("Make sure the BullMQ worker is running to process the jobs")
    print("=" * 60)

    # Use uvicorn to run the application
    subprocess.run([
        "uvicorn",
        "src.main:app",
        "--host", settings.host,
        "--port", str(settings.port),
        "--reload" if settings.debug else "",
        "--log-level", "info"
    ], check=True)