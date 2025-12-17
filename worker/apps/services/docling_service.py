import asyncio
import aiohttp
import base64
import os
import shutil
import tempfile
import time
import warnings
from typing import Any, Dict, List
from urllib.parse import urlparse, unquote

from core.config import settings
from docling.chunking import HybridChunker
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import (AcceleratorDevice,
                                                AcceleratorOptions,
                                                PdfPipelineOptions)
from docling.document_converter import DocumentConverter, PdfFormatOption
from openai import AsyncOpenAI
from pdf2image import convert_from_path
from PIL import Image
from pypdf import PdfReader


# ------------------------------------------------------------------------------
class DoclingService:
    def __init__(self):
        accelerator_options = AcceleratorOptions(
            num_threads=8, device=AcceleratorDevice.CUDA
        )

        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = accelerator_options
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = True
        pipeline_options.generate_picture_images = False  # Disable image generation

        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )

        self.chunker = HybridChunker(max_tokens=4096)

        # Initialize Async OpenAI client for OCR
        self.ocr_client = AsyncOpenAI(
            api_key=settings.ollama_api_key,
            base_url=f"{settings.ollama_api_endpoint}/v1",
            timeout=3600
        )

        # Store downloaded file paths to avoid re-downloading
        self._downloaded_files: Dict[str, str] = {}

    async def _download_file_for_ocr(self, file_path: str) -> str:
        """Download file from MinIO/URL if needed for OCR (with caching)

        Args:
            file_path: File path in MinIO or URL

        Returns:
            Local file path for OCR processing
        """
        # Check cache first
        if file_path in self._downloaded_files:
            cached_path = self._downloaded_files[file_path]
            if os.path.exists(cached_path):
                print(f"Using cached file: {cached_path}")
                return cached_path
            else:
                # Remove from cache if file no longer exists
                del self._downloaded_files[file_path]

        # If file_path is already a local file that exists, return it
        if os.path.exists(file_path):
            return file_path

        # If file_path looks like a URL, download it
        if file_path.startswith(('http://', 'https://')):
            temp_dir = tempfile.mkdtemp(prefix="ocr_download_")
            # Extract filename from URL, removing query parameters
            parsed_url = urlparse(file_path)
            filename = os.path.basename(parsed_url.path) or f"file_{int(time.time())}.pdf"
            # Decode URL-encoded characters in filename
            filename = unquote(filename)
            local_path = os.path.join(temp_dir, filename)

            print(f"Downloading file from {file_path} to {local_path}")
            async with aiohttp.ClientSession() as session:
                async with session.get(file_path) as response:
                    if response.status == 200:
                        with open(local_path, 'wb') as f:
                            async for chunk in response.content.iter_chunked(8192):
                                f.write(chunk)
                        print(f"Downloaded {os.path.getsize(local_path)} bytes")
                        # Cache the downloaded file
                        self._downloaded_files[file_path] = local_path
                        return local_path
                    else:
                        raise Exception(f"Failed to download file: HTTP {response.status}")

        # If it's a MinIO path, construct the full URL
        # This assumes the pattern: GENERAL/filename
        if '/' in file_path:
            # Try to construct URL from MinIO path
            # You might need to adjust this based on your MinIO setup
            minio_url = f"{settings.minio_endpoint}/{settings.minio_bucket}/{file_path}"
            print(f"Trying MinIO URL: {minio_url}")
            return await self._download_file_for_ocr(minio_url)

        raise Exception(f"Cannot determine how to download file: {file_path}")

    async def _process_with_ocr(self, file_path: str, title: str, local_file_path: str = None) -> Dict[str, Any]:
        """Process file with OCR and return chunks with metadata

        Args:
            file_path: Path to the file (PDF or TIFF) or MinIO path
            title: Title for the document (usually filename)
            local_file_path: Optional local file path if already downloaded

        Returns:
            Dictionary with chunks, image_mappings, and metadata
        """
        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext == '.pdf':
            print("Detected scanned PDF, using OCR...")
        elif file_ext in ['.tif', '.tiff']:
            print("Processing TIFF file, using OCR...")

        # Use provided local_file_path or download if needed
        if not local_file_path:
            local_file_path = await self._download_file_for_ocr(file_path)

        temp_dir = None

        try:
            # Perform OCR
            print(f"Starting OCR for {local_file_path}")
            ocr_result, page_count = await self._ocr_document(local_file_path)
            print(f"OCR completed. Result length: {len(ocr_result) if ocr_result else 0}, Page count: {page_count}")

            if ocr_result:
                print(f"OCR result preview: {ocr_result[:500]}...")  # Print first 500 chars
                # Create chunks from OCR result
                chunks = await self._create_chunks_from_text(ocr_result)
                print(f"Created {len(chunks)} chunks from OCR result")

                return {
                    "chunks": chunks,
                    "image_mappings": {},
                    "metadata": {
                        "page_count": page_count,  # Actual page count
                        "title": title,
                        "image_count": 0,
                        "ocr_used": True,
                    },
                }
            else:
                print("OCR failed - no result returned")
                return {"chunks": [], "image_mappings": {}, "metadata": {}}
        finally:
            # Clean up downloaded file if it was temporary
            if local_file_path != file_path and os.path.exists(local_file_path):
                temp_dir = os.path.dirname(local_file_path)
                os.remove(local_file_path)
                if os.path.exists(temp_dir):
                    os.rmdir(temp_dir)
                print(f"Cleaned up temporary file: {local_file_path}")

    async def extract_and_chunk_from_stream(
        self, stream, filename: str, file_path: str = None, download_link: str = None
    ) -> Dict[str, Any]:
        """Extract text from document stream and create chunks"""
        try:
            # Check if file is TIFF
            file_ext = os.path.splitext(filename)[1].lower()
            local_file_path = None

            # Download file for scanning detection if needed (PDF only)
            if file_ext == '.pdf' and (download_link or file_path):
                print("Downloading PDF for scan detection...")
                # Use download_link first, then file_path as fallback
                ocr_path = download_link or file_path
                local_file_path = await self._download_file_for_ocr(ocr_path)

            # Check if file is TIFF
            if file_ext in ['.tif', '.tiff'] and file_path:
                print("Processing TIFF file from stream, using OCR...")
                # TIFF files need OCR directly from file path
                return await self._process_with_ocr(file_path, filename)

            # For PDF and other files, use Docling
            # For stream processing with OCR, we need to save to a temporary file first
            # Create DocumentStream from BytesIO
            doc_stream = DocumentStream(name=filename, stream=stream)

            # Run the blocking docling operations in a thread pool
            loop = asyncio.get_event_loop()

            # Convert document using default pipeline
            print("Processing document from stream...")
            result = await loop.run_in_executor(
                None, self.converter.convert, doc_stream
            )

            # Check if PDF is scanned using pypdf (faster and more accurate)
            is_scanned = False
            if local_file_path:
                print("Checking if PDF is scanned...")
                is_scanned = self._is_scanned_pdf(local_file_path)
                print(f"PDF is scanned: {is_scanned}")
            else:
                # For other files or if no file downloaded, use Docling output
                full_text = result.document.export_to_markdown()
                print(f"Docling extracted text length: {len(full_text)}")
                print(f"Text preview: {full_text[:300]}...")

                # Check if the extracted text is meaningful
                is_scanned = not await self._has_meaningful_text(full_text)

                # Special case: if text only contains image placeholders, it's scanned
                if "<!-- image -->" in full_text and full_text.count("<!-- image -->") > 2:
                    is_scanned = True
                    print(f"Detected image-only document (found {full_text.count('<!-- image -->')} image placeholders)")

                print(f"Is scanned document: {is_scanned}")

            if is_scanned:
                # Use OCR for scanned PDF
                # Use the downloaded file if available, otherwise download_link or file_path
                ocr_path = download_link or file_path
                print(f"Using OCR for scanned PDF with path: {ocr_path}")
                return await self._process_with_ocr(ocr_path, filename, local_file_path)

            # If not scanned, use the original result
            # Create chunks from the document
            print("Creating chunks from document...")
            chunks = await self._create_chunks_from_document(result.document)
            print(f"Created {len(chunks)} chunks from document")

            return {
                "chunks": chunks,
                "image_mappings": {},  # Empty since we're not processing images
                "metadata": {
                    "page_count": (
                        len(result.document.pages)
                        if hasattr(result.document, "pages")
                        else 0
                    ),
                    "title": (
                        result.document.title
                        if hasattr(result.document, "title")
                        else filename
                    ),
                    "image_count": 0,  # No images processed
                    "ocr_used": False,
                },
            }
        except Exception as e:
            print(f"Error extracting text with Docling from stream: {e}")
            return {"chunks": [], "image_mappings": {}, "metadata": {}}

    async def extract_and_chunk(self, file_path: str) -> Dict[str, Any]:
        """Extract text from document and create chunks"""
        try:
            # Check if file is TIFF - TIFF files need OCR directly
            file_ext = os.path.splitext(file_path)[1].lower()
            if file_ext in ['.tif', '.tiff']:
                print("Processing TIFF file, using OCR directly...")
                # TIFF files need OCR directly
                return await self._process_with_ocr(file_path, os.path.basename(file_path))

            # For PDF files, use Docling first
            # Run the blocking docling operations in a thread pool
            loop = asyncio.get_event_loop()

            # Convert document using default pipeline first
            print("Processing document...")
            result = await loop.run_in_executor(None, self.converter.convert, file_path)

            # For PDF files, check if scanned using pypdf (faster and more accurate)
            print("Checking if PDF is scanned...")
            is_scanned = self._is_scanned_pdf(file_path)
            print(f"PDF is scanned: {is_scanned}")

            if is_scanned:
                # Use OCR for scanned PDF
                return await self._process_with_ocr(file_path, os.path.basename(file_path))

            # If not scanned or OCR failed, use the original result
            # Create chunks from the document
            print("Creating chunks from document...")
            chunks = await self._create_chunks_from_document(result.document)
            print(f"Created {len(chunks)} chunks from document")

            return {
                "chunks": chunks,
                "image_mappings": {},  # Empty since we're not processing images
                "metadata": {
                    "page_count": (
                        len(result.document.pages)
                        if hasattr(result.document, "pages")
                        else 0
                    ),
                    "title": (
                        result.document.title
                        if hasattr(result.document, "title")
                        else None
                    ),
                    "image_count": 0,  # No images processed
                    "ocr_used": False,
                },
            }
        except Exception as e:
            print(f"Error extracting text with Docling: {e}")
            return {"chunks": [], "image_mappings": {}, "metadata": {}}

    def _is_scanned_pdf(self, file_path: str, check_pages: int = 3) -> bool:
        """Quick check if PDF is scanned by reading raw text from PDF

        Args:
            file_path: Path to PDF file
            check_pages: Number of pages to check (default: 3)

        Returns:
            True if PDF appears to be scanned, False if it has text
        """
        try:
            reader = PdfReader(file_path)
            total_pages = len(reader.pages)

            # Only check up to the specified number of pages
            pages_to_check = min(total_pages, check_pages)

            print(f"Checking {pages_to_check} pages for text content...")

            for i in range(pages_to_check):
                page_text = reader.pages[i].extract_text()
                if page_text and len(page_text.strip()) > 5:
                    print(f"Found text on page {i+1}: {len(page_text.strip())} characters")
                    return False  # Found meaningful text

            print(f"No meaningful text found in first {pages_to_check} pages")
            return True  # No text found, likely scanned

        except Exception as e:
            print(f"Error checking PDF with pypdf: {e}")
            # Fallback to old method if pypdf fails
            return False

    async def _has_meaningful_text(self, text: str) -> bool:
        """Check if the extracted text is meaningful (not just empty or minimal)"""
        if not text or not text.strip():
            return False

        # Remove markdown formatting and check content
        cleaned_text = text.strip()

        # If text is very short, it's likely not a proper document
        if len(cleaned_text) < 50:
            return False

        # Check for common PDF artifacts that indicate scanning
        scan_indicators = [
            "image",
            "figure",
            "table",
            "chart",
            "[image]",
            "[figure]",
            "[table]",
            "�",
            "□",
            "▪",
            "•",  # Common OCR artifacts
        ]

        # If the text consists mostly of these indicators, it's likely scanned
        indicator_count = sum(
            1
            for indicator in scan_indicators
            if indicator.lower() in cleaned_text.lower()
        )
        if indicator_count > 5 and len(cleaned_text) < 200:
            return False

        # Check for actual words (at least 5 words with 3+ characters)
        words = [w for w in cleaned_text.split() if len(w) >= 3]
        if len(words) < 5:
            return False

        return True

    async def _create_chunks_from_document(self, document) -> List[Dict[str, Any]]:
        """Create chunks directly from the document to preserve page information"""
        chunks = []

        try:
            # Get the full markdown
            full_markdown = document.export_to_markdown()
            print(f"Document markdown length: {len(full_markdown)}")

            # Use HybridChunker to get chunk boundaries and page information
            # Suppress warnings about token sequence length
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=UserWarning)
                loop = asyncio.get_event_loop()
                chunk_iter = await loop.run_in_executor(None, self.chunker.chunk, document)

            # Get chunks for text boundaries and page info
            original_chunks = list(chunk_iter)
            print(f"HybridChunker produced {len(original_chunks)} chunks")

            # Process each chunk
            for chunk in original_chunks:
                # Get page information from the chunk
                page_no = None
                if hasattr(chunk, "meta") and chunk.meta:
                    if hasattr(chunk.meta, "doc_items") and chunk.meta.doc_items:
                        first_item = chunk.meta.doc_items[0]
                        if hasattr(first_item, "prov") and first_item.prov:
                            if first_item.prov[0]:
                                page_no = first_item.prov[0].page_no

                # Extract the chunk text
                chunk_text = chunk.text if hasattr(chunk, "text") else str(chunk)

                # Ensure chunk is not empty
                if not chunk_text.strip():
                    continue

                # Create chunk data
                chunk_data = {"text": chunk_text.strip()}
                if page_no is not None:
                    chunk_data["page"] = page_no

                chunks.append(chunk_data)

        except Exception as e:
            print(f"Error creating chunks from document: {e}")
            # Fallback: create a single chunk with the entire document text
            chunk_data = {"text": full_markdown, "page": 1}
            chunks.append(chunk_data)

        return chunks

    async def _create_chunks_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Create chunks from plain text when using OCR"""
        chunks = []

        try:
            # Split text into manageable chunks (approximately 1000 words each)
            words = text.split()
            chunk_size = 1000  # words per chunk

            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i + chunk_size]
                chunk_text = " ".join(chunk_words)

                # Create chunk data
                chunk_data = {
                    "text": chunk_text.strip(),
                    "page": (i // chunk_size) + 1  # Approximate page number
                }

                chunks.append(chunk_data)

        except Exception as e:
            print(f"Error creating chunks from text: {e}")
            # Fallback: create a single chunk with the entire text
            chunk_data = {"text": text, "page": 1}
            chunks.append(chunk_data)

        return chunks

    def _extract_tif_pages(self, tif_path: str, temp_dir: str) -> List[tuple]:
        """Extract all pages from a multi-page TIF file and save as images"""
        image_paths = []

        try:
            with Image.open(tif_path) as img:
                page_num = 0
                while True:
                    try:
                        img.seek(page_num)
                        # Convert to RGB mode if needed
                        if img.mode != 'RGB':
                            img = img.convert('RGB')

                        # Save each page as JPEG
                        image_path = os.path.join(temp_dir, f"page_{page_num+1}.jpg")
                        img.save(image_path, "JPEG")
                        image_paths.append((page_num+1, image_path))
                        page_num += 1
                    except EOFError:
                        break
        except Exception as e:
            print(f"Error extracting TIF pages: {e}")

        return image_paths

    async def _ocr_single_page(self, page_num: int, image_path: str) -> tuple:
        """OCR a single page image

        Args:
            page_num: Page number
            image_path: Path to the image file

        Returns:
            Tuple of (page_num, extracted_text)
        """
        try:
            # Read and encode image to base64
            with open(image_path, "rb") as img_file:
                b64_image = base64.b64encode(img_file.read()).decode("utf-8")

            # Prepare messages for OCR
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64_image}"
                            }
                        },
                        {
                            "type": "text",
                            "text": "Convert the document to markdown. Preserve the structure and formatting as much as possible."
                        }
                    ]
                }
            ]

            # Call async API directly
            start_time = time.time()

            response = await self.ocr_client.chat.completions.create(
                model="deepseek-ocr:3b",
                messages=messages,
                temperature=0.0,
            )

            print(f"Page {page_num} OCR completed in {time.time() - start_time:.2f}s")

            # Extract and return the text
            page_text = response.choices[0].message.content
            return page_num, page_text if page_text else ""
        finally:
            # Clean up the temporary image file
            if os.path.exists(image_path):
                os.remove(image_path)

    async def _process_pages_in_batches(self, image_paths: List[tuple]) -> List[tuple]:
        """Process multiple pages in batches

        Args:
            image_paths: List of (page_num, image_path) tuples

        Returns:
            List of (page_num, page_text) tuples
        """
        # Process pages in batches of 5
        batch_size = 5
        all_results = []

        for i in range(0, len(image_paths), batch_size):
            batch = image_paths[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}/{(len(image_paths) + batch_size - 1)//batch_size} (pages {i+1}-{min(i+batch_size, len(image_paths))})...")

            batch_results = await asyncio.gather(
                *[self._ocr_single_page(page_num, image_path) for page_num, image_path in batch],
                return_exceptions=True
            )
            all_results.extend(batch_results)

        return all_results

    async def _ocr_document(self, file_path: str) -> tuple:
        """Perform OCR on a scanned PDF or TIFF using OpenAI
        Returns: (combined_text, actual_page_count) or (None, 0) if failed
        """
        temp_dir = None
        try:
            # Create a temporary directory for converted images
            temp_dir = tempfile.mkdtemp(prefix="ocr_")

            # Check file extension to determine processing method
            file_ext = os.path.splitext(file_path)[1].lower()

            if file_ext == '.pdf':
                # Convert PDF to images
                print(f"Converting PDF to images at {temp_dir}...")
                images = convert_from_path(file_path, dpi=300)

                if not images:
                    print("No images converted from PDF")
                    return None, 0

                print(f"Successfully converted {len(images)} pages to images")

                # Save all images first
                image_paths = []
                for i, image in enumerate(images):
                    image_path = os.path.join(temp_dir, f"page_{i+1}.jpg")
                    image.save(image_path, "JPEG")
                    image_paths.append((i+1, image_path))

            elif file_ext in ['.tif', '.tiff']:
                # Extract TIFF pages
                print(f"Extracting TIFF pages at {temp_dir}...")
                image_paths = self._extract_tif_pages(file_path, temp_dir)

                if not image_paths:
                    print("No pages extracted from TIFF")
                    return None, 0

                print(f"Successfully extracted {len(image_paths)} pages from TIFF")

            else:
                print(f"Unsupported file format: {file_ext}")
                return None, 0

            # Process all pages in batches
            all_results = await self._process_pages_in_batches(image_paths)

            # Collect results
            all_text = []
            success_count = 0
            for result in all_results:
                if isinstance(result, Exception):
                    print(f"Error processing page: {result}")
                    continue
                page_num, page_text = result
                if page_text:
                    all_text.append((page_num, f"\n\n--- Page {page_num} ---\n\n{page_text}"))
                    success_count += 1
                else:
                    print(f"Page {page_num} returned empty text")

            print(f"Successfully processed {success_count}/{len(image_paths)} pages")

            # Sort by page number and combine text
            all_text.sort(key=lambda x: x[0])
            combined_text = "\n".join(text for _, text in all_text)

            # Count actual pages processed
            actual_page_count = len(image_paths)

            # Clean up the temporary directory
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                print(f"Cleaned up temporary directory: {temp_dir}")

            return (combined_text if combined_text else None, actual_page_count)

        except Exception as e:
            print(f"Error during OCR: {e}")
            # Clean up on error
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                print(f"Cleaned up temporary directory after error: {temp_dir}")
            return None, 0


# Singleton instance
docling_service = DoclingService()