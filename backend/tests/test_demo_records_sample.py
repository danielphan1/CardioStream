"""Character regression tests for the committed synthetic demo records fixture.

Pins the shape of backend/sample_data/demo_records.json (labs/incidents/
procedures) produced by scripts/generate_demo_records.py. Reads the
committed file directly with stdlib json — mirrors test_sample.py's
"assert the file exists first, fail loudly" precondition and
one-assertion-per-test granularity.
"""

import json
from pathlib import Path

import pytest

DEMO_RECORDS_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "demo_records.json"


@pytest.fixture(scope="module")
def fixture() -> dict:
    assert DEMO_RECORDS_PATH.is_file(), f"committed demo fixture missing: {DEMO_RECORDS_PATH}"
    return json.loads(DEMO_RECORDS_PATH.read_text())


def test_all_three_tables_present(fixture):
    assert set(fixture) == {"labs", "incidents", "procedures"}


def test_no_table_is_empty(fixture):
    assert all(fixture.values())


def test_labs_covers_multiple_test_names(fixture):
    assert len({row["test_name"] for row in fixture["labs"]}) >= 2


def test_labs_has_in_range_and_out_of_range_results(fixture):
    in_range = any(
        row["range_low"] <= row["result"] <= row["range_high"] for row in fixture["labs"]
    )
    out_of_range = any(
        not (row["range_low"] <= row["result"] <= row["range_high"]) for row in fixture["labs"]
    )
    assert in_range, "no lab row falls inside its own range_low/range_high band"
    assert out_of_range, "no lab row falls outside its own range_low/range_high band"


def test_incidents_covers_multiple_types(fixture):
    assert len({row["incident_type"] for row in fixture["incidents"]}) >= 2


def test_procedures_covers_multiple_outcomes(fixture):
    assert len({row["outcome"] for row in fixture["procedures"]}) >= 2
