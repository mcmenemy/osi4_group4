"""Material families from data/materials.yaml: the vocabulary for material_key."""

import os
import re
from functools import lru_cache
from pathlib import Path

import yaml

_DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[2] / "data"))


@lru_cache
def load_materials() -> list[dict]:
    return yaml.safe_load((_DATA_DIR / "materials.yaml").read_text())["materials"]


def material_keys() -> list[str]:
    return [m["key"] for m in load_materials()]


def material(key: str) -> dict | None:
    return next((m for m in load_materials() if m["key"] == key), None)


def match_material(name: str) -> str | None:
    """First family whose pattern matches the material name, in file order."""
    lowered = name.lower()
    for m in load_materials():
        if any(re.search(p, lowered) for p in m.get("patterns", [])):
            return m["key"]
    return None


def fallback_key(name: str) -> str:
    return "other:" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
