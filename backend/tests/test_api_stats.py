"""Integration tests for GET /stats/summary (API-02).

Covers (02-01-PLAN behavior contract):
  - aggregates for a known seeded set: avg (rounded 1 decimal), min, max for
    systolic/diastolic/pulse; count matches row count
  - categories list ALWAYS contains all six canonical labels in clinical
    order, zero-filled for absent categories
  - percents computed against the FILTERED count
  - same ReadingFilters dependency as /readings — one filter semantics
    (API-01/API-02 agreement)
  - empty filter result: count 0, vitals null, percents 0.0 — no 500
  - latest_reading is UNFILTERED (D-11 anchor): non-null even when the
    filter set matches zero rows; D-21 renders this payload verbatim
"""

from datetime import datetime

import pytest

from app.models import Reading

CLINICAL_ORDER = [
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis",
]


def _reading(dt: datetime, systolic: int, diastolic: int, pulse: int,
             am_pm: str, bp_category: str) -> Reading:
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
    )


@pytest.fixture
def seeded(session):
    """Four readings with hand-checkable aggregates.

    systolic 110/120/130/140 -> avg 125.0, min 110, max 140
    diastolic 70/75/80/85    -> avg 77.5, min 70, max 85
    pulse 50/55/60/67        -> avg 58.0, min 50, max 67
    categories: Normal x1, Elevated x1, Stage 1 x2
    newest reading: 2025-03-08T22:30:00 (PM)
    """
    rows = [
        _reading(datetime(2025, 3, 5, 8, 0), 110, 70, 50, "AM", "Normal"),
        _reading(datetime(2025, 3, 6, 9, 30), 120, 75, 55, "AM", "Elevated"),
        _reading(datetime(2025, 3, 7, 20, 0), 130, 80, 60, "PM", "Stage 1"),
        _reading(datetime(2025, 3, 8, 22, 30), 140, 85, 67, "PM", "Stage 1"),
    ]
    session.add_all(rows)
    session.commit()
    return rows


def test_aggregates_for_known_set(client, seeded) -> None:
    r = client.get("/stats/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 4
    assert body["systolic"] == {"avg": 125.0, "min": 110, "max": 140}
    assert body["diastolic"] == {"avg": 77.5, "min": 70, "max": 85}
    assert body["pulse"] == {"avg": 58.0, "min": 50, "max": 67}


def test_categories_always_six_in_clinical_order_zero_filled(client, seeded) -> None:
    r = client.get("/stats/summary")
    assert r.status_code == 200
    cats = r.json()["categories"]
    assert len(cats) == 6
    assert [c["category"] for c in cats] == CLINICAL_ORDER
    by_label = {c["category"]: c for c in cats}
    assert by_label["Stage 1"]["count"] == 2
    assert by_label["Stage 1"]["percent"] == 50.0
    assert by_label["Normal"]["count"] == 1
    assert by_label["Normal"]["percent"] == 25.0
    # zero-filled absentees
    for absent in ("Hypotension", "Stage 2", "Hypertensive Crisis"):
        assert by_label[absent]["count"] == 0
        assert by_label[absent]["percent"] == 0.0


def test_six_categories_in_order_even_when_filter_matches_one(client, seeded) -> None:
    r = client.get("/stats/summary", params={"bp_category": "Stage 1"})
    assert r.status_code == 200
    body = r.json()
    cats = body["categories"]
    assert len(cats) == 6
    assert [c["category"] for c in cats] == CLINICAL_ORDER
    by_label = {c["category"]: c for c in cats}
    assert by_label["Stage 1"]["count"] == 2
    assert by_label["Stage 1"]["percent"] == 100.0
    assert all(by_label[c]["count"] == 0 for c in CLINICAL_ORDER if c != "Stage 1")


def test_stats_respect_same_filters_as_readings(client, seeded) -> None:
    """One filter semantics: /stats/summary?am_pm=PM matches /readings rows."""
    stats = client.get("/stats/summary", params={"am_pm": "PM"}).json()
    readings = client.get("/readings", params={"am_pm": "PM"}).json()
    assert stats["count"] == len(readings) == 2
    assert stats["systolic"] == {"avg": 135.0, "min": 130, "max": 140}


def test_date_filter_applies(client, seeded) -> None:
    r = client.get(
        "/stats/summary",
        params={"start_date": "2025-03-06", "end_date": "2025-03-07"},
    )
    body = r.json()
    assert body["count"] == 2
    assert body["systolic"] == {"avg": 125.0, "min": 120, "max": 130}


def test_empty_filter_result_is_safe(client, seeded) -> None:
    """count 0, vitals null, all percents 0.0 — no division error, no 500."""
    r = client.get("/stats/summary", params={"bp_category": "Hypertensive Crisis"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["systolic"] is None
    assert body["diastolic"] is None
    assert body["pulse"] is None
    assert len(body["categories"]) == 6
    assert all(c["count"] == 0 and c["percent"] == 0.0 for c in body["categories"])


def test_latest_reading_is_unfiltered_anchor(client, seeded) -> None:
    """D-11: latest_reading is non-null even when the filter matches zero rows."""
    r = client.get("/stats/summary", params={"bp_category": "Hypertensive Crisis"})
    body = r.json()
    assert body["count"] == 0
    assert body["latest_reading"] == "2025-03-08T22:30:00"


def test_latest_reading_naive_iso_no_offset(client, seeded) -> None:
    body = client.get("/stats/summary").json()
    assert body["latest_reading"] == "2025-03-08T22:30:00"
    assert "Z" not in body["latest_reading"]
    assert "+" not in body["latest_reading"]


def test_empty_database_all_null(client, session) -> None:
    """No rows at all: latest_reading is null too, everything else safe."""
    r = client.get("/stats/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["systolic"] is None
    assert body["latest_reading"] is None
    assert len(body["categories"]) == 6


def test_invalid_params_return_422(client, seeded) -> None:
    assert client.get("/stats/summary", params={"am_pm": "MORNING"}).status_code == 422
    assert client.get("/stats/summary", params={"start_date": "nope"}).status_code == 422
