"""Plain text from PDFs, one string per page.

Uses pypdfium2 (PDFium): it keeps word spacing on PDFs where pypdf runs words together,
which matters for both the model's reading and the evidence-quote check.
"""

from pathlib import Path

import pypdfium2 as pdfium


def pdf_pages(source: Path | bytes) -> list[str]:
    pdf = pdfium.PdfDocument(source if isinstance(source, bytes) else str(source))
    try:
        return [pdf[i].get_textpage().get_text_range().replace("\r\n", "\n") for i in range(len(pdf))]
    finally:
        pdf.close()


def with_page_markers(pages: list[str]) -> str:
    """Join pages with "[page N]" markers so the model can cite locations."""
    return "\n\n".join(f"[page {i}]\n{text}" for i, text in enumerate(pages, start=1))
