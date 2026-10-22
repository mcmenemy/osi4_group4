"""Download open-access PDFs listed in data/papers.csv into data/papers/<key>.pdf.

Usage (from hello_scifi/backend):
    UNPAYWALL_EMAIL=you@example.edu uv run python scripts/fetch_papers.py
    uv run python scripts/fetch_papers.py --rescan     # pick up PDFs you added by hand

For each paper not yet downloaded it tries, in order: the CSV's direct_pdf_url, the Europe PMC /
PMC open-access PDF for pmc_id, then Unpaywall's best open-access location (only if
UNPAYWALL_EMAIL is set; the address is never written anywhere). Missing DOIs are filled from the
NCBI ID converter (by PMC id) or Crossref (by title, only on a close title match).

It never logs in, uses cookies, or touches paywalled sites. Failures are listed with an NC State
proxy link in data/papers/NEEDS_MANUAL.txt: download those yourself (e.g. with Zotero), save
them as data/papers/<key>.pdf, and run with --rescan.
"""

import argparse
import csv
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

import httpx
from rapidfuzz import fuzz

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data import DATA_DIR, PAPERS_DIR  # noqa: E402

CSV_PATH = DATA_DIR / "papers.csv"
MANUAL_PATH = PAPERS_DIR / "NEEDS_MANUAL.txt"
FIELDS = ["key", "title", "first_author", "year", "doi", "pmc_id", "direct_pdf_url", "status", "pdf_path", "source"]
MIN_BYTES = 50 * 1024
PROXY = "https://proxying.lib.ncsu.edu/index.php?url=https://doi.org/{doi}"
HEADERS = {"User-Agent": "osi4-group4-literature-fetcher/0.1 (open-access PDFs only)"}


def is_pdf(path: Path) -> bool:
    return path.exists() and path.stat().st_size > MIN_BYTES and path.read_bytes()[:4] == b"%PDF"


def read_rows() -> list[dict]:
    with CSV_PATH.open(newline="") as f:
        return list(csv.DictReader(f))


def write_rows(rows: list[dict]) -> None:
    with CSV_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def resolve_doi(client: httpx.Client, row: dict) -> str | None:
    """DOI from the NCBI ID converter (PMC id) or a close Crossref title match. Never guessed."""
    if row["pmc_id"]:
        r = client.get(
            "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/",
            params={"ids": row["pmc_id"], "format": "json", "tool": "osi4-group4"},
        )
        if r.is_success:
            records = r.json().get("records", [])
            if records and records[0].get("doi"):
                return records[0]["doi"]
    if row["title"]:
        r = client.get(
            "https://api.crossref.org/works",
            params={"query.bibliographic": f"{row['title']} {row['first_author']} {row['year']}", "rows": 3},
        )
        if r.is_success:
            for item in r.json()["message"]["items"]:
                title = (item.get("title") or [""])[0]
                if fuzz.token_set_ratio(title.lower(), row["title"].lower()) >= 92:
                    return item["DOI"]
    return None


def europe_pmc_urls(client: httpx.Client, pmc_id: str) -> list[str]:
    urls = [f"https://europepmc.org/articles/{pmc_id}?pdf=render"]
    # The PMC open-access service lists a PDF link for papers in the OA subset.
    r = client.get("https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi", params={"id": pmc_id})
    if r.is_success:
        for href in re.findall(r'format="pdf"[^>]*href="([^"]+)"', r.text):
            urls.append(href.replace("ftp://", "https://"))
    return urls


def unpaywall_url(client: httpx.Client, doi: str) -> str | None:
    email = os.environ.get("UNPAYWALL_EMAIL")
    if not email or not doi:
        return None
    r = client.get(f"https://api.unpaywall.org/v2/{quote(doi)}", params={"email": email})
    if not r.is_success:
        return None
    best = r.json().get("best_oa_location") or {}
    return best.get("url_for_pdf")


def try_download(client: httpx.Client, url: str, dest: Path) -> bool:
    try:
        r = client.get(url)
    except httpx.HTTPError:
        return False
    if not r.is_success or r.content[:4] != b"%PDF" or len(r.content) < MIN_BYTES:
        return False
    dest.write_bytes(r.content)
    return True


def fetch(rows: list[dict]) -> None:
    PAPERS_DIR.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("UNPAYWALL_EMAIL"):
        print("UNPAYWALL_EMAIL not set: skipping the Unpaywall step.")
    with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=30) as client:
        for row in rows:
            dest = PAPERS_DIR / f"{row['key']}.pdf"
            if not row["doi"]:
                row["doi"] = resolve_doi(client, row) or ""
            if row["status"] == "ok" and is_pdf(dest):
                continue
            attempts: list[tuple[str, str]] = []
            if row["direct_pdf_url"]:
                attempts.append(("direct", row["direct_pdf_url"]))
            if row["pmc_id"]:
                attempts += [("pmc_oa", u) for u in europe_pmc_urls(client, row["pmc_id"])]
            if url := unpaywall_url(client, row["doi"]):
                attempts.append(("unpaywall", url))
            for source, url in attempts:
                if try_download(client, url, dest):
                    row.update(status="ok", pdf_path=str(dest.relative_to(DATA_DIR)), source=source)
                    break
            else:
                row.update(status="failed", pdf_path="", source="")
            print(f"{row['key']:14} {row['status']:7} {row['source'] or '-':10} doi={row['doi'] or '?'}")


def rescan(rows: list[dict]) -> None:
    for row in rows:
        dest = PAPERS_DIR / f"{row['key']}.pdf"
        if row["status"] != "ok" and is_pdf(dest):
            row.update(status="ok", pdf_path=str(dest.relative_to(DATA_DIR)), source="manual")
            print(f"{row['key']:14} picked up manual download")


def report(rows: list[dict]) -> None:
    failed = [r for r in rows if r["status"] != "ok"]
    lines = []
    for r in failed:
        link = PROXY.format(doi=r["doi"]) if r["doi"] else "(no DOI resolved; search the title)"
        lines.append(f"{r['key']}.pdf  doi={r['doi'] or '?'}  {r['title']}\n    {link}")
    if failed:
        MANUAL_PATH.write_text(
            "Download these yourself (e.g. Zotero), save as data/papers/<key>.pdf, then run "
            "scripts/fetch_papers.py --rescan\n\n" + "\n".join(lines) + "\n"
        )
        print(f"\n{len(failed)} need a manual download (listed in {MANUAL_PATH}):")
        print("\n".join(lines))
    elif MANUAL_PATH.exists():
        MANUAL_PATH.unlink()
    print(f"\n{len(rows) - len(failed)} of {len(rows)} papers available.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rescan", action="store_true", help="mark hand-downloaded PDFs as ok; no network")
    args = parser.parse_args()
    rows = read_rows()
    for row in rows:
        for field in FIELDS:
            row.setdefault(field, "")
    rescan(rows) if args.rescan else fetch(rows)
    write_rows(rows)
    report(rows)


if __name__ == "__main__":
    main()
