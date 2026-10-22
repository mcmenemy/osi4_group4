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
REVIEWS_DIR = DATA_DIR / "reviews"
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


@lru_cache
def load_reviews() -> dict[str, dict]:
    """Committed review exports (data/reviews/*.json), merged; later files win per record."""
    merged: dict[str, dict] = {}
    for path in sorted(REVIEWS_DIR.glob("*.json")):
        try:
            merged.update(json.loads(path.read_text()).get("reviews", {}))
        except (json.JSONDecodeError, AttributeError):
            logger.exception("Skipping invalid review file %s", path.name)
    return merged


def _apply_edit(record: Record, path: str, value: str, unit: str) -> None:
    """Apply a reviewer's corrected value/unit at a path like "properties.youngs_modulus"."""
    from app.extraction.validate import normalize_value

    target: object = record
    parts = path.split(".")
    for part in parts:
        target = target[int(part)] if isinstance(target, list) else getattr(target, part, None)
        if target is None:
            return
    target.value, target.unit = value, unit or None
    prop = parts[1] if parts[0] in ("properties", "biology") else parts[-1]
    if prop in ("survival", "other_outcomes"):
        prop = "viability_percent" if prop == "survival" else ""
    target.value_si = normalize_value(prop, value, unit) if prop else target.value_si


def reviewed_records() -> list[Record]:
    """Records with committed reviews applied: rejected ones dropped, edits applied."""
    reviews = load_reviews()
    out = []
    for record in load_records():
        review = reviews.get(record.record_id)
        if review and review.get("status") == "rejected":
            continue
        if review and review.get("edits"):
            record = record.model_copy(deep=True)
            for path, edit in review["edits"].items():
                _apply_edit(record, path, edit.get("value", ""), edit.get("unit", ""))
        out.append(record)
    return out
