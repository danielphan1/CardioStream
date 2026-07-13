"""Golden-master regression test: ETL output vs data/bp_data_cleaned.csv (D-01, D-14).

Runs the REAL OMRON export (``data/*.xlsx``) through ``parse_omron`` +
``transform`` and diffs every derived column against the Tableau-era cleaned
CSV. Skips cleanly when the real data is absent (fresh clones, CI) —
RESEARCH Pattern 4.

Scope discipline (Pitfall 8): the CSV carries extra columns (DayOfWeek,
WeekNumber, Month) that are NOT phase requirements and NOT in the DB schema.
We diff EXACTLY six columns: DateTime, AM_PM, BP_Category, Pulse_Category,
MAP, Pulse_Pressure.

D-01 protocol: the CSV is a regression check, NOT the source of truth. The
locked D-02/D-03 rules (app.derivations) win; any row where the CSV disagrees
is investigated and, if the divergence is deliberate, recorded in
``EXCLUDED_ROWS`` below with its datetime and a reason — never by bending the
classifier. Expected candidates: wide-pulse-pressure hypotension-gate rows
like 200/55, which D-02 pins to "Hypotension" (Pitfall 3).

D-14: this test is a pure-frame comparison. The CSV is never loaded into the
database — no DB imports, no engine, no ORM anywhere in this module.

LABEL_MAP status (A3 blocker OPEN): the real CSV was unavailable at planning
and execution time (user chose "skip" at the 01-01 checkpoint; data/ absent
as of 2026-07-13), so its exact label spellings could not be inspected. The
map below normalizes the PLAUSIBLE variants of each canonical label
(01-04 SUMMARY: "e.g. 'Stage 1'/'Stage 1 Hypertension' normalize") and is
identity for canonical spellings. RE-VERIFY against the real CSV when it
lands in data/ — unknown spellings will surface as KeyError-style diffs, not
silent passes.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
from pandas.testing import assert_series_equal

from app.etl import parse_omron, transform

# Resolve from the module's location, never cwd:
# backend/tests/test_golden_master.py -> parents[1]=backend, parents[2]=repo root.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_CSV_PATH = _REPO_ROOT / "data" / "bp_data_cleaned.csv"
_REAL_EXPORTS = sorted((_REPO_ROOT / "data").glob("*.xlsx"))

pytestmark = pytest.mark.skipif(
    not _CSV_PATH.exists() or not _REAL_EXPORTS,
    reason="real data not present (gitignored)",
)

# CSV label spelling -> canonical label (app.derivations docstring).
# Identity entries pin the canonical spellings; variant entries cover the
# plausible Tableau-era spellings pending A3 inspection of the real CSV.
LABEL_MAP: dict[str, str] = {
    # BP categories — canonical (identity)
    "Hypotension": "Hypotension",
    "Normal": "Normal",
    "Elevated": "Elevated",
    "Stage 1": "Stage 1",
    "Stage 2": "Stage 2",
    "Hypertensive Crisis": "Hypertensive Crisis",
    # BP categories — plausible CSV variants
    "Stage 1 Hypertension": "Stage 1",
    "Stage 2 Hypertension": "Stage 2",
    "Hypertension Stage 1": "Stage 1",
    "Hypertension Stage 2": "Stage 2",
    "Low": "Hypotension",
    "Crisis": "Hypertensive Crisis",
    # Pulse categories — canonical (identity)
    "Bradycardia": "Bradycardia",
    "Tachycardia": "Tachycardia",
    # Pulse variants
    "Low Pulse": "Bradycardia",
    "High Pulse": "Tachycardia",
}

# D-01 documented divergences: rows where the CSV deliberately disagrees with
# the locked D-02/D-03 rules. Each entry: datetime -> reason. Populated only
# after per-row investigation (see module docstring); empty means no
# divergence has been established yet.
EXCLUDED_ROWS: dict[pd.Timestamp, str] = {
    # pd.Timestamp("2025-03-01 08:05"): "CSV classified 200/55 as Crisis; "
    #     "D-02 hypotension gate is locked -> Hypotension (Pitfall 3)",
}

# Exactly the six in-scope derived columns (Pitfall 8):
# (etl clean_df column, CSV column)
_COMPARED = [
    ("am_pm", "AM_PM"),
    ("bp_category", "BP_Category"),
    ("pulse_category", "Pulse_Category"),
    ("map", "MAP"),
    ("pulse_pressure", "Pulse_Pressure"),
]


def _load_frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    """ETL clean frame + golden CSV, both indexed by naive datetime."""
    raw = parse_omron(_REAL_EXPORTS[0])
    clean, _rejected = transform(raw)
    clean = clean.set_index("datetime").sort_index()

    golden = pd.read_csv(_CSV_PATH, parse_dates=["DateTime"])
    golden = golden.set_index("DateTime").sort_index()

    # Drop documented D-01 divergences from BOTH sides.
    for dt in EXCLUDED_ROWS:
        clean = clean.drop(index=dt, errors="ignore")
        golden = golden.drop(index=dt, errors="ignore")
    return clean, golden


def test_row_count_is_132():
    clean, golden = _load_frames()
    assert len(clean) == 132 - len(EXCLUDED_ROWS)
    assert len(golden) == 132 - len(EXCLUDED_ROWS)


def test_datetimes_are_tz_naive_and_aligned():
    clean, golden = _load_frames()
    assert clean.index.tz is None, "ETL datetimes must be tz-naive (DATA-05)"
    assert golden.index.tz is None, "CSV datetimes must parse tz-naive"
    assert list(clean.index) == list(golden.index), (
        "datetime alignment mismatch between ETL output and golden CSV"
    )


@pytest.mark.parametrize("etl_col,csv_col", _COMPARED, ids=[c for _, c in _COMPARED])
def test_derived_column_matches_golden(etl_col: str, csv_col: str):
    clean, golden = _load_frames()

    ours = clean[etl_col]
    theirs = golden[csv_col]

    if etl_col in ("bp_category", "pulse_category"):
        # Normalize CSV spellings to canonical labels before diffing.
        theirs = theirs.map(lambda v: LABEL_MAP.get(str(v).strip(), str(v).strip()))

    if etl_col == "map":
        # CSV rounding not yet pinned (A3) — tighten atol once inspected.
        assert_series_equal(
            ours.astype(float),
            theirs.astype(float),
            check_exact=False,
            atol=0.05,
            check_names=False,
        )
    elif etl_col == "pulse_pressure":
        assert_series_equal(
            ours.astype(int), theirs.astype(int), check_names=False
        )
    else:
        assert_series_equal(
            ours.astype(str), theirs.astype(str), check_names=False, check_dtype=False
        )
