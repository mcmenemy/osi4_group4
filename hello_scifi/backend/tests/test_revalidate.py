"""--revalidate must never delete a reviewer's (or the model's) flags."""

import importlib.util
from pathlib import Path

from app.extraction.revalidate import revalidate_record
from app.extraction.validate import SourceText
from app.schemas import Biology, FieldValue, Properties, Record, Source

SOURCE = "[page 1]\nThe PEDOT:PSS hydrogel had a Young's modulus of 2 MPa."


def make_record(flags: list[str]) -> Record:
    return Record(
        record_id="r1",
        source=Source(file="paper.pdf"),
        material_class="conductive_hydrogel",
        material="PEDOT:PSS hydrogel",
        material_key="pedot_pss_hydrogel",
        properties=Properties(
            youngs_modulus=FieldValue(value="2", unit="MPa", value_si=2e6, evidence="Young's modulus of 2 MPa")
        ),
        biology=Biology(cell_type="PC12 cells", cell_category="primary_neuron"),
        flags=flags,
    )


REVIEWER_FLAGS = ["review:needs_second_look", "material_key:model_said_pedot_film", "custom_note"]


def test_revalidate_record_keeps_reviewer_and_model_flags():
    record = revalidate_record(make_record(REVIEWER_FLAGS + ["unverified_quote:youngs_modulus"]), SourceText(SOURCE))
    for flag in REVIEWER_FLAGS:
        assert flag in record.flags
    # Recomputed flags are refreshed: the quote now verifies, and the PC12 mismatch is caught.
    assert "unverified_quote:youngs_modulus" not in record.flags
    assert "cell_category:check_neuron_like_line" in record.flags


def test_revalidate_is_idempotent_on_flags():
    once = revalidate_record(make_record(REVIEWER_FLAGS), SourceText(SOURCE))
    twice = revalidate_record(once.model_copy(deep=True), SourceText(SOURCE))
    assert twice.flags == once.flags


def test_batch_revalidate_never_deletes_reviewer_flags(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location(
        "extract_batch", Path(__file__).resolve().parents[1] / "scripts" / "extract_batch.py"
    )
    batch = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(batch)

    records_dir, papers_dir = tmp_path / "records", tmp_path / "papers"
    records_dir.mkdir()
    papers_dir.mkdir()
    (papers_dir / "paper.pdf").write_bytes(b"%PDF placeholder")
    path = records_dir / "r1.json"
    path.write_text(make_record(REVIEWER_FLAGS).model_dump_json(indent=2))
    monkeypatch.setattr(batch, "RECORDS_DIR", records_dir)
    monkeypatch.setattr(batch, "PAPERS_DIR", papers_dir)
    monkeypatch.setattr(batch.pdf_text, "pdf_pages", lambda _path: [SOURCE.split("\n", 1)[1]])

    batch.revalidate()
    flags = Record.model_validate_json(path.read_text()).flags
    for flag in REVIEWER_FLAGS:
        assert flag in flags
