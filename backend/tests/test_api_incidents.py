"""Integration tests for GET/POST /incidents (OVERLAY-01).

Covers (07-02-PLAN behavior contract), mirroring test_api_readings.py's
DateTime-column tests:
  - no-filter list, ordered by datetime ascending
  - start_date / end_date filtering, INCLUSIVE end_date boundary — a 23:xx
    incident ON end_date is kept (same Pitfall 4 regression as readings,
    because Incident.datetime_ is a DateTime column)
  - invalid/malformed date params -> 422, never 500
  - serialization: JSON key is `datetime`, never the ORM attribute name
    `datetime_`; naive ISO datetimes with no Z/offset (DATA-05)
  - POST with minimal required fields (datetime + incident_type) and with
    every field populated — both round-trip exactly
"""

from datetime import datetime

import pytest

from app.models import Incident


def _incident(
    dt: datetime,
    incident_type: str,
    duration: str | None = None,
    notes: str | None = None,
) -> Incident:
    """Minimal valid Incident row."""
    return Incident(
        datetime_=dt,
        incident_type=incident_type,
        duration=duration,
        notes=notes,
    )


@pytest.fixture
def seeded(session):
    """Four incidents spanning multiple dates, including a late-evening boundary row."""
    rows = [
        _incident(datetime(2025, 3, 1, 8, 0), "fall", duration="5 min", notes="minor bruising"),
        _incident(datetime(2025, 3, 3, 14, 30), "seizure"),
        _incident(datetime(2025, 3, 4, 23, 15), "hospitalization", duration="3 days"),
        _incident(datetime(2025, 3, 6, 9, 0), "fainting"),
    ]
    session.add_all(rows)
    session.commit()
    return rows


def test_no_filters_returns_all_rows_ordered_by_datetime(client, seeded) -> None:
    r = client.get("/incidents")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 4
    datetimes = [item["datetime"] for item in body]
    assert datetimes == sorted(datetimes)


def test_start_date_filter(client, seeded) -> None:
    r = client.get("/incidents", params={"start_date": "2025-03-04"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    assert all(item["datetime"] >= "2025-03-04" for item in body)


def test_end_date_filter(client, seeded) -> None:
    r = client.get("/incidents", params={"end_date": "2025-03-03"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2


def test_end_date_is_inclusive_of_late_evening_incident(client, seeded) -> None:
    """Pitfall 4 regression: the 23:15 incident ON 2025-03-04 must be included."""
    r = client.get("/incidents", params={"end_date": "2025-03-04"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 3
    assert any(item["datetime"] == "2025-03-04T23:15:00" for item in body)


@pytest.mark.parametrize(
    "params",
    [
        {"start_date": "not-a-date"},
        {"end_date": "2025-13-45"},
    ],
)
def test_invalid_params_return_422(client, seeded, params: dict) -> None:
    r = client.get("/incidents", params=params)
    assert r.status_code == 422


def test_serialization_uses_clean_datetime_key(client, seeded) -> None:
    """Same aliasing pattern as ReadingOut.datetime — Incident.datetime_ -> datetime."""
    r = client.get("/incidents")
    assert r.status_code == 200
    body = r.json()
    item = body[0]
    assert "datetime" in item
    assert "datetime_" not in item
    for row in body:
        assert "Z" not in row["datetime"]
        assert "+" not in row["datetime"]


def test_post_incident_minimal_fields_creates_and_returns_record(client, seeded) -> None:
    r = client.post(
        "/incidents", json={"datetime": "2025-04-01T08:00:00", "incident_type": "fall"}
    )
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["id"], int)
    assert body["datetime"] == "2025-04-01T08:00:00"
    assert body["incident_type"] == "fall"
    assert body["duration"] is None
    assert body["notes"] is None


def test_post_incident_all_fields_creates_and_returns_record(client, seeded) -> None:
    payload = {
        "datetime": "2025-04-02T09:30:00",
        "incident_type": "seizure",
        "duration": "2 min",
        "notes": "witnessed by caregiver",
    }
    r = client.post("/incidents", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["id"], int)
    for key, value in payload.items():
        assert body[key] == value
