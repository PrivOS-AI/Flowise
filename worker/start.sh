#!/bin/bash

# File Processing Services Start Script
# This script starts both FastAPI Queue Service and Worker

echo "🚀 Starting File Processing Services..."
echo ""

# Set the worker directory
WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed or not in PATH"
    exit 1
fi

# Run the services
echo "🚀 Starting both services..."
cd "$WORKER_DIR"
python run_services.py