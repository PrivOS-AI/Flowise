# Third-party imports
from fastapi import APIRouter

# Local/project imports
from routers import jobs

api_router = APIRouter()

# Include all routers
api_router.include_router(jobs.router)