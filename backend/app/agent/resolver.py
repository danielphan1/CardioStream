"""Symbolic date-range resolver — server-side, anchored to the data (API-05, D-15).

Claude NEVER computes absolute dates (API-05): it emits symbolic tokens
(preset / last_n_days / month_range / absolute) and this module turns them into
either a store preset token ("7d"/"30d"/"90d"/"all") or a concrete inclusive
``customRange`` of "YYYY-MM-DD" strings.

INVARIANT (RESEARCH Pitfall 4, and enforced by a source-hygiene test): this
module MUST mirror ``frontend/src/lib/dates.ts resolveFilters`` arithmetic and
NEVER read the wall clock (no current-date lookups). Presets anchor to the
LATEST reading, not today — the seeded data ends 2025-06-13, so today-anchoring
would render an empty dashboard forever. The trailing N-day window is
``anchor - (N - 1) .. anchor`` inclusive; the emitted ``custom_to`` feeds the
read API's INCLUSIVE ``end_date`` semantics (app.deps, Pitfall 4).
"""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta

from app.agent.schemas import (
    AbsoluteRange,
    DateRange,
    LastNDays,
    MonthRange,
    PresetRange,
)

# Month token → month number (tokens are the lowercase MonthToken values).
_MONTHS: dict[str, int] = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

# The exact presets the store understands; every other N maps to a customRange.
_PRESET_DAYS: dict[int, str] = {7: "7d", 30: "30d", 90: "90d"}


class InvalidRange(Exception):
    """Unresolvable symbolic range — the service maps this to an ``unclear`` reply."""


@dataclass(frozen=True)
class ResolvedDates:
    """Either a store preset token OR a concrete inclusive custom range.

    Exactly one form is populated: ``date_preset`` set (custom_* None), or both
    ``custom_from``/``custom_to`` set (date_preset None).
    """

    date_preset: str | None = None
    custom_from: str | None = None
    custom_to: str | None = None


def _preset(token: str) -> ResolvedDates:
    return ResolvedDates(date_preset=token)


def _custom(start: date, end: date) -> ResolvedDates:
    return ResolvedDates(custom_from=start.isoformat(), custom_to=end.isoformat())


def n_day_range(latest: date, n: int) -> tuple[date, date]:
    """Trailing N-day window ending on (and including) ``latest``.

    Mirrors ``resolveFilters`` exactly: ``anchor - (N - 1) .. anchor`` inclusive.
    Exposed separately so parity tests hit the raw arithmetic (Pitfall 4).
    """
    return latest - timedelta(days=n - 1), latest


def resolve_date_range(
    dr: DateRange | None,
    earliest: date | None,
    latest: date | None,
) -> ResolvedDates | None:
    """Resolve a symbolic ``DateRange`` to a preset/custom window, anchored to the data.

    Returns ``None`` when the range leaves dates unchanged (D-13 carry-over).
    Raises ``InvalidRange`` for garbage the service should turn into ``unclear``.
    """
    if dr is None:
        return None

    if isinstance(dr, PresetRange):
        return _preset(dr.preset)

    if isinstance(dr, LastNDays):
        return _resolve_last_n_days(dr, earliest, latest)

    if isinstance(dr, MonthRange):
        return _resolve_month_range(dr, latest)

    if isinstance(dr, AbsoluteRange):
        return _resolve_absolute(dr, earliest, latest)

    raise InvalidRange(f"unknown date range: {dr!r}")  # pragma: no cover - union is closed


def _resolve_last_n_days(
    dr: LastNDays, earliest: date | None, latest: date | None
) -> ResolvedDates:
    if dr.n < 1:
        raise InvalidRange(f"last_n_days needs n >= 1, got {dr.n}")
    if dr.n in _PRESET_DAYS:
        return _preset(_PRESET_DAYS[dr.n])
    if latest is None:
        return _preset("all")
    start, end = n_day_range(latest, dr.n)
    # Window covers everything we have → honest "all" confirmation.
    if earliest is not None and start <= earliest:
        return _preset("all")
    return _custom(start, end)


def _resolve_month_range(dr: MonthRange, latest: date | None) -> ResolvedDates:
    if latest is None:
        return _preset("all")

    start_num = _MONTHS[dr.start_month]
    year = dr.year or latest.year
    start = date(year, start_num, 1)
    if start > latest:  # inferred year is in the future → roll back one year (A5)
        start = date(year - 1, start_num, 1)

    if dr.end_month is None:  # "since <month>" → through the latest reading (D-15)
        end = latest
    else:
        end_num = _MONTHS[dr.end_month]
        # End rolls into the next year when it precedes the start month
        # ("November through February").
        end_year = start.year + 1 if end_num < start_num else start.year
        end = date(end_year, end_num, monthrange(end_year, end_num)[1])

    return _custom(start, end)


def _resolve_absolute(
    dr: AbsoluteRange, earliest: date | None, latest: date | None
) -> ResolvedDates | None:
    if dr.from_date is None and dr.to_date is None:
        return None  # nothing specified → no date change (D-13)

    if dr.from_date is not None:
        start = _parse_iso(dr.from_date)
    elif earliest is not None:
        start = earliest
    else:
        return _preset("all")

    if dr.to_date is not None:
        end = _parse_iso(dr.to_date)
    elif latest is not None:
        end = latest
    else:
        return _preset("all")

    if start > end:
        raise InvalidRange(f"from ({start}) is after to ({end})")
    return _custom(start, end)


def _parse_iso(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:  # "March 1st", "2025/03/01", etc.
        raise InvalidRange(f"not an ISO date: {value!r}") from exc
