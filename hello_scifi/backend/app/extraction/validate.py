"""Checks on extracted records: evidence quotes, unit normalization, and sanity ranges.

Problems are recorded as flags on the record; nothing is dropped.
"""

import re
import unicodedata
from collections.abc import Iterator

from rapidfuzz import fuzz

from app.schemas import FieldValue, Record

FUZZY_THRESHOLD = 90

# --- Evidence quotes ----------------------------------------------------------------------

_DASHES = dict.fromkeys(map(ord, "‐‑‒–—―−"), "-")
_QUOTES = {ord("‘"): "'", ord("’"): "'", ord("“"): '"', ord("”"): '"'}


def normalize_text(text: str) -> str:
    """Lowercase, unify dashes/quotes/ligatures, rejoin hyphenated line breaks, collapse spaces."""
    text = unicodedata.normalize("NFKC", text).translate(_DASHES).translate(_QUOTES)
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def _alnum(text: str) -> str:
    return re.sub(r"[^0-9a-z]+", "", text)


class SourceText:
    """Source text prepared once for repeated quote lookups."""

    def __init__(self, text: str):
        self.norm = normalize_text(text)
        self.alnum = _alnum(self.norm)

    def contains(self, quote: str) -> bool:
        q = normalize_text(quote)
        if not q:
            return False
        if q in self.norm or (len(_alnum(q)) >= 8 and _alnum(q) in self.alnum):
            return True
        # PDF extraction mangles symbols, superscripts and line order; allow near matches.
        return len(q) >= 15 and fuzz.partial_ratio(q, self.norm) >= FUZZY_THRESHOLD


# --- Units --------------------------------------------------------------------------------

# Normalized unit per property. Mostly SI; a few keep the field's conventional unit.
NORMALIZED_UNITS = {
    "youngs_modulus": "Pa",
    "conductivity": "S/m",
    "water_content": "%",
    "viability_percent": "%",
    "impedance_1khz": "ohm",
    "electrode_area": "m^2",
    "volumetric_capacitance": "F/cm^3",
    "mu_c_star": "F cm^-1 V^-1 s^-1",
    "ionic_time_constant": "s",
    "culture_days": "days",
    "stability_duration": "days",
    "neurite_length": "m",
}

_PRESSURE = {"pa": 1.0, "kpa": 1e3, "mpa": 1e6, "gpa": 1e9}
_CONDUCTIVITY = {
    "s/m": 1.0,
    "ms/m": 1e-3,
    "s/cm": 1e2,
    "ms/cm": 1e-1,
    "us/cm": 1e-4,
}
_TIME = {
    "us": 1e-6,
    "ms": 1e-3,
    "s": 1.0,
    "sec": 1.0,
    "min": 60.0,
    "h": 3600.0,
    "hr": 3600.0,
    "hour": 3600.0,
    "d": 86400.0,
    "day": 86400.0,
    "week": 604800.0,
    "wk": 604800.0,
}
_LENGTH = {"m": 1.0, "cm": 1e-2, "mm": 1e-3, "um": 1e-6, "nm": 1e-9}
_AREA = {"m2": 1.0, "cm2": 1e-4, "mm2": 1e-6, "um2": 1e-12}
_IMPEDANCE = {"ohm": 1.0, "kohm": 1e3, "Mohm": 1e6, "Gohm": 1e9}


def _unit_key(unit: str) -> str:
    """Canonical spelling: "S cm⁻¹" → "s/cm", "kΩ" → "kohm", "µm²" → "um2"."""
    u = unicodedata.normalize("NFKC", unit).translate(_DASHES).strip()
    u = u.replace("µ", "u").replace("μ", "u").replace("Ω", "ohm").replace("·", " ")
    u = re.sub(r"\s*\^\s*", "", u)
    u = re.sub(r"\s*(-1|⁻¹)\b", "^-1", u)
    # "S cm^-1" / "S cm-1" → "S/cm"
    u = re.sub(r"\s+([a-zA-Z]+)\^-1", r"/\1", u)
    u = u.replace("²", "2").replace(" ", "")
    return u


def _lookup(unit: str, table: dict[str, float]) -> float | None:
    key = _unit_key(unit)
    if key in table:
        return table[key]
    lower = {name.lower(): factor for name, factor in table.items()}
    low = key.lower()
    if low in lower:
        return lower[low]
    # Plurals: "days", "hours", "mins", "weeks".
    if table is _TIME and len(low) > 2 and low.endswith("s") and low[:-1] in lower:
        return lower[low[:-1]]
    return None


def to_pascal(value: float, unit: str) -> float | None:
    key = _unit_key(unit)
    # MPa (mega) vs mPa (milli) are case-sensitive; mPa never means a modulus here.
    factor = {"Pa": 1.0, "kPa": 1e3, "MPa": 1e6, "GPa": 1e9}.get(key)
    if factor is None:
        factor = _PRESSURE.get(key.lower()) if key.lower() != "mpa" else None
    return None if factor is None else value * factor


def to_siemens_per_meter(value: float, unit: str) -> float | None:
    factor = _lookup(unit, _CONDUCTIVITY)
    return None if factor is None else value * factor


def to_seconds(value: float, unit: str) -> float | None:
    factor = _lookup(unit, _TIME)
    return None if factor is None else value * factor


def to_meters(value: float, unit: str) -> float | None:
    factor = _lookup(unit, _LENGTH)
    return None if factor is None else value * factor


def to_square_meters(value: float, unit: str) -> float | None:
    factor = _lookup(unit, _AREA)
    return None if factor is None else value * factor


def to_ohms(value: float, unit: str) -> float | None:
    # MΩ (mega) vs mΩ (milli) differ only by case, so match case exactly.
    factor = _IMPEDANCE.get(_unit_key(unit)) or _IMPEDANCE.get(_unit_key(unit).lower())
    return None if factor is None else value * factor


_NUMBER = r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?"


def parse_number(text: str | float | None) -> float | None:
    """First number in a reported value: "~20" → 20, "1.2 × 10^5" → 1.2e5, "10-20" → 15."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    t = unicodedata.normalize("NFKC", text).translate(_DASHES).replace(",", "")
    sci = re.search(rf"({_NUMBER})\s*[x×*]\s*10\s*\^?\s*([-+]?\d+)", t)
    if sci:
        return float(sci.group(1)) * 10 ** int(sci.group(2))
    rng = re.search(rf"({_NUMBER})\s*(?:-|to)\s*({_NUMBER})", t)
    if rng and not t.strip().startswith("-"):
        return (float(rng.group(1)) + float(rng.group(2))) / 2
    m = re.search(_NUMBER, t)
    return float(m.group()) if m else None


def normalize_value(prop: str, value: str | float | None, unit: str | None) -> float | None:
    """Value in NORMALIZED_UNITS[prop], or None if it can't be converted."""
    number = parse_number(value)
    if number is None:
        return None
    unit = unit or ""
    match prop:
        case "youngs_modulus":
            return to_pascal(number, unit)
        case "conductivity":
            return to_siemens_per_meter(number, unit)
        case "ionic_time_constant":
            return to_seconds(number, unit)
        case "culture_days" | "stability_duration":
            seconds = to_seconds(number, unit or "day")
            return None if seconds is None else seconds / 86400
        case "neurite_length":
            return to_meters(number, unit)
        case "electrode_area":
            return to_square_meters(number, unit)
        case "impedance_1khz":
            return to_ohms(number, unit)
        case "water_content" | "viability_percent":
            return number if unit.strip() in ("%", "", "percent") else None
        case "volumetric_capacitance":
            return number if _unit_key(unit).lower() in ("f/cm3", "fcm-3") else None
        case "mu_c_star":
            return number
    return None


# --- Sanity ranges ------------------------------------------------------------------------

SANITY_RANGES = {
    "youngs_modulus": (1.0, 1e12),
    "conductivity": (1e-10, 1e8),
    "water_content": (0.0, 100.0),
    "viability_percent": (0.0, 100.0),
    "impedance_1khz": (1e-3, 1e12),
    "volumetric_capacitance": (0.0, 1e4),
    "ionic_time_constant": (0.0, 1e6),
    "culture_days": (0.0, 3650.0),
    "stability_duration": (0.0, 3650.0),
    "neurite_length": (0.0, 1.0),
}


# --- Record validation --------------------------------------------------------------------


def _fields(record: Record) -> Iterator[tuple[str, FieldValue]]:
    props = record.properties
    for name in (
        "youngs_modulus",
        "conductivity",
        "water_content",
        "swelling_ratio",
        "impedance_1khz",
        "electrode_area",
        "volumetric_capacitance",
        "mu_c_star",
        "ionic_time_constant",
    ):
        f = getattr(props, name)
        if f is not None:
            yield name, f
    if props.stability:
        if props.stability.description:
            yield "stability", props.stability.description
        if props.stability.duration_days:
            yield "stability_duration", props.stability.duration_days
    if record.biology:
        bio = record.biology
        for name in ("culture_days", "viability_percent", "neurite_length"):
            f = getattr(bio, name)
            if f is not None:
                yield name, f
        for outcome in bio.other_outcomes:
            yield f"other_outcome:{outcome.name}", outcome


def validate_record(record: Record, source: SourceText) -> Record:
    """Verify evidence quotes against the source and range-check normalized values."""
    flags: list[str] = []
    for name, f in _fields(record):
        f.evidence_verified = bool(f.evidence) and source.contains(f.evidence)
        if not f.evidence_verified:
            flags.append(f"unverified_quote:{name}")
        bounds = SANITY_RANGES.get(name)
        if bounds and f.value_si is not None and not bounds[0] <= f.value_si <= bounds[1]:
            flags.append(f"out_of_range:{name}")
    for i, item in enumerate(record.formulation):
        item.evidence_verified = bool(item.evidence) and source.contains(item.evidence)
        if not item.evidence_verified:
            flags.append(f"unverified_quote:formulation[{i}]")
    for i, step in enumerate(record.processing):
        step.evidence_verified = bool(step.evidence) and source.contains(step.evidence)
        if not step.evidence_verified:
            flags.append(f"unverified_quote:processing[{i}]")
    record.flags = flags
    return record
