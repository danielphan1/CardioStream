"""Shared pytest fixtures for the ETL test suite.

OMRON export format (ASSUMED — A1/A2, blocker still open):
The real OMRON .xlsx export and bp_data_cleaned.csv were NOT provided at the
01-01 checkpoint (user chose "skip"; data/ is empty). These fixtures build the
ASSUMED format from PROJECT.md / 01-RESEARCH.md A1:

  8 columns, header on row 0:
    Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes

Because cell types are unverified (A2), tests exercise BOTH native
datetime/time cells and text values ("2025-03-01", "8:05 AM") — parse_omron
keeps a defensive `pd.to_datetime(..., errors="coerce")` branch regardless.
When the real files land in data/, re-verify this shape and update here.
"""

from __future__ import annotations

import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import Base

OMRON_COLUMNS = [
    "Date",
    "Time",
    "Systolic",
    "Diastolic",
    "Pulse",
    "Symptoms",
    "Consumed",
    "Notes",
]


@pytest.fixture
def omron_df():
    """Build an OMRON-shaped raw DataFrame from a list of row dicts.

    Missing keys are filled with None so every frame carries all 8 assumed
    columns in OMRON order.
    """

    def _build(rows: list[dict]) -> pd.DataFrame:
        filled = [{col: row.get(col) for col in OMRON_COLUMNS} for row in rows]
        return pd.DataFrame(filled, columns=OMRON_COLUMNS)

    return _build


@pytest.fixture
def omron_xlsx(tmp_path, omron_df):
    """Write an OMRON-shaped frame to a tmp .xlsx and return the path."""

    def _write(rows: list[dict], filename: str = "omron_export.xlsx"):
        df = omron_df(rows)
        path = tmp_path / filename
        df.to_excel(path, index=False)
        return path

    return _write


# --- DB fixtures (plan 01-06) -------------------------------------------------
# Unit tests use Base.metadata.create_all on a fresh in-memory SQLite engine;
# migrations are exercised ONLY in test_migrations.py (drift guard covers parity).


@pytest.fixture
def engine():
    """Function-scoped in-memory SQLite engine with the full schema created.

    StaticPool + check_same_thread=False: TestClient runs sync endpoints in a
    threadpool, so the API tests (plan 02-01) need one shared connection that
    is usable across threads — behavior-neutral for single-threaded ETL tests.
    """
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session(engine):
    """A Session bound to the function-scoped in-memory engine."""
    with Session(engine) as s:
        yield s


# --- API fixtures (plan 02-01) -------------------------------------------------
# Endpoint tests reuse the in-memory `session` fixture by overriding the app's
# get_db dependency (RESEARCH Pitfall 10) — the module-level engine in app.db
# is never hit by tests.


@pytest.fixture
def client(session):
    """TestClient wired to the in-memory session via dependency override."""
    from fastapi.testclient import TestClient

    from app.auth import verify_token
    from app.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[verify_token] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
