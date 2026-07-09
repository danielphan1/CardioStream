"""SQLAlchemy 2.0 typed declarative models.

All datetimes are naive local time — no timezone anywhere in the schema (DATA-05).
Only portable column types are used (Integer, Numeric, Text, DateTime) so the same
models run on SQLite (dev) and Postgres (prod).

The naming convention names every constraint at model-definition time so SQLite
batch migrations can drop them later and autogenerate diffs stay reproducible
on both databases.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, MetaData, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)


class Reading(Base):
    """One blood-pressure/pulse reading with derived categorizations.

    Attribute names ``datetime_`` and ``map_value`` avoid shadowing the
    ``datetime`` module and the ``map`` builtin; the database column names
    remain ``datetime`` and ``map`` per the PROJECT.md schema sketch.
    """

    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Naive local time — plain DateTime, never the tz-aware variant (DATA-05).
    datetime_: Mapped[datetime] = mapped_column("datetime", DateTime, nullable=False)
    systolic: Mapped[int] = mapped_column(Integer)
    diastolic: Mapped[int] = mapped_column(Integer)
    pulse: Mapped[int] = mapped_column(Integer)
    am_pm: Mapped[str] = mapped_column(Text)
    bp_category: Mapped[str] = mapped_column(Text)
    pulse_category: Mapped[str] = mapped_column(Text)
    # asdecimal=False -> floats consistently on SQLite and Postgres (RESEARCH Pitfall 6).
    map_value: Mapped[float] = mapped_column("map", Numeric(5, 1, asdecimal=False))
    pulse_pressure: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # DATA-03 hard guarantee: duplicate reading datetimes are structurally impossible.
    __table_args__ = (UniqueConstraint("datetime"),)


# Future tables (DATA-06): migrated but intentionally EMPTY in v1 — no seed data, no API.


class LabResult(Base):
    """Lab test result (future data; table stays empty in v1 per DATA-06)."""

    __tablename__ = "lab_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    test_name: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[float | None] = mapped_column(Numeric(asdecimal=False), nullable=True)
    unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    range_low: Mapped[float | None] = mapped_column(Numeric(asdecimal=False), nullable=True)
    range_high: Mapped[float | None] = mapped_column(Numeric(asdecimal=False), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Incident(Base):
    """Health incident, e.g. passing out or hospitalization (future data, empty in v1)."""

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Naive local time, same DATA-05 rule as readings.
    datetime_: Mapped[datetime] = mapped_column("datetime", DateTime, nullable=False)
    incident_type: Mapped[str] = mapped_column(Text, nullable=False)
    duration: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Procedure(Base):
    """Medical procedure (future data, empty in v1)."""

    __tablename__ = "procedures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    procedure_name: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
