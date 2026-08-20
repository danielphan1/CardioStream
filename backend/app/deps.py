"""Shared FastAPI dependencies for the read API (API-01/API-02).

Pinned invariants:
  - Route modules must NEVER import ``SessionLocal`` directly — all DB access
    flows through ``get_db`` so tests can override it via
    ``app.dependency_overrides[get_db]`` (RESEARCH Pitfall 10).
  - ``ReadingFilters`` is the ONE filter semantics shared by ``GET /readings``
    and ``GET /stats/summary``; Phase 3's agent resolves into this exact
    filter set — never fork per-endpoint filter logic.
  - ``end_date`` is INCLUSIVE: the DateTime column is compared ``<=`` the end
    of day (``23:59:59.999999``) on ``end_date``, so a 23:xx reading ON the
    end date is kept (RESEARCH Pitfall 4). End-of-day comparison (not
    ``end_date + 1 day``) is deliberate: it cannot overflow at
    ``date.max`` (``9999-12-31``), which must return 200, never 500.
  - Canonical BP labels are verbatim from ``app.derivations`` — spaces
    included, never snake_cased (URL-encode in query params).
  - Naive local datetimes end-to-end; no timezone handling anywhere (DATA-05).
"""

from collections.abc import Iterator
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import Query
from sqlalchemy import Select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Incident, LabResult, Procedure, Reading

# MUST match derivations.py verbatim — spaces are fine in query params.
BPCategory = Literal[
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
]


def get_db() -> Iterator[Session]:
    """Yield a request-scoped Session; tests override this dependency."""
    with SessionLocal() as session:
        yield session


class ReadingFilters:
    """Shared query-param filter set for /readings and /stats/summary.

    FastAPI parses/validates each param (``Literal`` values 422 on bad input);
    ``apply`` adds the corresponding where-clauses to any Reading select.
    """

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        am_pm: Annotated[Literal["AM", "PM"] | None, Query()] = None,
        bp_category: Annotated[BPCategory | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date
        self.am_pm = am_pm
        self.bp_category = bp_category

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        if self.start_date:
            stmt = stmt.where(
                Reading.datetime_ >= datetime.combine(self.start_date, datetime.min.time())
            )
        if self.end_date:  # inclusive end date — Pitfall 4, safe at date.max
            stmt = stmt.where(
                Reading.datetime_ <= datetime.combine(self.end_date, datetime.max.time())
            )
        if self.am_pm:
            stmt = stmt.where(Reading.am_pm == self.am_pm)
        if self.bp_category:
            stmt = stmt.where(Reading.bp_category == self.bp_category)
        return stmt


class LabFilters:
    """Date-range query-param filter set for /labs (D-04: date-range only)."""

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        if self.start_date:
            stmt = stmt.where(LabResult.date >= self.start_date)
        if self.end_date:
            stmt = stmt.where(LabResult.date <= self.end_date)
        return stmt


class ProcedureFilters:
    """Date-range query-param filter set for /procedures (D-04: date-range only)."""

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        if self.start_date:
            stmt = stmt.where(Procedure.date >= self.start_date)
        if self.end_date:
            stmt = stmt.where(Procedure.date <= self.end_date)
        return stmt


class IncidentFilters:
    """Date-range query-param filter set for /incidents (D-04: date-range only).

    ``Incident.datetime_`` is a ``DateTime`` column (not ``Date``), same as
    ``Reading.datetime_`` — mirrors ``ReadingFilters.apply``'s inclusive
    end-of-day comparison verbatim (Pitfall 4).
    """

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        if self.start_date:
            stmt = stmt.where(
                Incident.datetime_ >= datetime.combine(self.start_date, datetime.min.time())
            )
        if self.end_date:  # inclusive end date — Pitfall 4, safe at date.max
            stmt = stmt.where(
                Incident.datetime_ <= datetime.combine(self.end_date, datetime.max.time())
            )
        return stmt
