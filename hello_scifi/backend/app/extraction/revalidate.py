"""Re-check a stored record without calling the model (used by extract_batch.py --revalidate)."""

from app.extraction.validate import SourceText, renormalize_record, validate_record
from app.extraction.vocab import assign_material_key, check_cell_category
from app.schemas import Record

# Flags the validators recompute from scratch. Every other flag (a model disagreement, anything a
# reviewer added, anything unrecognized) is carried over untouched: revalidation never deletes it.
RECOMPUTED_PREFIXES = (
    "unverified_quote:",
    "out_of_range:",
    "material_key:unmatched",
    "material_key:from_model_only",
    "cell_category:",
)


def revalidate_record(record: Record, source: SourceText) -> Record:
    kept = [f for f in record.flags if not f.startswith(RECOMPUTED_PREFIXES)]
    old_key = record.material_key
    # The model's original proposal isn't stored, so a previously matched key stands in for it.
    proposed = old_key if old_key and not old_key.startswith("other") else "other"
    vocab_flags = [f for f in assign_material_key(record, proposed) if not f.startswith("material_key:model_said")]
    vocab_flags += check_cell_category(record)
    validate_record(renormalize_record(record), source)
    record.flags = list(dict.fromkeys(kept + vocab_flags + record.flags))
    return record
