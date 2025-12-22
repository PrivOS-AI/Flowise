"""
Format validation utilities for Docling supported file formats
"""
# Standard library imports
import os
from typing import Set, Tuple

# Third-party imports
from docling.datamodel.base_models import InputFormat

# Mapping of file extensions to Docling InputFormat
SUPPORTED_FORMATS = {
    # Documents
    '.pdf': InputFormat.PDF,
    '.docx': InputFormat.DOCX,
    '.pptx': InputFormat.PPTX,
    '.xlsx': InputFormat.XLSX,

    # Web formats
    '.html': InputFormat.HTML,
    '.htm': InputFormat.HTML,
    '.md': InputFormat.MD,
    '.markdown': InputFormat.MD,

    # Text/Structured data
    '.csv': InputFormat.CSV,
    '.asciidoc': InputFormat.ASCIIDOC,
    '.adoc': InputFormat.ASCIIDOC,

    # XML formats
    '.xml': InputFormat.XML_USPTO,  # Default to USPTO for generic XML
    '.jats': InputFormat.XML_JATS,
    '.mets': InputFormat.METS_GBS,

    # Image formats
    '.jpg': InputFormat.IMAGE,
    '.jpeg': InputFormat.IMAGE,
    '.png': InputFormat.IMAGE,
    '.tiff': InputFormat.IMAGE,
    '.tif': InputFormat.IMAGE,
    '.bmp': InputFormat.IMAGE,
    '.gif': InputFormat.IMAGE,

    # Audio formats (for transcription)
    '.wav': InputFormat.AUDIO,
    '.mp3': InputFormat.AUDIO,
    '.flac': InputFormat.AUDIO,
    '.m4a': InputFormat.AUDIO,

    # Subtitle formats
    '.vtt': InputFormat.VTT,

    # JSON
    '.json': InputFormat.JSON_DOCLING,
}


def get_file_extension(filename: str) -> str:
    """
    Get the file extension from a filename

    Args:
        filename: The filename to extract extension from

    Returns:
        The lowercase file extension including the dot (e.g., '.pdf')
    """
    return os.path.splitext(filename.lower())[1]


def is_supported_format(filename: str) -> bool:
    """
    Check if a file format is supported by Docling

    Args:
        filename: The filename to check

    Returns:
        True if the format is supported, False otherwise
    """
    extension = get_file_extension(filename)
    return extension in SUPPORTED_FORMATS


def get_supported_extensions() -> Set[str]:
    """
    Get a set of all supported file extensions

    Returns:
        Set of supported file extensions (including the dot)
    """
    return set(SUPPORTED_FORMATS.keys())


def format_validation_error(filename: str) -> Tuple[bool, str]:
    """
    Validate a file format and return error message if not supported

    Args:
        filename: The filename to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not filename:
        return False, "No filename provided"

    extension = get_file_extension(filename)

    if not extension:
        return False, f"No file extension found in filename: {filename}"

    if extension not in SUPPORTED_FORMATS:
        supported_list = ', '.join(sorted(get_supported_extensions()))
        return False, f"Unsupported file format '{extension}'. Supported formats: {supported_list}"

    return True, ""


# List of all supported format names for documentation
SUPPORTED_FORMAT_NAMES = [
    "PDF documents (.pdf)",
    "Microsoft Word (.docx)",
    "Microsoft PowerPoint (.pptx)",
    "Microsoft Excel (.xlsx)",
    "HTML files (.html, .htm)",
    "Markdown files (.md, .markdown)",
    "CSV files (.csv)",
    "AsciiDoc files (.asciidoc, .adoc)",
    "XML files (.xml, .jats, .mets)",
    "Image files (.jpg, .jpeg, .png, .tiff, .bmp, .gif)",
    "Audio files (.wav, .mp3, .flac, .m4a) - for transcription",
    "WebVTT subtitles (.vtt)",
    "JSON files (.json)",
]