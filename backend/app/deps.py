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
from sqlalchemy import DateTime, Select
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


class DateRangeFilters:
    """Shared ``start_date``/``end_date`` filter set — the ONE date-range
    semantics behind /readings, /labs, /incidents and /procedures.

    Subclasses declare the target column as ``_model`` (the declarative class)
    plus ``_field`` (the attribute NAME, as a ``str``). The name, never the
    ``InstrumentedAttribute`` itself: that attribute is a descriptor, so
    holding it as a plain class attribute makes ``self._column`` invoke its
    ``__get__`` with the *filter* instance and raise
    ``AttributeError: 'NoneType' object has no attribute
    'supports_population'``. Resolving via ``getattr(self._model, ...)`` reads
    it off the model CLASS, where ``__get__`` correctly returns the attribute.

    ``end_date`` is INCLUSIVE on both column kinds:
      - ``DateTime`` columns (``Reading.datetime_``, ``Incident.datetime_``)
        compare ``<=`` the end of day (``23:59:59.999999``), so a 23:xx row ON
        the end date is kept (RESEARCH Pitfall 4). End-of-day comparison (not
        ``end_date + 1 day``) is deliberate: it cannot overflow at ``date.max``
        (``9999-12-31``), which must return 200, never 500.
      - ``Date`` columns (``LabResult.date``, ``Procedure.date``) are already
        inclusive under a plain ``<=``.

    FastAPI resolves ``__init__`` through the MRO, so subclasses that add no
    params of their own inherit a signature it still introspects and validates
    (asserted against the generated OpenAPI schema, not assumed).
    """

    _model: type
    _field: str

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        column = getattr(self._model, self._field)
        is_datetime = isinstance(column.type, DateTime)
        if self.start_date:
            start = (
                datetime.combine(self.start_date, datetime.min.time())
                if is_datetime
                else self.start_date
            )
            stmt = stmt.where(column >= start)
        if self.end_date:  # inclusive end date — Pitfall 4, safe at date.max
            end = (
                datetime.combine(self.end_date, datetime.max.time())
                if is_datetime
                else self.end_date
            )
            stmt = stmt.where(column <= end)
        return stmt


class ReadingFilters(DateRangeFilters):
    """Shared query-param filter set for /readings and /stats/summary.

    FastAPI parses/validates each param (``Literal`` values 422 on bad input);
    ``apply`` adds the corresponding where-clauses to any Reading select.
    """

    _model = Reading
    _field = "datetime_"

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        am_pm: Annotated[Literal["AM", "PM"] | None, Query()] = None,
        bp_category: Annotated[BPCategory | None, Query()] = None,
    ) -> None:
        super().__init__(start_date, end_date)
        self.am_pm = am_pm
        self.bp_category = bp_category

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        stmt = super().apply(stmt)
        if self.am_pm:
            stmt = stmt.where(Reading.am_pm == self.am_pm)
        if self.bp_category:
            stmt = stmt.where(Reading.bp_category == self.bp_category)
        return stmt


class LabFilters(DateRangeFilters):
    """Date-range query-param filter set for /labs (D-04: date-range only)."""

    _model = LabResult
    _field = "date"


class ProcedureFilters(DateRangeFilters):
    """Date-range query-param filter set for /procedures (D-04: date-range only)."""

    _model = Procedure
    _field = "date"


class IncidentFilters(DateRangeFilters):
    """Date-range query-param filter set for /incidents (D-04: date-range only).

    ``Incident.datetime_`` is a ``DateTime`` column (not ``Date``), same as
    ``Reading.datetime_`` — so the base applies the inclusive end-of-day
    comparison here, not the plain ``<=`` used for /labs and /procedures.
    """

    _model = Incident
    _field = "datetime_"
