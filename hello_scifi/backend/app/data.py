"""Committed data files: extracted records, map references, and docs. No database."""

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

from pydantic import ValidationError

from app.schemas import Record

logger = logging.getLogger(__name__)

_HERE = Path(__file__).resolve()
# Locally the data lives at hello_scifi/data; the Docker image sets DATA_DIR=/app/data.
DATA_DIR = Path(os.environ.get("DATA_DIR", _HERE.parents[2] / "data"))
DOCS_DIR = Path(os.environ.get("DOCS_DIR", _HERE.parents[2] / "docs"))
RECORDS_DIR = DATA_DIR / "records"
PAPERS_DIR = DATA_DIR / "papers"


@lru_cache
def load_records() -> list[Record]:
    records = []
    for path in sorted(RECORDS_DIR.glob("*.json")):
        try:
            records.append(Record.model_validate_json(path.read_text()))
        except ValidationError:
            logger.exception("Skipping invalid record file %s", path.name)
    return records


@lru_cache
def load_json(name: str) -> object:
    return json.loads((DATA_DIR / name).read_text())


def read_doc(name: str) -> str:
    return (DOCS_DIR / name).read_text()
