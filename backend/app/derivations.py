"""Medical derivations for Chris's health readings — single source of truth.

Categories are computed here and ONLY here (DATA-01). The ETL transform,
sample-data generator, golden-master test, and any future API code must import
these functions; nothing else may ever recompute a category.

Canonical labels (pinned; surface in Phase 2 charts/API):
  BP:    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2",
         "Hypertensive Crisis"
  Pulse: "Bradycardia", "Normal", "Tachycardia"

Rules (locked decisions D-01..D-04, 01-CONTEXT.md):
  - D-02: hypotension gate FIRST — systolic <90 OR diastolic <60 is
    "Hypotension", checked before the AHA ladder (so 200/55 is Hypotension,
    not Hypertensive Crisis).
  - D-03: severity-max — systolic and diastolic are classified independently
    on the AHA ladder and the more severe category wins.
  - D-04: pulse — Bradycardia <60, Normal 60-100 inclusive, Tachycardia >100.

BP thresholds verified against the AHA "Understanding Blood Pressure Readings"
table (heart.org), retained unchanged by the 2025 AHA/ACC guideline
(doi:10.1161/HYP.0000000000000249). Hypertensive Crisis is STRICTLY greater
than 180 systolic / 120 diastolic; Stage 2 is >=140 / >=90; Stage 1 is
>=130 / >=80; Elevated is systolic 120-129 only.

Conventions:
  - MAP = (systolic + 2*diastolic) / 3, rounded to 1 decimal, float.
  - Pulse pressure = systolic - diastolic, int.
  - AM/PM: hour <12 is "AM", else "PM" (noon exactly is "PM"); datetimes are
    naive local time end-to-end (DATA-05).
"""

from datetime import datetime

# Ordered least → most severe (D-03 severity-max resolution).
_SEVERITY = ["Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"]


def _classify_systolic(systolic: int) -> str:
    if systolic > 180:
        return "Hypertensive Crisis"
    if systolic >= 140:
        return "Stage 2"
    if systolic >= 130:
        return "Stage 1"
    if systolic >= 120:
        return "Elevated"
    return "Normal"


def _classify_diastolic(diastolic: int) -> str:
    if diastolic > 120:
        return "Hypertensive Crisis"
    if diastolic >= 90:
        return "Stage 2"
    if diastolic >= 80:
        return "Stage 1"
    return "Normal"


def classify_bp(systolic: int, diastolic: int) -> str:
    """Classify a BP reading into the canonical category labels.

    D-02 hypotension gate runs first; otherwise systolic and diastolic are
    classified independently and the more severe wins (D-03).
    """
    if systolic < 90 or diastolic < 60:
        return "Hypotension"
    sys_cat = _classify_systolic(systolic)
    dia_cat = _classify_diastolic(diastolic)
    return max(sys_cat, dia_cat, key=_SEVERITY.index)


def classify_pulse(pulse: int) -> str:
    """Classify pulse per D-04: <60 Bradycardia, 60-100 Normal, >100 Tachycardia."""
    if pulse < 60:
        return "Bradycardia"
    if pulse > 100:
        return "Tachycardia"
    return "Normal"


def compute_map(systolic: int, diastolic: int) -> float:
    """Mean arterial pressure: (systolic + 2*diastolic) / 3, rounded to 1 decimal."""
    return round((systolic + 2 * diastolic) / 3, 1)


def compute_pulse_pressure(systolic: int, diastolic: int) -> int:
    """Pulse pressure: systolic - diastolic (integer)."""
    return systolic - diastolic


def derive_am_pm(dt: datetime) -> str:
    """Return "AM" for hours 0-11, "PM" for 12-23 (noon exactly is PM).

    Expects naive local datetimes (DATA-05) — what the OMRON device recorded.
    """
    return "AM" if dt.hour < 12 else "PM"
