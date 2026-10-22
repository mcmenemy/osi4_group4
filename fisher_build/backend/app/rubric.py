"""The scoring rubric: theory-of-mind frameworks, their criteria, and how verdicts become scores.

Claude judges each criterion (met / partial / not met / unclear) and explains why. The
0-3 framework scores are then computed here with a fixed formula, so a score can never
drift away from the reasoning shown next to it.

DRAFT: Patrick owns rubric validation. Edit the criteria text here, bump RUBRIC_VERSION,
then re-run `scripts/score_presets.py` so the cached preset scores match.
"""

from dataclasses import dataclass

RUBRIC_VERSION = "draft-1"

VERDICTS = ("met", "partial", "unclear", "not_met")
# How much each verdict counts toward a framework's score. "unclear" sits halfway
# because the description didn't settle it either way.
VERDICT_POINTS = {"met": 1.0, "partial": 0.5, "unclear": 0.5, "not_met": 0.0}
MAX_SCORE = 3


@dataclass(frozen=True)
class Criterion:
    id: str
    name: str
    question: str
    # A core criterion is one the theory treats as necessary. Not met caps the score
    # at 0; partial or unclear caps it at 2.
    core: bool = False


@dataclass(frozen=True)
class Framework:
    id: str
    name: str
    claim: str
    reference: str
    criteria: tuple[Criterion, ...]


FRAMEWORKS: tuple[Framework, ...] = (
    Framework(
        id="functionalism",
        name="Functionalism",
        claim=(
            "A mental state is defined by its causal role: what causes it, what it causes, "
            "and how it interacts with other states. What the system is made of doesn't matter."
        ),
        reference="Levin, 'Functionalism', Stanford Encyclopedia of Philosophy (2023)",
        criteria=(
            Criterion(
                "functional_organization",
                "Functional organization",
                "Can the substrate physically implement the causal organization of the lost "
                "circuits: internal states that are driven by inputs, interact with each other, "
                "and drive outputs?",
                core=True,
            ),
            Criterion(
                "capacity_and_learning",
                "Capacity and learning",
                "Does it have enough states, memory and adaptability (learning or "
                "reprogramming) to take on rich, changing functional roles?",
            ),
            Criterion(
                "coupling_to_host",
                "Coupling to the host",
                "Can it exchange signals with the patient's remaining brain at the speed and "
                "bandwidth needed to play the lost tissue's role in the larger system?",
            ),
        ),
    ),
    Framework(
        id="global_workspace",
        name="Global workspace",
        claim=(
            "Conscious access happens when information wins a competition and is broadcast "
            "through a workspace of long-range, reciprocal connections to many specialized "
            "processors at once, with non-linear 'ignition'."
        ),
        reference="Mashour, Roelfsema, Changeux & Dehaene, Neuron (2020)",
        criteria=(
            Criterion(
                "specialized_processors",
                "Specialized processors",
                "Does it contain (or connect to) many specialized processors working in "
                "parallel?",
            ),
            Criterion(
                "reciprocal_workspace",
                "Reciprocal long-range workspace",
                "Can it form or join a workspace of long-range, reciprocal (recurrent) "
                "connections linking those processors?",
                core=True,
            ),
            Criterion(
                "ignition",
                "Ignition and sustained activity",
                "Can it show non-linear, all-or-none amplification of selected content that "
                "then reverberates and is sustained?",
            ),
            Criterion(
                "global_broadcast",
                "Limited-capacity global broadcast",
                "Is selected content made available to many processors at once, with "
                "competition for limited workspace capacity?",
            ),
        ),
    ),
    Framework(
        id="iit",
        name="Integrated information theory",
        claim=(
            "Consciousness is a system's intrinsic cause-effect structure. What counts is how "
            "the physical units constrain each other (Φ), not the function the system computes."
        ),
        reference="Albantakis et al., IIT 4.0, PLoS Computational Biology (2023)",
        criteria=(
            Criterion(
                "physical_causal_power",
                "Intrinsic physical cause-effect power",
                "Do the substrate's physical units themselves causally constrain each other's "
                "states, rather than the causal structure existing only in software running on "
                "hardware with a different structure?",
                core=True,
            ),
            Criterion(
                "integration",
                "Integration (reentrant architecture)",
                "Is the physical architecture reentrant, so cutting it into parts would lose "
                "cause-effect power? Purely feedforward hardware has Φ = 0.",
                core=True,
            ),
            Criterion(
                "differentiation",
                "Differentiation and composition",
                "Does it have a rich repertoire of specific states, giving many distinctions "
                "and relations?",
            ),
            Criterion(
                "exclusion",
                "Definite borders with the host",
                "Would it form a maximally integrated whole with definite borders, either "
                "together with the host brain or on its own, rather than a loosely coupled "
                "add-on?",
            ),
        ),
    ),
    Framework(
        id="active_inference",
        name="Active inference",
        claim=(
            "Self-organizing systems persist by minimizing free energy (surprise): they keep "
            "their own states in bounds, model the causes of their inputs, and act to fulfil "
            "their predictions."
        ),
        reference="Friston, Nature Reviews Neuroscience (2010)",
        criteria=(
            Criterion(
                "self_maintenance",
                "Self-maintenance (Markov blanket)",
                "Does it actively keep its own internal states within bounds against "
                "perturbation, with a boundary separating internal from external states?",
                core=True,
            ),
            Criterion(
                "generative_model",
                "Generative, predictive model",
                "Do its internal states encode a model that predicts its inputs, updated by "
                "prediction errors (learning or plasticity)?",
                core=True,
            ),
            Criterion(
                "action",
                "Action on its world",
                "Can it act on its environment, body or host to make its inputs match its "
                "predictions?",
            ),
            Criterion(
                "temporal_depth",
                "Hierarchical and temporal depth",
                "Does it model on several timescales or levels, including anticipating future "
                "states?",
            ),
        ),
    ),
    Framework(
        id="em_field",
        name="EM field theory (cemi)",
        claim=(
            "Consciousness is information integrated in space by the brain's electromagnetic "
            "field, which also acts back on the neurons that generate it."
        ),
        reference="McFadden, Neuroscience of Consciousness (2020)",
        criteria=(
            Criterion(
                "generates_field",
                "Information-carrying field",
                "Does its information-carrying activity generate a spatially extended "
                "electromagnetic field?",
                core=True,
            ),
            Criterion(
                "spatial_integration",
                "Integration in space",
                "Does that field combine information from many units into a single physical "
                "whole, at one moment?",
            ),
            Criterion(
                "field_feedback",
                "Field acts back on the units",
                "Does the field causally influence the units' activity (for example ephaptic "
                "coupling), rather than being shielded against or ignored?",
                core=True,
            ),
        ),
    ),
    Framework(
        id="orch_or",
        name="Orch-OR",
        claim=(
            "Consciousness arises from orchestrated quantum computations in neuronal "
            "microtubules that end in Diósi-Penrose objective reduction. It is highly contested."
        ),
        reference="Hameroff & Penrose, Physics of Life Reviews (2014)",
        criteria=(
            Criterion(
                "quantum_microtubules",
                "Quantum-capable microtubules",
                "Does it contain microtubules (or an equivalent structure) that could sustain "
                "quantum coherence in the way Orch-OR proposes?",
                core=True,
            ),
            Criterion(
                "orchestration",
                "Biological orchestration",
                "Are those quantum processes tuned ('orchestrated') by the substrate's own "
                "biological activity, such as synaptic inputs?",
            ),
            Criterion(
                "objective_reduction",
                "Objective reduction",
                "Would superpositions end by Diósi-Penrose objective reduction at relevant "
                "timescales (tens of ms), rather than by engineered measurement or environmental "
                "decoherence?",
            ),
        ),
    ),
)

# Scored like a framework, but higher means EASIER to keep running.
MAINTAINABILITY = Framework(
    id="maintainability",
    name="Maintainability",
    claim=(
        "How practical it is to keep the substrate working in a patient for years. Higher "
        "means easier. A living graft may score well on the frameworks but poorly here."
    ),
    reference="Project criterion (not a theory of mind)",
    criteria=(
        Criterion(
            "low_life_support",
            "Low life-support burden",
            "Does it need little beyond power: no nutrient supply, sterile perfusion, cooling "
            "or tight temperature control?",
        ),
        Criterion(
            "stable_lifespan",
            "Stable over years",
            "Will it keep working for years without degrading, drifting or dying?",
        ),
        Criterion(
            "repairable",
            "Repairable or replaceable",
            "Can parts be fixed, swapped or updated without major surgery or losing what it "
            "has learned?",
        ),
        Criterion(
            "host_compatible",
            "Compatible with the host",
            "Is it safe in the body long term: little immune response, scarring or tissue "
            "damage?",
        ),
    ),
)

ALL_SCORED = (*FRAMEWORKS, MAINTAINABILITY)


def framework_score(framework: Framework, verdicts: dict[str, str]) -> int:
    """Turn one framework's criterion verdicts into a 0-3 score.

    The score is the share of criterion points earned, scaled to 0-3 and rounded half
    up. Core criteria then cap it: a core criterion not met caps it at 0, and a core
    criterion that is only partial or unclear caps it at 2.
    """
    points = sum(VERDICT_POINTS[verdicts[c.id]] for c in framework.criteria)
    score = int(MAX_SCORE * points / len(framework.criteria) + 0.5)
    for criterion in framework.criteria:
        if not criterion.core:
            continue
        if verdicts[criterion.id] == "not_met":
            score = 0
        elif verdicts[criterion.id] in ("partial", "unclear"):
            score = min(score, MAX_SCORE - 1)
    return score


def combined_support(scores: list[int]) -> float:
    """Mean framework score, 0-3. Every framework counts equally."""
    return round(sum(scores) / len(scores), 2)


def rubric_text() -> str:
    """The rubric as it appears in Claude's system prompt."""
    lines = []
    for framework in ALL_SCORED:
        lines.append(f"## {framework.name} (id: {framework.id})")
        lines.append(f"Claim: {framework.claim}")
        lines.append(f"Reference: {framework.reference}")
        for criterion in framework.criteria:
            core = " [core]" if criterion.core else ""
            lines.append(
                f"- {framework.id}.{criterion.id}{core}: {criterion.name}. {criterion.question}"
            )
        lines.append("")
    return "\n".join(lines).strip()


def criterion_keys() -> list[str]:
    """Every criterion as 'framework.criterion', in rubric order."""
    return [f"{f.id}.{c.id}" for f in ALL_SCORED for c in f.criteria]


def output_schema() -> dict:
    """JSON schema for Claude's structured output.

    Kept flat (lists, not one key per criterion) because a schema with a key for every
    criterion compiles to a grammar the API rejects as too large. `normalize_judgement`
    checks that every criterion and summary came back exactly once.
    """
    return {
        "type": "object",
        "properties": {
            "is_substrate": {"type": "boolean"},
            "interpretation": {"type": "string"},
            "judgements": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "criterion": {"type": "string", "enum": criterion_keys()},
                        # Reasoning comes before the verdict so the verdict follows from it.
                        "reasoning": {"type": "string"},
                        "verdict": {"type": "string", "enum": list(VERDICTS)},
                    },
                    "required": ["criterion", "reasoning", "verdict"],
                    "additionalProperties": False,
                },
            },
            "summaries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "framework": {"type": "string", "enum": [f.id for f in ALL_SCORED]},
                        "summary": {"type": "string"},
                    },
                    "required": ["framework", "summary"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["is_substrate", "interpretation", "judgements", "summaries"],
        "additionalProperties": False,
    }


class IncompleteJudgementError(ValueError):
    """Claude's output skipped or repeated a criterion or summary."""


def normalize_judgement(raw: dict) -> dict:
    """Reshape Claude's flat lists into {framework id: {criteria, summary}}.

    Raises IncompleteJudgementError unless every criterion and every framework summary
    appears exactly once.
    """
    judgements: dict[str, dict] = {}
    for item in raw["judgements"]:
        if item["criterion"] in judgements:
            raise IncompleteJudgementError(f"criterion {item['criterion']} answered twice")
        judgements[item["criterion"]] = item
    missing = [key for key in criterion_keys() if key not in judgements]
    if missing:
        raise IncompleteJudgementError(f"missing criteria: {', '.join(missing)}")

    summaries: dict[str, str] = {}
    for item in raw["summaries"]:
        if item["framework"] in summaries:
            raise IncompleteJudgementError(f"summary for {item['framework']} given twice")
        summaries[item["framework"]] = item["summary"]
    missing = [f.id for f in ALL_SCORED if f.id not in summaries]
    if missing:
        raise IncompleteJudgementError(f"missing summaries: {', '.join(missing)}")

    def framework_part(framework: Framework) -> dict:
        return {
            "criteria": {
                c.id: {
                    "reasoning": judgements[f"{framework.id}.{c.id}"]["reasoning"],
                    "verdict": judgements[f"{framework.id}.{c.id}"]["verdict"],
                }
                for c in framework.criteria
            },
            "summary": summaries[framework.id],
        }

    return {
        "is_substrate": raw["is_substrate"],
        "interpretation": raw["interpretation"],
        "frameworks": {f.id: framework_part(f) for f in FRAMEWORKS},
        "maintainability": framework_part(MAINTAINABILITY),
    }


def as_dict() -> dict:
    """The rubric for the frontend's 'How scoring works' panel."""
    return {
        "version": RUBRIC_VERSION,
        "verdict_points": VERDICT_POINTS,
        "max_score": MAX_SCORE,
        "frameworks": [_framework_dict(f) for f in FRAMEWORKS],
        "maintainability": _framework_dict(MAINTAINABILITY),
    }


def _framework_dict(framework: Framework) -> dict:
    return {
        "id": framework.id,
        "name": framework.name,
        "claim": framework.claim,
        "reference": framework.reference,
        "criteria": [
            {"id": c.id, "name": c.name, "question": c.question, "core": c.core}
            for c in framework.criteria
        ],
    }
