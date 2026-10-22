"""Turn paper text into validated Records with Claude structured output.

Long papers are split into chunks at page boundaries; each chunk is extracted separately and
records describing the same material and formulation are merged.
"""

import hashlib
import os
import re
from datetime import UTC, datetime
from functools import lru_cache

import anthropic

from app.extraction import prompts
from app.extraction.validate import SourceText, normalize_value, timepoint_days, validate_record
from app.extraction.vocab import assign_material_key, check_cell_category
from app.schemas import (
    Biology,
    FieldValue,
    FormulationItem,
    LLMExtraction,
    LLMRecord,
    LLMValue,
    OtherOutcome,
    ProcessingStep,
    SurvivalValue,
    Properties,
    Record,
    Source,
    Stability,
)

MODEL = os.environ.get("EXTRACTION_MODEL", "claude-opus-5-5")
CHUNK_CHARS = 80_000
CHUNK_OVERLAP = 2_000

_SIMPLE_PROPERTIES = {
    "youngs_modulus",
    "conductivity",
    "water_content",
    "swelling_ratio",
    "impedance_1khz",
    "electrode_area",
    "volumetric_capacitance",
    "mu_c_star",
    "ionic_time_constant",
    "degradation_time",
}


class ExtractionError(Exception):
    """Claude couldn't produce a complete extraction."""


def mock_enabled() -> bool:
    return os.environ.get("MOCK_LLM", "").lower() in ("1", "true", "yes")


@lru_cache
def get_client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic()


def chunk_text(text: str, size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split at "[page N]" markers where possible, so chunks keep their page labels."""
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            marker = text.rfind("[page ", start + size // 2, end)
            if marker > start:
                end = marker
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


async def _call_claude(chunk: str, index: int, total: int) -> LLMExtraction:
    note = prompts.CHUNK_NOTE.format(index=index, total=total) if total > 1 else ""
    response = await get_client().beta.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=prompts.SYSTEM_PROMPT,
        output_config={"effort": "medium"},
        output_format=LLMExtraction,
        # Route refusals to a fallback model instead of failing the extraction.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[
            {"role": "user", "content": prompts.USER_TEMPLATE.format(chunk_note=note, text=chunk)}
        ],
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise ExtractionError(f"No usable extraction (stop_reason={response.stop_reason}).")
    return response.parsed_output


def _slug(text: str, limit: int = 24) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:limit].strip("-")


def _merge_key(rec: LLMRecord) -> tuple:
    formulation = tuple(sorted((f.component.lower(), f.amount, f.unit) for f in rec.formulation))
    return rec.material_class, rec.material.strip().lower(), formulation


def merge_extractions(parts: list[LLMExtraction]) -> LLMExtraction:
    """Combine chunk results: same material + formulation → one record, values deduplicated."""
    merged: dict[tuple, LLMRecord] = {}
    for part in parts:
        for rec in part.records:
            key = _merge_key(rec)
            if key not in merged:
                merged[key] = rec.model_copy(deep=True)
                continue
            target = merged[key]
            seen = {(v.name, v.label, v.value, v.unit) for v in target.values}
            target.values += [v for v in rec.values if (v.name, v.label, v.value, v.unit) not in seen]
            steps = {(p.step, p.parameter, p.value) for p in target.processing}
            target.processing += [p for p in rec.processing if (p.step, p.parameter, p.value) not in steps]
            if rec.has_biology and not target.has_biology:
                target.has_biology, target.biology = True, rec.biology
            if rec.notes and rec.notes not in target.notes:
                target.notes = f"{target.notes} {rec.notes}".strip()
    # The first chunk holds the title page, so prefer its source metadata.
    source = next((p.source for p in parts if p.source.title), parts[0].source)
    return LLMExtraction(source=source, records=list(merged.values()))


def _field(v: LLMValue) -> FieldValue:
    return FieldValue(
        value=v.value,
        unit=v.unit or None,
        value_si=normalize_value(v.name, v.value, v.unit),
        evidence=v.evidence or None,
        location=v.location or None,
        confidence=v.confidence,
        test_method=v.method or None,
    )


def to_record(rec: LLMRecord, source: Source, model: str, index: int) -> Record:
    props = Properties()
    bio = Biology()
    stability = Stability()
    for v in rec.values:
        if v.name in _SIMPLE_PROPERTIES:
            if getattr(props, v.name) is None:  # keep the first value reported
                setattr(props, v.name, _field(v))
        elif v.name == "stability":
            stability.description = _field(v)
            stability.conditions = v.label or None
        elif v.name == "stability_duration":
            stability.duration_days = _field(v)
        elif v.name in ("culture_days", "viability_percent", "neurite_length"):
            if getattr(bio, v.name) is None:
                setattr(bio, v.name, _field(v))
        elif v.name == "other_outcome":
            bio.other_outcomes.append(OtherOutcome(name=v.label, **_field(v).model_dump()))
        elif v.name == "survival" and v.survival_measure:
            field = _field(v).model_dump()
            # Survival values are percentages unless the measure says otherwise.
            field["value_si"] = normalize_value("viability_percent", v.value, v.unit or "%")
            bio.survival.append(
                SurvivalValue(
                    measure=v.survival_measure,
                    timepoint=v.timepoint or None,
                    timepoint_days=timepoint_days(v.timepoint),
                    **field,
                )
            )
    if stability.description or stability.duration_days:
        props.stability = stability
    # Keep the viability field (used by the maps) in sync with the survival list.
    if bio.viability_percent is None:
        viability = [s for s in bio.survival if s.measure == "viability"]
        if viability:
            best = max(viability, key=lambda s: s.timepoint_days or 0)
            bio.viability_percent = FieldValue(**best.model_dump(exclude={"measure", "timepoint", "timepoint_days"}))

    biology = None
    if rec.has_biology:
        b = rec.biology
        bio.cell_type = b.cell_type or None
        bio.cell_category = b.cell_category
        bio.species = b.species or None
        bio.setting = None if b.setting == "none" else b.setting
        bio.in_brain = b.in_brain if bio.setting == "in_vivo" else None
        bio.coating = b.coating or None
        biology = bio

    signature = f"{rec.material}|{[(f.component, f.amount) for f in rec.formulation]}|{index}"
    digest = hashlib.sha1(signature.encode()).hexdigest()[:6]
    record_id = "-".join(
        p for p in (_slug(source.first_author or "unknown", 16), str(source.year or ""), _slug(rec.material), digest) if p
    )
    record = Record(
        record_id=record_id,
        source=source,
        material_class=rec.material_class,
        material=rec.material,
        formulation=[
            FormulationItem(component=f.component, amount=f.amount or None, unit=f.unit or None, evidence=f.evidence or None)
            for f in rec.formulation
        ],
        processing=[
            ProcessingStep(
                step=p.step,
                parameter=p.parameter or None,
                value=p.value or None,
                unit=p.unit or None,
                evidence=p.evidence or None,
            )
            for p in rec.processing
        ],
        properties=props,
        biology=biology,
        notes=rec.notes or None,
        extraction_model=model,
        extracted_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
    record.flags = assign_material_key(record, rec.material_key)
    return record


def _source(meta: LLMExtraction, hint: Source | None) -> Source:
    s = meta.source
    doi = (hint.doi if hint and hint.doi else s.doi) or None
    return Source(
        doi=doi,
        title=(hint.title if hint and hint.title else s.title) or None,
        first_author=(hint.first_author if hint and hint.first_author else s.first_author) or None,
        year=(hint.year if hint and hint.year else s.year) or None,
        url=(hint.url if hint and hint.url else (f"https://doi.org/{doi}" if doi else None)),
        file=hint.file if hint else None,
    )


async def extract_records(text: str, hint: Source | None = None) -> list[Record]:
    """Extract, convert, and validate records from a paper's text."""
    if mock_enabled():
        parsed, model = mock_extraction(), "mock"
    else:
        chunks = chunk_text(text)
        parts = [await _call_claude(c, i, len(chunks)) for i, c in enumerate(chunks, start=1)]
        parsed, model = merge_extractions(parts), MODEL
    source = _source(parsed, hint)
    checker = SourceText(text)
    out = []
    for i, r in enumerate(parsed.records):
        record = to_record(r, source, model, i)
        vocab_flags = record.flags + check_cell_category(record)
        validate_record(record, checker)  # resets flags to the quote/range checks
        record.flags = vocab_flags + record.flags
        out.append(record)
    return out


# --- MOCK_LLM -----------------------------------------------------------------------------

MOCK_TEXT = (
    "[page 1]\nMock paper: a soft PEDOT:PSS hydrogel for neural interfaces.\n"
    "The hydrogel was formed by adding 15 vol% DMSO to the PEDOT:PSS dispersion. "
    "The resulting gel had a Young's modulus of 2 MPa and a conductivity of 20 S/m in PBS. "
    "Primary rat cortical neurons cultured on the gel for 7 days showed 85% viability."
)


def mock_extraction() -> LLMExtraction:
    """A fixed example so the UI works without an API key. Not real data."""
    from app.schemas import LLMBiology, LLMFormulation, LLMSource

    def value(name: str, val: str, unit: str, evidence: str) -> LLMValue:
        return LLMValue(
            name=name, label="", value=val, unit=unit, evidence=evidence, location="p. 1", confidence="high",
            method="", survival_measure="viability" if name == "survival" else "", timepoint="7 days" if name == "survival" else "",
        )

    return LLMExtraction(
        source=LLMSource(title="MOCK_LLM example (not a real paper)", first_author="Mock", year=2026, doi=""),
        records=[
            LLMRecord(
                material_class="conductive_hydrogel",
                material="MOCK PEDOT:PSS hydrogel",
                material_key="pedot_pss_hydrogel",
                formulation=[
                    LLMFormulation(
                        component="DMSO",
                        amount="15",
                        unit="vol%",
                        evidence="adding 15 vol% DMSO to the PEDOT:PSS dispersion",
                    )
                ],
                processing=[],
                values=[
                    value("youngs_modulus", "2", "MPa", "had a Young's modulus of 2 MPa"),
                    value("conductivity", "20", "S/m", "a conductivity of 20 S/m in PBS"),
                    value("culture_days", "7", "days", "cultured on the gel for 7 days"),
                    value("survival", "85", "%", "showed 85% viability"),
                ],
                has_biology=True,
                biology=LLMBiology(
                    cell_type="primary cortical neurons",
                    cell_category="primary_neuron",
                    species="rat",
                    setting="in_vitro_2d",
                    in_brain=False,
                    coating="",
                ),
                notes="MOCK_LLM=1: canned example record, not extracted from your input.",
            )
        ],
    )
