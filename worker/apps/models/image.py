# Standard library imports
from datetime import datetime
from typing import Optional

# Third-party imports
from beanie import Document, Indexed
from pydantic import Field


class Image(Document):
    """
    Image model for storing image metadata
    """

    # File association
    file_path: Indexed(str) = Field(  # pyright: ignore[reportInvalidTypeForm]
        ..., description="Path to the associated source file"
    )

    # Image metadata
    image_ref: Optional[str] = Field(
        None, description="Reference from Docling (self_ref or uri)"
    )

    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(), description="Creation timestamp"
    )

    class Settings:
        name = "images"
        indexes = [
            "file_path",  # Index for querying images by file path
        ]
        use_state_management = True
