"""Check the model's controlled-vocabulary choices (material_key, cell_category).

The model proposes; these deterministic rules decide. Disagreements and off-list values are
flagged for review rather than silently accepted, so no free text feeds the scorecard.
"""

import re

from app.materials import fallback_key, match_material
from app.schemas import Record

# Keywords that strongly suggest a cell category, checked against the model's choice.
_CELL_KEYWORDS: list[tuple[str, str]] = [
    (r"pc-?12|sh-?sy5y|neuro-?2a|\bn2a\b|nsc-?34", "neuron_like_line"),
    (r"astrocyte|microglia|schwann|oligodendro|\bglia", "glia"),
    (r"ipsc|stem[- ]cell|progenitor|\bnsc|\bnpc|esc-derived", "sc_neuron"),
    (r"fibroblast|caco|epithel|hek|mesenchymal|endothel|keratinocyte|myoblast", "non_neural"),
    (r"organoid|tissue|construct|\btenn\b|µtenn|utenn|explant|slice", "tissue"),
    (r"primary|cortical neuron|hippocampal|dorsal root|\bdrg\b|neurons?\b", "primary_neuron"),
]


def expected_cell_category(cell_type: str) -> str | None:
    lowered = cell_type.lower()
    for pattern, category in _CELL_KEYWORDS:
        if re.search(pattern, lowered):
            return category
    return None


def assign_material_key(record: Record, proposed: str) -> list[str]:
    """Set record.material_key from the name patterns, falling back to the model's proposal."""
    flags = []
    matched = match_material(record.material)
    if matched:
        record.material_key = matched
        if proposed not in ("other", matched):
            flags.append(f"material_key:model_said_{proposed}")
    elif proposed != "other":
        record.material_key = proposed
        flags.append("material_key:from_model_only")
    else:
        record.material_key = fallback_key(record.material)
        flags.append("material_key:unmatched")
    return flags


def check_cell_category(record: Record) -> list[str]:
    bio = record.biology
    if not bio or not bio.cell_category:
        return []
    if bio.cell_category == "other":
        return ["cell_category:other"]
    expected = expected_cell_category(bio.cell_type or "")
    if expected and expected != bio.cell_category:
        return [f"cell_category:check_{expected}"]
    return []
