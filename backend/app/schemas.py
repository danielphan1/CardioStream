"""Pydantic response models for the read API (API-01/API-02).

Pinned invariants:
  - ORM attributes are ``datetime_`` and ``map_value`` (columns ``datetime``
    and ``map``); the JSON keys MUST be the clean names ``datetime`` and
    ``map`` — bridged with ``validation_alias=AliasChoices(...)`` so
    ``from_attributes`` validation reads the attribute while serialization
    emits the clean key (RESEARCH Pitfall 3).
  - Naive datetimes serialize as plain ISO with no ``Z``/offset — never add
    timezone handling (DATA-05).
  - ``StatsSummary.categories`` always contains ALL six canonical BP labels
    in clinical order, zero-filled (interface contract with plan 02-02).
  - ``latest_reading`` is UNFILTERED — the D-11 empty state and date-preset
    anchoring need "the newest reading that exists".
"""

# Alias the type: the JSON field is literally named ``datetime``, which would
# otherwise shadow the annotation inside the model class namespace.
from datetime import datetime as DateTimeType

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ReadingOut(BaseModel):
    """One reading as served by GET /readings (API-01)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    # attribute is datetime_/map_value; JSON key is datetime/map — Pitfall 3
    datetime: DateTimeType = Field(validation_alias=AliasChoices("datetime_", "datetime"))
    systolic: int
    diastolic: int
    pulse: int
    am_pm: str
    bp_category: str
    pulse_category: str
    map: float = Field(validation_alias=AliasChoices("map_value", "map"))
    pulse_pressure: int
    notes: str | None = None


class VitalStats(BaseModel):
    """avg/min/max for one vital sign; avg rounded to 1 decimal."""

    avg: float
    min: int
    max: int


class CategoryStat(BaseModel):
    """Count + percent for one canonical BP category (always all six served)."""

    category: str
    count: int
    percent: float


class StatsSummary(BaseModel):
    """GET /stats/summary payload (API-02); D-21 renders this verbatim."""

    count: int
    systolic: VitalStats | None
    diastolic: VitalStats | None
    pulse: VitalStats | None
    categories: list[CategoryStat]
    latest_reading: str | None
