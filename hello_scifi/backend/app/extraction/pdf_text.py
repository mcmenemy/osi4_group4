"""Plain text from PDFs, one string per page."""

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


def pdf_pages(source: Path | bytes) -> list[str]:
    reader = PdfReader(BytesIO(source) if isinstance(source, bytes) else source)
    return [page.extract_text() or "" for page in reader.pages]


def with_page_markers(pages: list[str]) -> str:
    """Join pages with "[page N]" markers so the model can cite locations."""
    return "\n\n".join(f"[page {i}]\n{text}" for i, text in enumerate(pages, start=1))
