# File Processing Service - FastAPI Implementation

This directory contains the FastAPI implementation of the file processing worker. The service provides REST API endpoints for processing files and archives, replacing the BullMQ-based worker with HTTP endpoints.

## Project Structure

```
worker/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── router.py      # API router combining all endpoints
│   ├── core/
│   │   ├── config.py          # Application configuration
│   │   └── security.py        # Security utilities
│   ├── db/
│   │   └── mongodb.py         # MongoDB connection management
│   ├── models/                # Pydantic models (can be imported from worker/apps)
│   ├── routers/
│   │   ├── archives.py        # Archive processing endpoints
│   │   └── files.py           # File processing endpoints
│   ├── schemas/
│   │   ├── archive.py         # Archive request/response schemas
│   │   └── file.py            # File request/response schemas
│   ├── services/
│   │   ├── archive_service.py # Archive processing service
│   │   ├── delete_service.py  # File deletion service
│   │   ├── docling_service.py # Wrapper for existing Docling service
│   │   ├── file_service.py    # File processing service
│   │   ├── mongodb_service.py # Wrapper for existing MongoDB service
│   │   └── weaviate_service.py# Wrapper for existing Weaviate service
│   ├── utils/
│   │   └── format_validator.py# Wrapper for existing format validator
│   └── main.py                # FastAPI application entry point
├── .env.fastapi               # Environment configuration template
├── requirements-fastapi.txt   # FastAPI dependencies
└── README_FASTAPI.md          # This file
```

## Installation

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install FastAPI dependencies:
```bash
pip install -r requirements-fastapi.txt
```

3. Copy and configure the environment file:
```bash
cp .env.fastapi .env
# Edit .env with your configuration
```

## Running the Service

Development mode:
```bash
uvicorn app.main:app --reload
```

Production mode:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Files

#### Process a file
```http
POST /api/v1/files/process
Content-Type: application/json

{
  "download_link": "http://example.com/file.pdf",
  "filename": "document.pdf",
  "file_path": "/uploads/document.pdf",
  "channel_id": "Document"
}
```

#### Delete a file
```http
DELETE /api/v1/files/delete
Content-Type: application/json

{
  "file_id": "file_123",
  "file_path": "/uploads/document.pdf",
  "collection_name": "Document"
}
```

#### Get file status
```http
GET /api/v1/files/status/{file_id}
```

### Archives

#### Process an archive
```http
POST /api/v1/archives/process
Content-Type: application/json

{
  "archive_id": "archive_123",
  "filename": "archive.zip",
  "file_path": "/uploads/archive.zip",
  "channel_id": "Document",
  "user_id": "user_456"
}
```

#### Get archive status
```http
GET /api/v1/archives/status/{archive_id}
```

## API Documentation

Once the service is running, you can access:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Key Differences from BullMQ Worker

1. **HTTP API vs Message Queue**: The FastAPI service exposes REST endpoints instead of listening to a BullMQ queue
2. **Synchronous Responses**: Processing happens synchronously and returns immediate results
3. **No Job Queue**: For background processing, you'll need to implement a job tracking system or use FastAPI's BackgroundTasks
4. **Stateless**: Each request is independent; you'll need external storage for job status tracking

## Migration Considerations

To migrate from BullMQ to FastAPI:

1. **Client Changes**: Update clients to make HTTP requests instead of queue jobs
2. **Error Handling**: Implement proper HTTP error responses
3. **Status Tracking**: Add a job status tracking system if needed
4. **Rate Limiting**: Consider adding rate limiting for production use
5. **Authentication**: Implement authentication/authorization as needed

## Environment Variables

The service uses the same environment variables as the original worker, plus additional FastAPI-specific variables:

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Enable debug mode (default: false)
- `APP_NAME`: Application name
- `APP_VERSION`: Application version

## Dependencies

The FastAPI implementation depends on all existing worker services. The wrapper files in `app/services/` import the existing implementations to avoid code duplication.