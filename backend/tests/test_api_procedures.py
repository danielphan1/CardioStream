"""Integration tests for GET/POST /procedures (OVERLAY-01).

Covers (07-02-PLAN behavior contract), identical structure to
test_api_labs.py:
  - no-filter list, ordered by date ascending
  - start_date / end_date filtering (Procedure.date is a plain Date column —
    no inclusive-end-of-day dance needed, unlike readings/incidents)
  - invalid/malformed date params -> 422, never 500
  - serialization: exact JSON key set, no extra/missing fields
  - POST with minimal required fields (date + procedure_name) and with every
    field populated — both round-trip exactly and return the server-assigned id
  - POST-then-GET shows the new record immediately (D-02)
"""

from datetime import date

import pytest

from app.models import Procedure


def _procedure(
    date_: date,
    procedure_name: str,
    location: str | None = None,
    outcome: str | None = None,
    notes: str | None = None,
) -> Procedure:
    """Minimal valid Procedure row."""
    return Procedure(
        date=date_,
        procedure_name=procedure_name,
        location=location,
        outcome=outcome,
        notes=notes,
    )


@pytest.fixture
def seeded(session):
    """Four procedures spanning three distinct dates; returns the rows."""
    rows = [
        _procedure(
            date(2025, 3, 1),
            "MRI Brain",
            location="City Hospital",
            outcome="Normal",
            notes="follow-up needed",
        ),
        _procedure(
            date(2025, 3, 1),
            "X-Ray Chest",
            location="City Hospital",
            outcome="Clear",
        ),
        _procedure(date(2025, 3, 3), "Blood Draw", location="Clinic", outcome="Completed"),
        _procedure(date(2025, 3, 6), "Physical Therapy", location="Home"),
    ]
    session.add_all(rows)
    session.commit()
    return rows


def test_no_filters_returns_all_rows_ordered_by_date(client, seeded) -> None:
    r = client.get("/procedures")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 4
    dates = [item["date"] for item in body]
    assert dates == sorted(dates)


def test_start_date_filter(client, seeded) -> None:
    r = client.get("/procedures", params={"start_date": "2025-03-03"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    assert all(item["date"] >= "2025-03-03" for item in body)


def test_end_date_filter(client, seeded) -> None:
    r = client.get("/procedures", params={"end_date": "2025-03-01"})
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
    r = client.get("/procedures", params=params)
    assert r.status_code == 422


def test_serialization_keys(client, seeded) -> None:
    r = client.get("/procedures")
    assert r.status_code == 200
    item = r.json()[0]
    expected_keys = {"id", "date", "procedure_name", "location", "outcome", "notes"}
    assert set(item.keys()) == expected_keys


def test_post_procedure_minimal_fields_creates_and_returns_record(client, seeded) -> None:
    r = client.post("/procedures", json={"date": "2025-04-01", "procedure_name": "MRI Brain"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["id"], int)
    assert body["procedure_name"] == "MRI Brain"
    assert body["date"] == "2025-04-01"
    assert body["location"] is None
    assert body["outcome"] is None
    assert body["notes"] is None


def test_post_procedure_all_fields_creates_and_returns_record(client, seeded) -> None:
    payload = {
        "date": "2025-04-02",
        "procedure_name": "X-Ray Chest",
        "location": "City Hospital",
        "outcome": "Clear",
        "notes": "routine",
    }
    r = client.post("/procedures", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["id"], int)
    for key, value in payload.items():
        assert body[key] == value


def test_post_procedure_then_get_includes_new_record(client, seeded) -> None:
    r = client.post(
        "/procedures", json={"date": "2025-04-03", "procedure_name": "Physical Therapy"}
    )
    assert r.status_code == 200
    created_id = r.json()["id"]

    r2 = client.get("/procedures")
    assert r2.status_code == 200
    assert any(item["id"] == created_id for item in r2.json())
