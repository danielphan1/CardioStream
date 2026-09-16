"""Generate the committed SYNTHETIC demo records for labs, incidents, and procedures.

THIS FILE PRODUCES SYNTHETIC DEMO DATA ONLY. Every value is drawn from a
seeded pseudo-random generator or is a hand-picked label. The script never
reads Chris's real records — it has no dependency on the gitignored `data/`
directory or on any table populated from it.

Mirrors generate_sample.py's determinism discipline (fixed SEED,
`random.Random(SEED)` instance — never the global `random` module state —
plus the generate -> assert_character -> write order and a loud
character-coverage self-check) but NOT its pandas/openpyxl xlsx machinery:
labs/incidents/procedures are POST-body-shaped (created via
`LabResultCreate` / `IncidentCreate` / `ProcedureCreate`, per app/schemas.py),
never spreadsheet-shaped, so this generator's output is plain JSON produced
with stdlib `json` + `random` only.

Run from backend/:  python scripts/generate_demo_records.py
"""

from __future__ import annotations

import json
import random
from datetime import date, datetime, time, timedelta
from pathlib import Path

# --- Determinism knob ----------------------------------------------------
# Distinct from generate_sample.py's SEED (20250222) so the two generators
# are visibly independent.
SEED = 20250915

# Same span as the committed readings sample, so a guest browsing the
# dashboard sees plausible temporal overlap across data types.
START_DATE = date(2025, 2, 22)
END_DATE = date(2025, 6, 13)

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "demo_records.json"

# (test_name, unit, range_low, range_high) — textbook adult reference ranges.
LAB_DEFS = [
    ("Hemoglobin A1c", "%", 4.0, 5.6),
    ("Creatinine", "mg/dL", 0.6, 1.3),
    ("Potassium", "mEq/L", 3.5, 5.0),
    ("TSH", "mIU/L", 0.4, 4.0),
]

# (incident_type, duration, notes)
INCIDENT_DEFS = [
    ("Fall", "5 minutes", "Lost balance transferring to wheelchair; no injury."),
    ("UTI", "4 days", "Fever and confusion; treated with antibiotics."),
    (
        "Hospitalization",
        "2 days",
        "Admitted for observation after an autonomic dysreflexia episode.",
    ),
    ("Fall", None, "Minor slip, no injury reported."),
    ("UTI", "3 days", None),
]

# (procedure_name, location, outcome, notes)
PROCEDURE_DEFS = [
    (
        "Botox injection (spasticity)",
        "Outpatient Clinic",
        "Successful",
        "Reduced spasticity in left arm.",
    ),
    ("Pressure sore debridement", "Wound Care Center", "Successful", None),
    (
        "Catheter replacement",
        "Home visit",
        "Complications noted",
        "Minor bleeding, resolved same day.",
    ),
    ("Dental cleaning under sedation", "Dental Surgery Center", "Successful", None),
    (
        "Baclofen pump refill",
        "Outpatient Clinic",
        "Complications noted",
        "Pump alarm triggered; recalibrated.",
    ),
]


def _draw_date(rng: random.Random) -> date:
    span = (END_DATE - START_DATE).days
    return START_DATE + timedelta(days=rng.randint(0, span))


def _draw_in_range(rng: random.Random, lo: float, hi: float) -> float:
    return round(rng.uniform(lo, hi), 1)


def _draw_out_of_range(rng: random.Random, lo: float, hi: float) -> float:
    span = hi - lo
    delta = rng.uniform(0.2, 0.6) * span
    if rng.random() < 0.5 and lo - delta >= 0:
        return round(lo - delta, 1)
    return round(hi + delta, 1)


def _build_lab_row(
    rng: random.Random, test_name: str, unit: str, lo: float, hi: float, *, in_range: bool
) -> dict:
    result = _draw_in_range(rng, lo, hi) if in_range else _draw_out_of_range(rng, lo, hi)
    return {
        "date": _draw_date(rng).isoformat(),
        "test_name": test_name,
        "result": result,
        "unit": unit,
        "range_low": lo,
        "range_high": hi,
        "notes": None,
    }


def _build_labs(rng: random.Random) -> list[dict]:
    """One in-range + one out-of-range row per LAB_DEFS entry (8 rows,
    covering all 4 distinct test_name values with guaranteed in/out coverage
    each), mirroring generate_sample.py's hand-picked-edge-rows discipline.
    """
    rows = []
    for test_name, unit, lo, hi in LAB_DEFS:
        rows.append(_build_lab_row(rng, test_name, unit, lo, hi, in_range=True))
        rows.append(_build_lab_row(rng, test_name, unit, lo, hi, in_range=False))
    rng.shuffle(rows)
    return rows


def _build_incidents(rng: random.Random) -> list[dict]:
    rows = []
    for incident_type, duration, notes in INCIDENT_DEFS:
        d = _draw_date(rng)
        t = time(rng.randint(6, 21), rng.randint(0, 59))
        rows.append(
            {
                "datetime": datetime.combine(d, t).isoformat(),
                "incident_type": incident_type,
                "duration": duration,
                "notes": notes,
            }
        )
    rng.shuffle(rows)
    return rows


def _build_procedures(rng: random.Random) -> list[dict]:
    rows = []
    for procedure_name, location, outcome, notes in PROCEDURE_DEFS:
        rows.append(
            {
                "date": _draw_date(rng).isoformat(),
                "procedure_name": procedure_name,
                "location": location,
                "outcome": outcome,
                "notes": notes,
            }
        )
    rng.shuffle(rows)
    return rows


def generate_rows() -> dict[str, list[dict]]:
    rng = random.Random(SEED)  # NEVER the global random state
    return {
        "labs": _build_labs(rng),
        "incidents": _build_incidents(rng),
        "procedures": _build_procedures(rng),
    }


def assert_character(rows: dict[str, list[dict]]) -> None:
    """Fail loudly if the generated fixture misses required table character."""
    for table in ("labs", "incidents", "procedures"):
        assert rows.get(table), f"table '{table}' must not be empty"

    lab_names = {row["test_name"] for row in rows["labs"]}
    assert len(lab_names) >= 2, f"labs needs >=2 distinct test_name values, got {lab_names}"

    incident_types = {row["incident_type"] for row in rows["incidents"]}
    assert len(incident_types) >= 2, (
        f"incidents needs >=2 distinct incident_type values, got {incident_types}"
    )

    outcomes = {row["outcome"] for row in rows["procedures"]}
    assert len(outcomes) >= 2, f"procedures needs >=2 distinct outcome values, got {outcomes}"


def main() -> None:
    rows = generate_rows()
    assert_character(rows)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as f:
        json.dump(rows, f, indent=2, default=str)
    for table in ("labs", "incidents", "procedures"):
        print(f"{table}: {len(rows[table])} rows")


if __name__ == "__main__":
    main()
