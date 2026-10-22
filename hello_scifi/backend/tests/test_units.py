"""Unit normalization used for value_si."""

import pytest

from app.extraction.validate import (
    normalize_value,
    parse_number,
    to_ohms,
    to_pascal,
    to_seconds,
    to_siemens_per_meter,
)


@pytest.mark.parametrize(
    "value, unit, expected",
    [(5, "Pa", 5), (2, "kPa", 2e3), (1.5, "MPa", 1.5e6), (3, "GPa", 3e9), (2, " kPa ", 2e3)],
)
def test_modulus(value, unit, expected):
    assert to_pascal(value, unit) == pytest.approx(expected)


def test_modulus_rejects_millipascal_and_unknown():
    assert to_pascal(1, "mPa") is None
    assert to_pascal(1, "psi") is None


@pytest.mark.parametrize(
    "value, unit, expected",
    [
        (20, "S/m", 20),
        (20, "S m-1", 20),
        (1, "S/cm", 100),
        (1, "S cm-1", 100),
        (1, "S cm⁻¹", 100),
        (10, "mS/cm", 1),
        (10, "mS cm^-1", 1),
        (100, "µS/cm", 0.01),
    ],
)
def test_conductivity(value, unit, expected):
    assert to_siemens_per_meter(value, unit) == pytest.approx(expected)


@pytest.mark.parametrize(
    "value, unit, expected",
    [
        (5, "ms", 5e-3),
        (2, "s", 2),
        (3, "min", 180),
        (1, "h", 3600),
        (2, "hours", 7200),
        (1, "day", 86400),
        (7, "days", 604800),
        (2, "weeks", 1209600),
    ],
)
def test_time(value, unit, expected):
    assert to_seconds(value, unit) == pytest.approx(expected)


def test_impedance_prefix_case():
    assert to_ohms(2, "kΩ") == pytest.approx(2e3)
    assert to_ohms(1, "MΩ") == pytest.approx(1e6)
    assert to_ohms(1, "mΩ") is None  # milliohm isn't in the table; never read it as megaohm


@pytest.mark.parametrize(
    "text, expected",
    [("~20", 20), ("1.2 × 10^5", 1.2e5), ("10-20", 15), ("10–20", 15), ("3.5 ± 0.2", 3.5), ("stable", None)],
)
def test_parse_number(text, expected):
    assert parse_number(text) == (pytest.approx(expected) if expected is not None else None)


def test_normalize_value_by_property():
    assert normalize_value("youngs_modulus", "~2", "kPa") == pytest.approx(2e3)
    assert normalize_value("conductivity", "1", "S/cm") == pytest.approx(100)
    assert normalize_value("culture_days", "3", "weeks") == pytest.approx(21)
    assert normalize_value("neurite_length", "150", "µm") == pytest.approx(150e-6)
    assert normalize_value("viability_percent", "85", "%") == 85
    assert normalize_value("youngs_modulus", "2", "") is None
