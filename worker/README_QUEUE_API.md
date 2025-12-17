# File Processing Queue API Service

This FastAPI service provides REST API endpoints to add jobs to a BullMQ queue for file processing. It acts as a producer that communicates with the BullMQ worker to process files asynchronously.

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌────────────────┐
│   Client    │────▶ │ Queue API   │────▶ │  BullMQ Queue  │
│  (HTTP)     │      │  (Producer) │      │    (Redis)     │
└─────────────┘      └─────────────┘      └────────────────┘
                                             │
                                             ▼
                                    ┌────────────────┐
                                    │ BullMQ Worker  │
                                    │  (Consumer)    │
                                    └────────────────┘
```

## Project Structure

```
worker/
├── src/
│   ├── api/v1/
│   │   └── router.py          # API routes
│   ├── core/
│   │   └── config.py          # Configuration
│   ├── routers/
│   │   └── jobs.py            # Job management endpoints
│   ├── schemas/
│   │   └── jobs.py            # Job request/response schemas
│   └── services/
│       └── bullmq_producer.py # BullMQ producer service
├── requirements-producer.txt  # Dependencies
├── run_queue_api.py          # Startup script
└── README_QUEUE_API.md       # This file
```

## Installation

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements-producer.txt
```

3. Configure environment variables in `.env`:
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# API Configuration
HOST=0.0.0.0
PORT=8001
DEBUG=true
```

## Running the Service

Start the Queue API service:
```bash
python run_queue_api.py
```

Or directly with uvicorn:
```bash
uvicorn src.main:app --reload --port 8001
```

## API Endpoints

### Job Management

#### Add a File Processing Job
```http
POST /api/v1/jobs/process-file
Content-Type: application/json

{
  "download_link": "http://example.com/file.pdf",
  "filename": "document.pdf",
  "file_path": "/uploads/document.pdf",
  "channel_id": "Document"
}
```

#### Add an Archive Processing Job
```http
POST /api/v1/jobs/process-archive
Content-Type: application/json

{
  "archive_id": "archive_123",
  "filename": "archive.zip",
  "file_path": "/uploads/archive.zip",
  "channel_id": "Document",
  "user_id": "user_456"
}
```

#### Add a File Deletion Job
```http
POST /api/v1/jobs/delete-file
Content-Type: application/json

{
  "file_id": "file_123",
  "file_path": "/uploads/document.pdf",
  "collection_name": "Document"
}
```

### Job Status

#### Get Job Status
```http
GET /api/v1/jobs/status/{job_id}
```

Response:
```json
{
  "job_id": "1",
  "job_name": "process-file",
  "data": {
    "downloadLink": "...",
    "filename": "...",
    "filePath": "..."
  },
  "status": "completed",
  "progress": 100,
  "finished_on": 1640995200000
}
```

### Queue Management

#### Get Queue Statistics
```http
GET /api/v1/jobs/queue/stats
```

Response:
```json
{
  "queue_name": "file-processing",
  "active": 2,
  "waiting": 5,
  "completed": 100,
  "failed": 1
}
```

#### Clean Queue
```http
POST /api/v1/jobs/queue/clean?completed=true&failed=true
```

## API Documentation

Once the service is running, you can access:
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## Usage Example with Python

```python
import httpx

# Base URL
base_url = "http://localhost:8001"

# Add a file processing job
async def process_file():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/v1/jobs/process-file",
            json={
                "download_link": "https://example.com/document.pdf",
                "filename": "document.pdf",
                "file_path": "/uploads/document.pdf"
            }
        )
        job_info = response.json()
        print(f"Job added with ID: {job_info['job_id']}")

        # Check job status
        status_response = await client.get(
            f"{base_url}/api/v1/jobs/status/{job_info['job_id']}"
        )
        print(f"Job status: {status_response.json()}")
```

## Prerequisites

1. **Redis Server**: Must be running for BullMQ
   ```bash
   redis-server
   ```

2. **BullMQ Worker**: Must be running to process jobs
   ```bash
   python worker/apps/main.py
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server host | localhost |
| `REDIS_PORT` | Redis server port | 6379 |
| `REDIS_PASSWORD` | Redis password (optional) | None |
| `HOST` | API server host | 0.0.0.0 |
| `PORT` | API server port | 8001 |
| `DEBUG` | Enable debug mode | false |

## Benefits

- **Asynchronous Processing**: Jobs are queued and processed in the background
- **Scalability**: Multiple workers can process jobs from the same queue
- **Reliability**: BullMQ provides job retries and error handling
- **Monitoring**: Built-in job status tracking and queue statistics
- **REST API**: Easy integration with any HTTP client

## Difference from Direct FastAPI Implementation

Unlike the direct FastAPI implementation that processes files synchronously, this service:
1. Adds jobs to a queue instead of processing immediately
2. Returns a job ID immediately for status tracking
3. Allows multiple workers to process jobs in parallel
4. Provides better error handling through BullMQ's retry mechanisms
5. Decouples the API from the processing logic