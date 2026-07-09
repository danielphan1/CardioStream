"""Idempotent merge tests — plan 01-06 (DATA-03, D-05, D-06, DATA-05, DATA-07).

Task 1: IngestSummary shape + add/update/unchanged branch counts for
merge_readings on clean_df frames.
Task 2: full-pipeline idempotency proof — double ingest, cumulative overlap,
unique-constraint safety net, naive datetime round-trip (ROADMAP criterion 2).

Every test gets a fresh in-memory SQLite engine via the function-scoped
``engine``/``session`` fixtures in conftest.py.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
from sqlalchemy import func, select

from app.etl import IngestSummary, merge_readings, transform
from app.models import Reading

RAW_COLUMNS = ["datetime", "systolic", "diastolic", "pulse", "notes"]


def _raw(rows: list[tuple]) -> pd.DataFrame:
    """Build a parse_omron-shaped raw frame from (datetime, sbp, dbp, pulse, notes)."""
    df = pd.DataFrame(rows, columns=RAW_COLUMNS)
    df["datetime"] = pd.to_datetime(df["datetime"])
    return df


# 3 valid rows + 1 row with a missing pulse (rejected by transform, D-08) so
# the summary's rejected passthrough is exercised non-trivially.
BASE_ROWS = [
    ("2025-03-01 08:05", 118, 75, 62, "morning"),
    ("2025-03-01 20:30", 132, 84, 58, None),
    ("2025-03-02 07:55", 145, 92, 71, None),
    ("2025-03-02 08:10", 121, 70, None, None),  # pulse missing -> rejected
]


def _clean(rows: list[tuple] = BASE_ROWS):
    return transform(_raw(rows))


def _db_count(session) -> int:
    return session.scalar(select(func.count()).select_from(Reading))


# --- Task 1: summary shape + branch counts -----------------------------------


def test_fresh_ingest_summary_shape(session):
    clean_df, rejected = _clean()
    summary = merge_readings(session, clean_df, rejected)

    assert isinstance(summary, IngestSummary)
    assert summary.added == 3
    assert summary.updated == 0
    assert summary.unchanged == 0
    # rejected passes through from transform (D-06 shape carries reasons).
    assert len(summary.rejected) == 1
    assert summary.rejected[0].reason == "pulse: missing"
    assert summary.total == 3
    assert summary.latest == datetime(2025, 3, 2, 7, 55)
    assert summary.latest.tzinfo is None  # DATA-05


def test_fresh_ingest_counts_all_added(session):
    clean_df, rejected = _clean()
    summary = merge_readings(session, clean_df, rejected)

    assert (summary.added, summary.updated, summary.unchanged) == (3, 0, 0)
    assert _db_count(session) == 3


def test_value_change_counts_updated_and_recomputes_derived(session):
    clean_df, rejected = _clean()
    merge_readings(session, clean_df, rejected)

    # Same datetimes, but the first row's systolic changed 118 -> 160 (D-05:
    # incoming file is truth). Derived columns follow from clean_df.
    changed = [("2025-03-01 08:05", 160, 75, 62, "morning")] + BASE_ROWS[1:]
    clean2, rej2 = _clean(changed)
    summary = merge_readings(session, clean2, rej2)

    assert (summary.added, summary.updated, summary.unchanged) == (0, 1, 2)
    assert summary.total == 3

    row = session.scalars(
        select(Reading).where(Reading.datetime_ == datetime(2025, 3, 1, 8, 5))
    ).one()
    assert row.systolic == 160
    assert row.bp_category == "Stage 2"  # recomputed derived value applied
    assert row.map_value == 103.3
    assert row.pulse_pressure == 85


def test_notes_change_counts_updated(session):
    clean_df, rejected = _clean()
    merge_readings(session, clean_df, rejected)

    changed = [("2025-03-01 08:05", 118, 75, 62, "morning walk")] + BASE_ROWS[1:]
    clean2, rej2 = _clean(changed)
    summary = merge_readings(session, clean2, rej2)

    assert (summary.added, summary.updated, summary.unchanged) == (0, 1, 2)
    row = session.scalars(
        select(Reading).where(Reading.datetime_ == datetime(2025, 3, 1, 8, 5))
    ).one()
    assert row.notes == "morning walk"


def test_identical_reingest_counts_unchanged(session):
    clean_df, rejected = _clean()
    merge_readings(session, clean_df, rejected)
    before = _db_count(session)

    summary = merge_readings(session, clean_df, rejected)

    assert (summary.added, summary.updated, summary.unchanged) == (0, 0, 3)
    assert summary.total == 3
    assert _db_count(session) == before
