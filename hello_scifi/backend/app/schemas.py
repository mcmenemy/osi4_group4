"""Record schema for literature-extracted materials data (mirrored in frontend/src/records.ts).

Every extracted value is a FieldValue: the value as reported, its unit, a normalized SI value,
and the verbatim evidence quote it came from. A paper can produce several records, for
example one per formulation.
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.materials import material_keys

SCHEMA_VERSION = "0.1.0"

Confidence = Literal["low", "medium", "high"]
MaterialClass = Literal[
    "conductive_hydrogel", "nonconductive_hydrogel", "omiec_film", "oect_device", "biohybrid_device", "other"
]
Setting = Literal["in_vitro_2d", "in_vitro_3d", "in_vivo"]
CellCategory = Literal["primary_neuron", "sc_neuron", "neuron_like_line", "glia", "non_neural", "tissue", "other"]
SurvivalMeasure = Literal["viability", "occupancy", "retention", "neurite_outgrowth"]
# Families from data/materials.yaml, plus "other" for anything outside the vocabulary.
MaterialKey = Literal[tuple(material_keys() + ["other"])]  # type: ignore[valid-type]


class FieldValue(BaseModel):
    value: float | str | None = None
    unit: str | None = None  # as reported
    value_si: float | None = None  # normalized; null when the unit is unknown or not numeric
    evidence: str | None = None  # verbatim quote from the source
    location: str | None = None  # page / figure / table, if known
    confidence: Confidence | None = None
    # How it was measured, e.g. compression vs. shear rheology (G') for stiffness.
    test_method: str | None = None
    # Set by validation: did the evidence quote match the source text?
    evidence_verified: bool | None = None


class Source(BaseModel):
    doi: str | None = None
    title: str | None = None
    first_author: str | None = None
    year: int | None = None
    url: str | None = None
    file: str | None = None  # PDF filename in data/papers, for batch runs


class FormulationItem(BaseModel):
    component: str
    amount: str | None = None
    unit: str | None = None
    evidence: str | None = None
    evidence_verified: bool | None = None


class ProcessingStep(BaseModel):
    step: str
    parameter: str | None = None
    value: str | None = None
    unit: str | None = None
    evidence: str | None = None
    evidence_verified: bool | None = None


class Stability(BaseModel):
    description: FieldValue | None = None
    duration_days: FieldValue | None = None
    conditions: str | None = None


class Properties(BaseModel):
    youngs_modulus: FieldValue | None = None  # SI: Pa
    conductivity: FieldValue | None = None  # SI: S/m
    water_content: FieldValue | None = None  # %
    swelling_ratio: FieldValue | None = None
    impedance_1khz: FieldValue | None = None  # SI: ohm
    electrode_area: FieldValue | None = None  # SI: m^2
    volumetric_capacitance: FieldValue | None = None  # F/cm^3
    mu_c_star: FieldValue | None = None  # F cm^-1 V^-1 s^-1
    ionic_time_constant: FieldValue | None = None  # SI: s
    degradation_time: FieldValue | None = None  # normalized: days
    stability: Stability | None = None


class OtherOutcome(FieldValue):
    name: str = ""


class SurvivalValue(FieldValue):
    """A cell survival result. Different measures are never compared with each other."""

    measure: SurvivalMeasure
    timepoint: str | None = None  # as reported, e.g. "3 weeks after implantation"
    timepoint_days: float | None = None


class Biology(BaseModel):
    cell_type: str | None = None
    cell_category: CellCategory | None = None
    species: str | None = None
    setting: Setting | None = None
    in_brain: bool | None = None  # in vivo, implanted in brain / CNS
    coating: str | None = None
    culture_days: FieldValue | None = None  # SI: days
    viability_percent: FieldValue | None = None
    neurite_length: FieldValue | None = None  # SI: m
    other_outcomes: list[OtherOutcome] = Field(default_factory=list)
    survival: list[SurvivalValue] = Field(default_factory=list)


class Record(BaseModel):
    record_id: str
    source: Source
    material_class: MaterialClass
    material: str
    # Family from data/materials.yaml, or "other:<name>" when nothing matches.
    material_key: str | None = None
    formulation: list[FormulationItem] = Field(default_factory=list)
    processing: list[ProcessingStep] = Field(default_factory=list)
    properties: Properties = Field(default_factory=Properties)
    biology: Biology | None = None
    notes: str | None = None
    # Validation flags (unverified quotes, out-of-range values). Flagged, never dropped.
    flags: list[str] = Field(default_factory=list)
    extraction_model: str | None = None
    extracted_at: str | None = None
    schema_version: str = SCHEMA_VERSION


# --- What the model returns -------------------------------------------------------------
# A flatter shape than Record: properties come back as a list of named values, and missing
# values are simply absent rather than null. extract.py converts it to Records.

PropertyName = Literal[
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
    "stability",
    "stability_duration",
    "culture_days",
    "viability_percent",
    "neurite_length",
    "survival",
    "other_outcome",
]


TestMethod = Literal["", "compression", "tension", "shear_rheology", "indentation_afm", "dma", "other"]


class LLMValue(BaseModel):
    name: PropertyName
    label: str  # outcome name for other_outcome, test conditions for stability; else ""
    value: str  # exactly as reported, e.g. "1.2", "~20", "10-20", "stable"
    unit: str  # as reported; "" if none
    evidence: str  # verbatim quote containing the value
    location: str  # "p. 3", "Fig. 2b", "Table 1", or ""
    confidence: Confidence
    method: TestMethod  # how the value was measured; "" if not stated or not applicable
    survival_measure: Literal["", "viability", "occupancy", "retention", "neurite_outgrowth"]  # for "survival"
    timepoint: str  # for "survival": when it was measured, e.g. "21 days in vitro"; "" otherwise


class LLMFormulation(BaseModel):
    component: str
    amount: str
    unit: str
    evidence: str


class LLMProcessing(BaseModel):
    step: str
    parameter: str
    value: str
    unit: str
    evidence: str


class LLMBiology(BaseModel):
    cell_type: str
    cell_category: CellCategory
    species: str
    setting: Literal["in_vitro_2d", "in_vitro_3d", "in_vivo", "none"]
    in_brain: bool
    coating: str


class LLMRecord(BaseModel):
    material_class: MaterialClass
    material: str
    material_key: MaterialKey
    formulation: list[LLMFormulation]
    processing: list[LLMProcessing]
    values: list[LLMValue]
    has_biology: bool
    biology: LLMBiology
    notes: str


class LLMSource(BaseModel):
    title: str
    first_author: str
    year: int  # 0 if not stated
    doi: str  # "" if not stated


class LLMExtraction(BaseModel):
    source: LLMSource
    records: list[LLMRecord]
