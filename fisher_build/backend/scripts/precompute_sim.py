"""Precompute the simulation results shown on the Simulate and Microwell tabs.

Run from fisher_build/backend (takes a while; no API key needed):
    uv run python -m scripts.precompute_sim                    # everything missing or outdated
    uv run python -m scripts.precompute_sim --part examples    # one part: examples, sweep or microwell
    uv run python -m scripts.precompute_sim --all              # recompute even if up to date

The three parts are saved to separate files, so you can run them in three terminals at
once to finish sooner. Results are outdated when a spec or the simulation code changed.
"""

import argparse
import logging
import sys
import time

from app import circuit, simulation

PARTS = ("examples", "sweep", "microwell")


def run_examples(recompute: bool) -> None:
    data = simulation.load("examples")
    todo = [s.id for s in circuit.EXAMPLES] if recompute else simulation.stale_examples(data)
    for spec in circuit.EXAMPLES:
        if spec.id not in todo:
            continue
        print(f"Running {spec.name} ({len(simulation.EXAMPLE_SEEDS)} seeds)...", flush=True)
        result = simulation.run_example(spec)
        data[spec.id] = result
        accuracy = [lv["accuracy"] for lv in result["levels"]]
        print(
            f"  retained {result['retained_function']} ± {result['retained_sd']}, "
            f"accuracy {accuracy}, {result['total_ms'] / 1000:.0f} s",
            flush=True,
        )
        # Save as we go (and drop examples that no longer exist), so an interrupted run
        # keeps the finished ones.
        simulation.save("examples", {s.id: data[s.id] for s in circuit.EXAMPLES if s.id in data})


def run_sweep(recompute: bool) -> None:
    if not recompute and simulation.is_current("sweep", simulation.load("sweep")):
        print("Sweep is up to date.")
        return
    print("Running the reciprocity x timescale sweep...", flush=True)
    sweep = simulation.run_sweep(progress=lambda line: print(line, flush=True))
    simulation.save("sweep", sweep)
    s = sweep["summary"]
    print(
        f"  default ranking {s['default_ranking']}; same ranking in {s['same_ranking']}/{s['total']}, "
        f"same winner in {s['same_winner']}/{s['total']}",
        flush=True,
    )


def run_microwell(recompute: bool) -> None:
    if not recompute and simulation.is_current("microwell", simulation.load("microwell")):
        print("Microwell study is up to date.")
        return
    print("Running the microwell study grid...", flush=True)
    wells = simulation.run_microwell(progress=lambda line: print(line, flush=True))
    simulation.save("microwell", wells)
    print(f"  bare-well reference: retained {wells['bare']['retained']}", flush=True)


def main(parts: list[str], recompute: bool) -> int:
    logging.getLogger("brian2").setLevel(logging.ERROR)
    started = time.perf_counter()
    runners = {"examples": run_examples, "sweep": run_sweep, "microwell": run_microwell}
    for part in parts:
        runners[part](recompute)
    print(f"Done in {time.perf_counter() - started:.0f} s.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--part", choices=PARTS, help="compute only this part")
    parser.add_argument("--all", action="store_true", help="recompute even if up to date")
    args = parser.parse_args()
    sys.exit(main([args.part] if args.part else list(PARTS), args.all))
