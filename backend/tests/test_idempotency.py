"""Idempotent merge tests — plan 01-06 (DATA-03, D-05, D-06, DATA-05, DATA-07).

Task 1: IngestSummary shape + add/update/unchanged branch counts for
merge_readings on clean_df frames.
Task 2: full-pipeline idempotency proof — double ingest, cumulative overlap,
unique-constraint safety net, naive datetime round-trip (ROADMAP criterion 2).

Every test gets a fresh in-memory SQLite engine via the function-scoped
``engine``/``session`` fixtures in conftest.py.
"""

from __future__ import annotations

from datetime import datetime, time

import pandas as pd
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.etl import IngestSummary, merge_readings, parse_omron, transform
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


# --- Task 2: full-pipeline idempotency proof (ROADMAP criterion 2) ------------

# Assumed OMRON export rows (fixture shape from plan 01-04). The 11:59 AM /
# 12:00 PM pair straddles the AM/PM boundary for the naive round-trip test.
FIRST_FILE = [
    {"Date": "2025-03-01", "Time": "8:05 AM", "Systolic": 118, "Diastolic": 75, "Pulse": 62, "Notes": "morning"},
    {"Date": "2025-03-01", "Time": "11:59 AM", "Systolic": 124, "Diastolic": 70, "Pulse": 58},
    {"Date": "2025-03-01", "Time": "12:00 PM", "Systolic": 132, "Diastolic": 84, "Pulse": 66},
    {"Date": "2025-03-02", "Time": "7:55 AM", "Systolic": 145, "Diastolic": 92, "Pulse": 71},
]


def _ingest(path, session):
    """The real pipeline end-to-end: parse -> transform -> merge."""
    clean_df, rejected = transform(parse_omron(path))
    return merge_readings(session, clean_df, rejected), clean_df


def test_double_ingest_adds_zero_rows(session, omron_xlsx):
    """DATA-03: re-ingesting the same cumulative export adds zero rows."""
    path = omron_xlsx(FIRST_FILE)

    first, _ = _ingest(path, session)
    assert first.added == len(FIRST_FILE)
    count_after_first = _db_count(session)

    second, _ = _ingest(path, session)
    assert (second.added, second.updated, second.unchanged) == (0, 0, len(FIRST_FILE))
    assert second.total == len(FIRST_FILE)
    # Direct DB row-count equality, not just the summary's claim.
    assert _db_count(session) == count_after_first


def test_overlapping_export_upserts(session, omron_xlsx):
    """Cumulative overlap: union ingested, changed row updated, rest untouched."""
    first_path = omron_xlsx(FIRST_FILE, "first.xlsx")
    _ingest(first_path, session)

    # Second export = first file's rows, PLUS 3 new datetimes, PLUS one
    # existing datetime (8:05 AM) with a changed systolic (118 -> 150).
    second_file = [dict(row) for row in FIRST_FILE]
    second_file[0]["Systolic"] = 150
    second_file += [
        {"Date": "2025-03-03", "Time": "8:00 AM", "Systolic": 128, "Diastolic": 78, "Pulse": 64},
        {"Date": "2025-03-03", "Time": "8:00 PM", "Systolic": 136, "Diastolic": 86, "Pulse": 59},
        {"Date": "2025-03-04", "Time": "9:15 AM", "Systolic": 142, "Diastolic": 88, "Pulse": 70},
    ]
    second_path = omron_xlsx(second_file, "second.xlsx")

    summary, _ = _ingest(second_path, session)
    assert summary.added == 3
    assert summary.updated == 1
    assert summary.unchanged == len(FIRST_FILE) - 1
    assert summary.total == len(FIRST_FILE) + 3  # the union
    assert summary.latest == datetime(2025, 3, 4, 9, 15)

    row = session.scalars(
        select(Reading).where(Reading.datetime_ == datetime(2025, 3, 1, 8, 5))
    ).one()
    assert row.systolic == 150  # D-05: incoming file is truth


def test_unique_constraint_safety_net(session):
    """DATA-03 backstop: even if merge logic regresses, the DB constraint
    (uq_readings_datetime) makes duplicate datetimes structurally impossible."""
    fields = dict(
        systolic=118,
        diastolic=75,
        pulse=62,
        am_pm="AM",
        bp_category="Normal",
        pulse_category="Normal",
        map_value=89.3,
        pulse_pressure=43,
        notes=None,
    )
    dup = datetime(2025, 3, 1, 8, 5)
    session.add(Reading(datetime_=dup, **fields))
    session.add(Reading(datetime_=dup, **fields))

    with pytest.raises(IntegrityError):
        session.commit()


def test_datetimes_naive_roundtrip(session, omron_xlsx):
    """DATA-05: stored datetimes are naive and equal clean_df datetimes exactly
    — no shift across the AM/PM (noon) boundary."""
    path = omron_xlsx(FIRST_FILE)
    _, clean_df = _ingest(path, session)

    stored = sorted(r.datetime_ for r in session.scalars(select(Reading)))
    assert all(d.tzinfo is None for d in stored)

    expected = sorted(ts.to_pydatetime() for ts in clean_df["datetime"])
    assert stored == expected

    # The boundary pair survived exactly: 11:59 stayed AM-side, noon stayed noon.
    assert datetime(2025, 3, 1, 11, 59) in stored
    assert datetime(2025, 3, 1, 12, 0) in stored


# --- Plan 01-08 gap closure: WR-01 (NaN notes) + WR-03 (minute natural key) ---


CLEAN_COLUMNS = [
    "datetime",
    "systolic",
    "diastolic",
    "pulse",
    "am_pm",
    "bp_category",
    "pulse_category",
    "map",
    "pulse_pressure",
    "notes",
]


def test_nan_notes_merge_converges(session):
    """WR-01: a clean frame carrying float NaN notes (any path that bypasses
    transform's object-dtype normalization) still converges — identical
    re-ingest counts unchanged, never updated forever (DATA-03)."""
    clean = pd.DataFrame(
        [
            {
                "datetime": pd.Timestamp("2025-03-01 08:05"),
                "systolic": 118,
                "diastolic": 75,
                "pulse": 62,
                "am_pm": "AM",
                "bp_category": "Normal",
                "pulse_category": "Normal",
                "map": 89.3,
                "pulse_pressure": 43,
                "notes": float("nan"),
            }
        ],
        columns=CLEAN_COLUMNS,
    )

    first = merge_readings(session, clean, [])
    assert first.added == 1

    second = merge_readings(session, clean, [])
    assert (second.added, second.updated, second.unchanged) == (0, 0, 1)

    row = session.scalars(select(Reading)).one()
    assert row.notes is None


def test_transform_floors_datetime_to_minute(session):
    """WR-03: the STORED datetime is floored to minute precision, matching
    the pipeline's own D-07 minute-granularity duplicate definition."""
    clean_df, rejected = transform(
        _raw([("2025-03-01 08:05:10", 118, 75, 62, None)])
    )
    assert rejected == []
    assert clean_df.iloc[0]["datetime"] == pd.Timestamp("2025-03-01 08:05:00")


def test_cross_file_same_minute_different_seconds_no_duplicate(session, omron_xlsx):
    """WR-03 cross-file: a re-export of the same reading re-stamped 30 seconds
    later in the same minute merges as unchanged — never a second row."""
    row_a = {
        "Date": "2025-03-01",
        "Time": time(8, 5, 10),
        "Systolic": 118,
        "Diastolic": 75,
        "Pulse": 62,
        "Notes": "morning",
    }
    row_b = dict(row_a)
    row_b["Time"] = time(8, 5, 40)

    first_path = omron_xlsx([row_a], "first.xlsx")
    first, _ = _ingest(first_path, session)
    assert first.added == 1
    count_after_first = _db_count(session)

    second_path = omron_xlsx([row_b], "second.xlsx")
    second, _ = _ingest(second_path, session)
    assert (second.added, second.updated, second.unchanged) == (0, 0, 1)
    # Direct DB row-count equality, not just the summary's claim.
    assert _db_count(session) == count_after_first == 1
