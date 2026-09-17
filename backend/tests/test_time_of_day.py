"""Tests for the query-time-only time-of-day boundary classifier (PH15-03).

Pinned conventions (app.deps, not app.derivations — see classify_time_of_day's
docstring for why):
  - Morning: 5-11, Afternoon: 12-16, Evening: 17-20, Night: 21-23 and 0-4
    (wraps midnight — the one bucket that is not a simple ascending range).
  - The four ranges partition all 24 hours; every hour matches exactly one
    bucket.
"""

import pytest

from app.deps import classify_time_of_day


@pytest.mark.parametrize(
    ("hour", "expected"),
    [
        (4, "Night"),  # last hour of the wrap
        (5, "Morning"),  # wrap ends, Morning begins
        (11, "Morning"),
        (12, "Afternoon"),
        (16, "Afternoon"),
        (17, "Evening"),
        (20, "Evening"),
        (21, "Night"),  # Night begins
        (23, "Night"),
        (0, "Night"),  # midnight, mid-wrap
    ],
)
def test_classify_time_of_day_boundaries(hour: int, expected: str) -> None:
    assert classify_time_of_day(hour) == expected
