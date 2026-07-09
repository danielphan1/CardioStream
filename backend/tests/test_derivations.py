"""Tests for MAP, pulse pressure, and AM/PM derivations (DATA-02, DATA-07).

Pinned conventions:
  - MAP = (systolic + 2*diastolic) / 3, rounded to 1 decimal, returned as float
    (golden-master diffs use atol=0.05).
  - Pulse pressure = systolic - diastolic, integer.
  - AM/PM: hour <12 -> "AM", else "PM" (noon exactly is "PM").
  - Datetimes are naive local time end-to-end (DATA-05) — every datetime passed
    to derive_am_pm here is tzinfo-free, asserted explicitly.
"""

from datetime import datetime

import pytest

from app.derivations import compute_map, compute_pulse_pressure, derive_am_pm


def test_compute_map_120_80() -> None:
    result = compute_map(120, 80)
    assert isinstance(result, float)
    assert result == pytest.approx(93.3, abs=0.05)


def test_compute_map_90_60() -> None:
    result = compute_map(90, 60)
    assert isinstance(result, float)
    assert result == pytest.approx(70.0, abs=0.05)


def test_compute_pulse_pressure_is_int() -> None:
    result = compute_pulse_pressure(120, 80)
    assert result == 40
    assert isinstance(result, int)


@pytest.mark.parametrize(
    ("dt", "expected"),
    [
        (datetime(2025, 3, 1, 0, 0), "AM"),  # midnight exactly is AM
        (datetime(2025, 3, 1, 11, 59), "AM"),
        (datetime(2025, 3, 1, 12, 0), "PM"),  # noon exactly is PM
        (datetime(2025, 3, 1, 23, 59), "PM"),
    ],
)
def test_derive_am_pm_boundaries(dt: datetime, expected: str) -> None:
    # DATA-05 convention: naive local datetimes only — no tzinfo anywhere.
    assert dt.tzinfo is None
    assert derive_am_pm(dt) == expected
