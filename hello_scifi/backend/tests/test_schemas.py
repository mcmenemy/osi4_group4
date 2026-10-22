"""Record schema and conversion from the model's output."""

import pytest
from pydantic import ValidationError

from app.extraction import extract
from app.schemas import Record, Source


def test_record_round_trips_through_json():
    record = extract.to_record(extract.mock_extraction().records[0], Source(title="t", year=2026), "mock", 0)
    again = Record.model_validate_json(record.model_dump_json())
    assert again == record
    assert again.schema_version == "0.1.0"


def test_conversion_fills_fields_and_si_values():
    record = extract.to_record(
        extract.mock_extraction().records[0], Source(first_author="Mock", year=2026), "mock", 0
    )
    assert record.properties.youngs_modulus.value_si == pytest.approx(2e6)
    assert record.properties.conductivity.value_si == pytest.approx(20)
    assert record.biology.viability_percent.value_si == 85
    assert record.biology.setting == "in_vitro_2d"
    assert record.record_id.startswith("mock-2026-mock-pedot-pss")


def test_invalid_material_class_is_rejected():
    with pytest.raises(ValidationError):
        Record(record_id="x", source=Source(), material_class="metal", material="gold")


def test_chunking_splits_at_page_markers():
    text = "".join(f"[page {i}]\n" + "x" * 900 + "\n" for i in range(1, 11))
    chunks = extract.chunk_text(text, size=3000, overlap=100)
    assert len(chunks) > 1
    assert all(c.startswith("[page") or c[:100] in text for c in chunks)
    assert "".join(chunks).count("[page 10]") >= 1


def test_merge_combines_same_material_across_chunks():
    a = extract.mock_extraction()
    b = extract.mock_extraction()
    b.records[0].values = b.records[0].values[:1]
    b.records[0].values[0].value = "3"  # a second, different modulus value
    merged = extract.merge_extractions([a, b])
    assert len(merged.records) == 1
    assert len(merged.records[0].values) == len(a.records[0].values) + 1
