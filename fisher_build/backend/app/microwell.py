"""Bare vs gel-filled microwells: how much would better graft survival and outgrowth matter?

This connects the simulation to the team's proposed experiment (hello_scifi/docs/proposal.md):
does filling SU-8 microwells with a soft, optionally conductive, hydrogel improve neuron
survival and outgrowth? We can't simulate the materials. Instead we ask what a given
survival and outgrowth would mean for function, using the short-term memory task with the
engineered-graft architecture and the same host-loss schedule.

- Graft survival: the share of graft neurons alive. Bare-well reference: well occupancy
  fell from 77% at loading to 52% at about 3 weeks (Brown et al., bioRxiv 2024), so about
  0.675 of loaded wells kept neurons. We use that as a proxy for survival; it is
  approximate, to verify, because occupancy is not a cell count.
- Outgrowth: multiplies the host <-> graft connection probability relative to the
  engineered-graft example (1 = that example). Brown et al. report that neurites mostly
  stayed in superficial cortex but give no number, so the bare-well outgrowth of 0.5 is
  an assumption, not data.
- Conductive gel: adds slow, densely coupled gel units around the graft, the same stand-in
  for ionic and field coupling as the gel-neuron hybrid example. Bare wells and
  non-conductive gel have none.

Survival and outgrowth in gel-filled wells are unknown; measuring them is the experiment.
The grid shows which improvements would matter for function.
"""

from dataclasses import replace

from app import circuit

REFERENCE = {
    "citation": "Brown et al., bioRxiv 2024",
    "url": "https://www.biorxiv.org/content/10.1101/2024.11.22.624907v1",
    "occupancy_at_loading": 0.77,
    "occupancy_at_3_weeks": 0.52,
}
BARE_SURVIVAL = round(REFERENCE["occupancy_at_3_weeks"] / REFERENCE["occupancy_at_loading"], 3)
BARE_OUTGROWTH = 0.5  # an assumption: "neurites mostly stayed in superficial cortex"
SURVIVAL_GRID = (0.4, 0.55, 0.7, 0.85, 1.0)
OUTGROWTH_GRID = (0.25, 0.5, 1.0, 2.0)

_GRAFT = circuit.EXAMPLES_BY_ID["neural_graft"]
_GEL = circuit.EXAMPLES_BY_ID["gel_neuron_hybrid"]
# The gel example's gel units and their coupling to the graft.
_GEL_PROJECTIONS = tuple(p for p in _GEL.projections if "device" in (p.pre, p.post))


def spec_for(survival: float, outgrowth: float, conductive: bool) -> circuit.CircuitSpec:
    """The engineered-graft circuit with the given survival, outgrowth and gel type."""
    projections = tuple(
        replace(p, p=min(1.0, p.p * outgrowth)) if {p.pre, p.post} == {"host", "graft"} else p
        for p in _GRAFT.projections
    )
    gel = "conductive gel" if conductive else "no conductive gel"
    return replace(
        _GRAFT,
        id=f"microwell_s{survival}_o{outgrowth}_{'c' if conductive else 'n'}",
        name=f"Graft, survival {survival:.0%}, outgrowth ×{outgrowth}, {gel}",
        description="Microwell study condition.",
        graft_survival=survival,
        device=_GEL.device if conductive else None,
        projections=projections + (_GEL_PROJECTIONS if conductive else ()),
    )


def grid() -> list[tuple[float, float, bool]]:
    """Every (survival, outgrowth, conductive) condition, plus the bare-well reference."""
    cells = [(s, o, c) for c in (False, True) for o in OUTGROWTH_GRID for s in SURVIVAL_GRID]
    return [*cells, (BARE_SURVIVAL, BARE_OUTGROWTH, False)]
