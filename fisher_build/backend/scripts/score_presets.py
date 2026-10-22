"""Score the preset substrates with Claude and save the results for the dropdown.

Run from fisher_build/backend:
    uv run --env-file .env python -m scripts.score_presets          # only missing or outdated presets
    uv run --env-file .env python -m scripts.score_presets --all    # re-score everything

Each preset is judged scoring.PRESET_RUNS times; the app scores the consensus. A preset is
outdated when its description or the rubric prompt changed since it was scored.
"""

import argparse
import asyncio
import json
import sys
import time
from collections import Counter

from app import presets, scoring

MAX_CONCURRENT = 6  # Claude requests in flight at once


async def main(rescore_all: bool) -> int:
    cache = scoring.load_preset_cache()
    todo = [p for p in presets.PRESETS if rescore_all or not scoring.is_current(p, cache.get(p.id))]
    if not todo:
        print("All presets are up to date. Use --all to re-score anyway.")
        return 0

    runs = scoring.PRESET_RUNS
    print(f"Scoring {len(todo)} preset(s) x {runs} runs with {scoring.MODEL} (effort {scoring.EFFORT})...")
    limit = asyncio.Semaphore(MAX_CONCURRENT)

    async def judge_once(description: str) -> tuple[dict, str]:
        async with limit:
            return await scoring.judge(description)

    async def one(preset: presets.Preset) -> tuple[presets.Preset, dict | None, float]:
        started = time.perf_counter()
        try:
            answers = await asyncio.gather(*(judge_once(preset.description) for _ in range(runs)))
        except Exception as error:  # report every failure, keep the others
            print(f"  FAILED {preset.name}: {type(error).__name__}: {error}")
            return preset, None, time.perf_counter() - started
        judgements = [judgement for judgement, _ in answers]
        model = Counter(m for _, m in answers).most_common(1)[0][0]  # differs only after a fallback
        entry = scoring.cache_entry(preset, judgements, model)
        return preset, entry, time.perf_counter() - started

    results = await asyncio.gather(*(one(p) for p in todo))
    failed = 0
    for preset, entry, seconds in results:
        if entry is None:
            failed += 1
            continue
        cache[preset.id] = entry
        scores = scoring.build_result(scoring.consensus(entry["judgements"]))
        summary = ", ".join(f"{f['id']}={f['score']}" for f in scores["frameworks"])
        print(
            f"  {preset.name} ({seconds:.0f} s, {entry['model']}): support "
            f"{scores['combined_support']}, maintainability {scores['maintainability']['score']}, "
            f"unanimous on {scores['unanimous']}/{scores['criteria_total']} criteria [{summary}]"
        )

    # Keep the file in preset order so diffs stay readable.
    ordered = {p.id: cache[p.id] for p in presets.PRESETS if p.id in cache}
    scoring.PRESET_CACHE.parent.mkdir(parents=True, exist_ok=True)
    scoring.PRESET_CACHE.write_text(
        json.dumps(ordered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Saved {scoring.PRESET_CACHE}")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--all", action="store_true", help="re-score every preset")
    sys.exit(asyncio.run(main(parser.parse_args().all)))
