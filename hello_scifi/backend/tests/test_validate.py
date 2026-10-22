"""Evidence-quote verification and sanity flags."""

from app.extraction.validate import SourceText, normalize_text, validate_record
from app.schemas import Biology, FieldValue, Properties, Record, Source

SOURCE = (
    "[page 3]\nThe PEDOT:PSS hydrogel exhibited a Young’s modulus of ~2 MPa and a conduc-\n"
    "tivity of 20 S m−1 in PBS. Neurons survived for 7 days."
)


def make_record(**props) -> Record:
    return Record(
        record_id="r1",
        source=Source(title="t"),
        material_class="conductive_hydrogel",
        material="PEDOT:PSS hydrogel",
        properties=Properties(**props),
    )


def test_normalize_text_joins_hyphenation_and_unifies_symbols():
    assert "conductivity of 20 s m-1" in normalize_text(SOURCE)
    assert "young's modulus" in normalize_text(SOURCE)


def test_exact_and_normalized_quotes_verify():
    text = SourceText(SOURCE)
    assert text.contains("Young's modulus of ~2 MPa")
    assert text.contains("conductivity of 20 S m-1 in PBS")  # across a hyphenated line break


def test_fuzzy_quote_verifies_but_invented_quote_does_not():
    text = SourceText(SOURCE)
    assert text.contains("The PEDOT:PSS hydrogel exhibited a Youngs modulus of about 2 MPa")
    assert not text.contains("The hydrogel had a modulus of 50 kPa after swelling in water")


def test_validate_flags_unverified_and_out_of_range():
    record = make_record(
        youngs_modulus=FieldValue(value="~2", unit="MPa", value_si=2e6, evidence="Young's modulus of ~2 MPa"),
        conductivity=FieldValue(value="20", unit="S/m", value_si=20, evidence="made-up sentence that is not there"),
    )
    record.biology = Biology(
        viability_percent=FieldValue(value="120", unit="%", value_si=120, evidence="Neurons survived for 7 days")
    )
    validate_record(record, SourceText(SOURCE))
    assert record.properties.youngs_modulus.evidence_verified is True
    assert record.properties.conductivity.evidence_verified is False
    assert "unverified_quote:conductivity" in record.flags
    assert "out_of_range:viability_percent" in record.flags
    assert "unverified_quote:youngs_modulus" not in record.flags
