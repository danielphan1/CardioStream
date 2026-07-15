"""Integration tests for GET /readings (API-01).

Covers (02-01-PLAN behavior contract):
  - each filter alone: start_date, end_date, am_pm, bp_category
  - filter combinations (am_pm + bp_category)
  - INCLUSIVE end_date boundary — a 23:xx reading ON end_date is kept
    (RESEARCH Pitfall 4 regression)
  - canonical labels with spaces ("Hypertensive Crisis") URL-encoded
  - invalid enum / malformed date -> 422, never 500
  - serialization: JSON keys are exactly `datetime` and `map`, never the ORM
    attribute names `datetime_`/`map_value` (RESEARCH Pitfall 3); naive ISO
    datetimes with no Z/offset (DATA-05)
  - ordering: datetime ascending; no filters returns all rows
"""

from datetime import datetime

import pytest

from app.models import Reading


def _reading(dt: datetime, systolic: int, diastolic: int, pulse: int,
             am_pm: str, bp_category: str, notes: str | None = None) -> Reading:
    """Minimal valid Reading row with plausible derived values."""
    return Reading(
        datetime_=dt,
        systolic=systolic,
        diastolic=diastolic,
        pulse=pulse,
        am_pm=am_pm,
        bp_category=bp_category,
        pulse_category="Bradycardia" if pulse < 60 else "Normal",
        map_value=round((systolic + 2 * diastolic) / 3, 1),
        pulse_pressure=systolic - diastolic,
        notes=notes,
    )


@pytest.fixture
def seeded(session):
    """Five readings spanning dates, AM/PM, and categories; returns the rows."""
    rows = [
        _reading(datetime(2025, 3, 1, 8, 5), 118, 76, 55, "AM", "Normal"),
        _reading(datetime(2025, 3, 2, 21, 40), 135, 82, 64, "PM", "Stage 1"),
        _reading(datetime(2025, 3, 3, 7, 15), 142, 88, 58, "AM", "Stage 2"),
        _reading(datetime(2025, 3, 4, 23, 15), 190, 125, 62, "PM", "Hypertensive Crisis"),
        _reading(datetime(2025, 3, 6, 9, 0), 85, 55, 48, "AM", "Hypotension", notes="dizzy"),
    ]
    session.add_all(rows)
    session.commit()
    return rows


def test_no_filters_returns_all_rows_ordered_ascending(client, seeded) -> None:
    r = client.get("/readings")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 5
    datetimes = [item["datetime"] for item in body]
    assert datetimes == sorted(datetimes)


def test_start_date_filter(client, seeded) -> None:
    r = client.get("/readings", params={"start_date": "2025-03-03"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 3
    assert all(item["datetime"] >= "2025-03-03" for item in body)


def test_end_date_filter(client, seeded) -> None:
    r = client.get("/readings", params={"end_date": "2025-03-02"})
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_end_date_is_inclusive_of_late_evening_reading(client, seeded) -> None:
    """Pitfall 4 regression: the 23:15 reading ON 2025-03-04 must be included."""
    r = client.get("/readings", params={"end_date": "2025-03-04"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 4
    assert any(item["datetime"] == "2025-03-04T23:15:00" for item in body)


def test_end_date_at_date_max_returns_200(client, seeded) -> None:
    """WR-01 regression: end_date=9999-12-31 (date.max) must not overflow to 500.

    The inclusive-end-date comparison uses end-of-day, not ``end_date + 1 day``,
    so the maximum representable date is a valid, safe boundary.
    """
    r = client.get("/readings", params={"end_date": "9999-12-31"})
    assert r.status_code == 200
    assert len(r.json()) == 5  # all rows are on/before date.max


def test_am_pm_filter(client, seeded) -> None:
    r = client.get("/readings", params={"am_pm": "AM"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 3
    assert all(item["am_pm"] == "AM" for item in body)


@pytest.mark.parametrize(
    ("label", "expected_count"),
    [
        ("Normal", 1),
        ("Stage 1", 1),
        ("Stage 2", 1),
        ("Hypertensive Crisis", 1),
        ("Hypotension", 1),
        ("Elevated", 0),
    ],
)
def test_bp_category_filter_canonical_labels(client, seeded, label: str,
                                             expected_count: int) -> None:
    """Canonical labels with spaces work URL-encoded and match stored values."""
    r = client.get("/readings", params={"bp_category": label})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == expected_count
    assert all(item["bp_category"] == label for item in body)


def test_filters_combine(client, seeded) -> None:
    r = client.get("/readings", params={"am_pm": "AM", "bp_category": "Stage 2"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["am_pm"] == "AM"
    assert body[0]["bp_category"] == "Stage 2"


def test_date_range_combines_with_am_pm(client, seeded) -> None:
    r = client.get(
        "/readings",
        params={"start_date": "2025-03-01", "end_date": "2025-03-03", "am_pm": "AM"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.parametrize(
    "params",
    [
        {"am_pm": "MORNING"},
        {"bp_category": "stage 1"},  # wrong case — labels are canonical
        {"bp_category": "Crisis"},
        {"start_date": "not-a-date"},
        {"end_date": "2025-13-45"},
    ],
)
def test_invalid_params_return_422(client, seeded, params: dict) -> None:
    r = client.get("/readings", params=params)
    assert r.status_code == 422


def test_serialization_uses_clean_keys_and_naive_iso(client, seeded) -> None:
    """Pitfall 3 + DATA-05: keys are `datetime`/`map`; no Z/offset in datetimes."""
    r = client.get("/readings")
    assert r.status_code == 200
    item = r.json()[0]
    assert "datetime" in item
    assert "map" in item
    assert "datetime_" not in item
    assert "map_value" not in item
    expected_keys = {
        "id", "datetime", "systolic", "diastolic", "pulse", "am_pm",
        "bp_category", "pulse_category", "map", "pulse_pressure", "notes",
    }
    assert set(item.keys()) == expected_keys
    for row in r.json():
        assert "Z" not in row["datetime"]
        assert "+" not in row["datetime"]


def test_notes_nullable_and_present_when_set(client, seeded) -> None:
    r = client.get("/readings", params={"bp_category": "Hypotension"})
    assert r.json()[0]["notes"] == "dizzy"
    r = client.get("/readings", params={"bp_category": "Normal"})
    assert r.json()[0]["notes"] is None
