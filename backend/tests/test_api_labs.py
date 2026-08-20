"""Integration tests for GET/POST /labs (OVERLAY-01).

Covers (07-02-PLAN behavior contract):
  - no-filter list, ordered by date ascending
  - start_date / end_date filtering (LabResult.date is a plain Date column —
    no inclusive-end-of-day dance needed, unlike readings/incidents)
  - invalid/malformed date params -> 422, never 500
  - serialization: exact JSON key set, no extra/missing fields
  - POST with minimal required fields (date + test_name) and with every
    field populated — both round-trip exactly and return the server-assigned id
  - POST-then-GET shows the new record immediately (D-02)
"""

from datetime import date

import pytest

from app.models import LabResult


def _lab_result(
    date_: date,
    test_name: str,
    result: float | None = None,
    unit: str | None = None,
    range_low: float | None = None,
    range_high: float | None = None,
    notes: str | None = None,
) -> LabResult:
    """Minimal valid LabResult row."""
    return LabResult(
        date=date_,
        test_name=test_name,
        result=result,
        unit=unit,
        range_low=range_low,
        range_high=range_high,
        notes=notes,
    )


@pytest.fixture
def seeded(session):
    """Four lab results spanning three distinct dates; returns the rows."""
    rows = [
        _lab_result(
            date(2025, 3, 1),
            "A1C",
            result=5.4,
            unit="%",
            range_low=4.0,
            range_high=5.6,
            notes="fasting",
        ),
        _lab_result(
            date(2025, 3, 1),
            "Glucose",
            result=95,
            unit="mg/dL",
            range_low=70,
            range_high=100,
        ),
        _lab_result(date(2025, 3, 3), "Cholesterol", result=180, unit="mg/dL", range_high=200),
        _lab_result(date(2025, 3, 6), "TSH", result=2.1, unit="mIU/L"),
    ]
    session.add_all(rows)
    session.commit()
    return rows


def test_no_filters_returns_all_rows_ordered_by_date(client, seeded) -> None:
    r = client.get("/labs")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 4
    dates = [item["date"] for item in body]
    assert dates == sorted(dates)


def test_start_date_filter(client, seeded) -> None:
    r = client.get("/labs", params={"start_date": "2025-03-03"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    assert all(item["date"] >= "2025-03-03" for item in body)


def test_end_date_filter(client, seeded) -> None:
    r = client.get("/labs", params={"end_date": "2025-03-01"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    assert all(item["date"] <= "2025-03-01" for item in body)


@pytest.mark.parametrize(
    "params",
    [
        {"start_date": "not-a-date"},
        {"end_date": "2025-13-45"},
    ],
)
def test_invalid_params_return_422(client, seeded, params: dict) -> None:
    r = client.get("/labs", params=params)
    assert r.status_code == 422


def test_serialization_keys(client, seeded) -> None:
    r = client.get("/labs")
    assert r.status_code == 200
    item = r.json()[0]
    expected_keys = {
        "id",
        "date",
        "test_name",
        "result",
        "unit",
        "range_low",
        "range_high",
        "notes",
    }
    assert set(item.keys()) == expected_keys


def test_post_lab_minimal_fields_creates_and_returns_record(client, seeded) -> None:
    r = client.post("/labs", json={"date": "2025-04-01", "test_name": "A1C"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["id"], int)
    assert body["test_name"] == "A1C"
    assert body["date"] == "2025-04-01"
    assert body["result"] is None
    assert body["unit"] is None
    assert body["range_low"] is None
    assert body["range_high"] is None
    assert body["notes"] is None


def test_post_lab_all_fields_creates_and_returns_record(client, seeded) -> None:
    payload = {
        "date": "2025-04-02",
        "test_name": "Glucose",
        "result": 95.5,
        "unit": "mg/dL",
        "range_low": 70.0,
        "range_high": 100.0,
        "notes": "fasting draw",
    }
    r = client.post("/labs", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["id"], int)
    for key, value in payload.items():
        assert body[key] == value


def test_post_lab_then_get_includes_new_record(client, seeded) -> None:
    r = client.post("/labs", json={"date": "2025-04-03", "test_name": "TSH"})
    assert r.status_code == 200
    created_id = r.json()["id"]

    r2 = client.get("/labs")
    assert r2.status_code == 200
    assert any(item["id"] == created_id for item in r2.json())
