"""Extract records from every PDF in data/papers and write them to data/records.

Usage (from hello_scifi/backend):
    uv run --env-file .env python scripts/extract_batch.py            # skip papers already extracted
    uv run --env-file .env python scripts/extract_batch.py --force    # re-extract everything
    uv run --env-file .env python scripts/extract_batch.py --only lu2019.pdf
    uv run python scripts/extract_batch.py --revalidate   # recompute SI values and quote checks, no API calls

Needs ANTHROPIC_API_KEY (loaded from .env by --env-file; or MOCK_LLM=1 for a dry run). EXTRACTION_MODEL picks the model.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data import PAPERS_DIR, RECORDS_DIR  # noqa: E402
from app.extraction import extract, pdf_text  # noqa: E402
from app.extraction.revalidate import revalidate_record  # noqa: E402
from app.extraction.validate import SourceText  # noqa: E402
from app.schemas import Record, Source  # noqa: E402

FIELD_GROUPS = ("properties", "biology")


def filled_fields(record: Record) -> int:
    dumped = record.model_dump()
    count = 0
    for group in FIELD_GROUPS:
        for value in (dumped.get(group) or {}).values():
            if isinstance(value, dict) and (value.get("value") is not None or value.get("description")):
                count += 1
            elif isinstance(value, list):
                count += len(value)
    return count


def already_extracted() -> set[str]:
    done = set()
    for path in RECORDS_DIR.glob("*.json"):
        file = json.loads(path.read_text()).get("source", {}).get("file")
        if file:
            done.add(file)
    return done


def revalidate() -> int:
    """Re-run unit normalization and evidence checks on existing records against their PDFs."""
    sources: dict[str, SourceText] = {}
    changed = 0
    for path in sorted(RECORDS_DIR.glob("*.json")):
        record = Record.model_validate_json(path.read_text())
        file = record.source.file
        if not file or not (PAPERS_DIR / file).exists():
            print(f"skip {path.name}: source PDF {file!r} not in {PAPERS_DIR}")
            continue
        if file not in sources:
            sources[file] = SourceText(pdf_text.with_page_markers(pdf_text.pdf_pages(PAPERS_DIR / file)))
        before = path.read_text()
        after = revalidate_record(record, sources[file]).model_dump_json(indent=2) + "\n"
        if after != before:
            path.write_text(after)
            changed += 1
    print(f"Revalidated records; {changed} file(s) changed.")
    return 0


async def run(force: bool, only: str | None) -> int:
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(PAPERS_DIR.glob("*.pdf"))
    if only:
        pdfs = [p for p in pdfs if p.name == only]
    if not pdfs:
        print(f"No PDFs found in {PAPERS_DIR}. See data/papers/README.md.")
        return 1
    done = set() if force else already_extracted()
    rows = []
    for pdf in pdfs:
        if pdf.name in done:
            rows.append((pdf.name, "skipped", 0, 0, 0))
            continue
        if force:
            for old in RECORDS_DIR.glob("*.json"):
                if json.loads(old.read_text()).get("source", {}).get("file") == pdf.name:
                    old.unlink()
        try:
            pages = pdf_text.pdf_pages(pdf)
            text = pdf_text.with_page_markers(pages)
            records = await extract.extract_records(text, Source(file=pdf.name))
        except Exception as exc:  # report and keep going with the other papers
            rows.append((pdf.name, f"error: {exc}"[:60], 0, 0, 0))
            continue
        for record in records:
            path = RECORDS_DIR / f"{record.record_id}.json"
            path.write_text(record.model_dump_json(indent=2, exclude_none=False) + "\n")
        rows.append(
            (
                pdf.name,
                "ok",
                len(records),
                sum(filled_fields(r) for r in records),
                sum(len(r.flags) for r in records),
            )
        )

    width = max(len(r[0]) for r in rows)
    print(f"\n{'paper':<{width}}  {'status':<10} {'records':>7} {'fields':>7} {'flags':>6}")
    for name, status, n, fields, flags in rows:
        print(f"{name:<{width}}  {status:<10} {n:>7} {fields:>7} {flags:>6}")
    processed = sum(1 for r in rows if r[1] == "ok")
    print(
        f"\n{processed} papers processed, {sum(r[2] for r in rows)} records, "
        f"{sum(r[3] for r in rows)} fields filled, {sum(r[4] for r in rows)} flags."
    )
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-extract papers that already have records")
    parser.add_argument("--only", help="extract a single PDF by filename")
    parser.add_argument("--revalidate", action="store_true", help="recompute SI values and quote checks only")
    args = parser.parse_args()
    sys.exit(revalidate() if args.revalidate else asyncio.run(run(args.force, args.only)))


if __name__ == "__main__":
    main()
