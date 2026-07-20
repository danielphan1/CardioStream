"""Parity tests for the symbolic date resolver (API-05, D-15, Pitfall 4).

The trailing-window arithmetic is ported verbatim from
``frontend/src/lib/dates.test.ts``: with the seeded anchor 2025-06-13, the
30/7/90-day windows MUST be 2025-05-15, 2025-06-07, 2025-03-16 respectively.
If these drift, agent-issued "last 30 days" and the manual 30-days button would
resolve to different dashboards.
"""

import inspect
from datetime import date

import pytest

from app.agent import resolver as resolver_module
from app.agent.resolver import (
    InvalidRange,
    ResolvedDates,
    n_day_range,
    resolve_date_range,
)
from app.agent.schemas import AbsoluteRange, LastNDays, MonthRange, PresetRange

LATEST = date(2025, 6, 13)
EARLIEST = date(2025, 2, 22)


# --------------------------------------------------------------------------- #
# n_day_range — the raw arithmetic mirrored from resolveFilters
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "n, expected_start",
    [
        (30, date(2025, 5, 15)),
        (7, date(2025, 6, 7)),
        (90, date(2025, 3, 16)),
    ],
)
def test_n_day_range_parity_with_frontend(n, expected_start):
    assert n_day_range(LATEST, n) == (expected_start, LATEST)


# --------------------------------------------------------------------------- #
# None + PresetRange
# --------------------------------------------------------------------------- #


def test_none_input_returns_none():
    assert resolve_date_range(None, EARLIEST, LATEST) is None


def test_preset_passes_through():
    res = resolve_date_range(PresetRange(kind="preset", preset="90d"), EARLIEST, LATEST)
    assert res == ResolvedDates(date_preset="90d")


# --------------------------------------------------------------------------- #
# LastNDays
# --------------------------------------------------------------------------- #


def test_last_n_days_exact_preset():
    res = resolve_date_range(LastNDays(kind="last_n_days", n=30), EARLIEST, LATEST)
    assert res == ResolvedDates(date_preset="30d")


def test_last_n_days_arbitrary_window_emits_custom():
    res = resolve_date_range(LastNDays(kind="last_n_days", n=14), EARLIEST, LATEST)
    assert res == ResolvedDates(custom_from="2025-05-31", custom_to="2025-06-13")


def test_last_n_days_covering_everything_is_all():
    res = resolve_date_range(LastNDays(kind="last_n_days", n=500), EARLIEST, LATEST)
    assert res == ResolvedDates(date_preset="all")


def test_last_n_days_zero_is_invalid():
    with pytest.raises(InvalidRange):
        resolve_date_range(LastNDays(kind="last_n_days", n=0), EARLIEST, LATEST)


def test_last_n_days_without_anchor_is_all():
    res = resolve_date_range(LastNDays(kind="last_n_days", n=14), None, None)
    assert res == ResolvedDates(date_preset="all")


# --------------------------------------------------------------------------- #
# MonthRange
# --------------------------------------------------------------------------- #


def test_month_range_february_through_april():
    res = resolve_date_range(
        MonthRange(kind="month_range", start_month="february", end_month="april"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2025-02-01", custom_to="2025-04-30")


def test_month_range_since_june():
    res = resolve_date_range(
        MonthRange(kind="month_range", start_month="june"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2025-06-01", custom_to="2025-06-13")


def test_month_range_year_rollback():
    res = resolve_date_range(
        MonthRange(kind="month_range", start_month="december", end_month="december"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2024-12-01", custom_to="2024-12-31")


def test_month_range_cross_year_end():
    res = resolve_date_range(
        MonthRange(kind="month_range", start_month="november", end_month="february"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2024-11-01", custom_to="2025-02-28")


def test_month_range_without_anchor_is_all():
    res = resolve_date_range(
        MonthRange(kind="month_range", start_month="february", end_month="april"),
        None,
        None,
    )
    assert res == ResolvedDates(date_preset="all")


# --------------------------------------------------------------------------- #
# AbsoluteRange
# --------------------------------------------------------------------------- #


def test_absolute_passthrough():
    res = resolve_date_range(
        AbsoluteRange(kind="absolute", from_date="2025-03-01", to_date="2025-04-15"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2025-03-01", custom_to="2025-04-15")


def test_absolute_missing_from_uses_earliest():
    res = resolve_date_range(
        AbsoluteRange(kind="absolute", to_date="2025-04-15"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2025-02-22", custom_to="2025-04-15")


def test_absolute_missing_to_uses_latest():
    res = resolve_date_range(
        AbsoluteRange(kind="absolute", from_date="2025-03-01"),
        EARLIEST,
        LATEST,
    )
    assert res == ResolvedDates(custom_from="2025-03-01", custom_to="2025-06-13")


def test_absolute_both_missing_is_no_change():
    res = resolve_date_range(AbsoluteRange(kind="absolute"), EARLIEST, LATEST)
    assert res is None


def test_absolute_malformed_is_invalid():
    with pytest.raises(InvalidRange):
        resolve_date_range(
            AbsoluteRange(kind="absolute", from_date="March 1st"), EARLIEST, LATEST
        )


def test_absolute_from_after_to_is_invalid():
    with pytest.raises(InvalidRange):
        resolve_date_range(
            AbsoluteRange(kind="absolute", from_date="2025-05-01", to_date="2025-03-01"),
            EARLIEST,
            LATEST,
        )


# --------------------------------------------------------------------------- #
# Source hygiene — no today-anchoring anywhere (Pitfall 4)
# --------------------------------------------------------------------------- #


def test_resolver_never_anchors_to_today():
    source = inspect.getsource(resolver_module)
    assert "date.today" not in source
    assert "datetime.now" not in source
