"""List curated values in data/materials.yaml whose citation hasn't been checked yet.

Usage (from hello_scifi/backend): uv run python scripts/list_unverified.py
Exit code 1 when anything is unverified, so it can gate a CI check later.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.materials import load_materials  # noqa: E402

FIELDS = ("transparency", "degradable", "literature_typical_stiffness_kpa")


def unverified() -> list[tuple[str, str, object, str]]:
    out = []
    for m in load_materials():
        for field in FIELDS:
            entry = m.get(field)
            if entry and entry.get("citation") and not entry.get("verified"):
                value = entry.get("value", entry.get("range"))
                out.append((m["key"], field, value, entry["citation"]))
    return out


def main() -> None:
    rows = unverified()
    for key, field, value, citation in rows:
        print(f"{key:20} {field:34} {str(value):18} {citation}")
    print(f"\n{len(rows)} unverified curated value(s). Check each against its source, then set verified: true.")
    sys.exit(1 if rows else 0)


if __name__ == "__main__":
    main()
