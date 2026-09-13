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

import os

import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.models import Base

# --- Ambient-environment isolation (MUST stay at module level) ----------------
# The suite must never read the developer's real backend/.env: doing so leaks a
# real ANTHROPIC_API_KEY / SITE_PASSWORD into a test run and makes results
# machine-dependent (e.g. test_config_new_fields_default_keyless asserts the
# keyless default and fails the moment a local .env sets SITE_PASSWORD).
#
# WHY THIS IS NOT AN AUTOUSE FIXTURE — a fixture runs far too late.
# `app/db.py` calls `get_settings()` at MODULE IMPORT time, and
# `tests/test_auth_upload.py` imports `app.routers.agent` -> `app.deps` ->
# `app.db` at module scope. So `Settings()` is constructed during pytest
# COLLECTION, before any fixture body executes. conftest.py, by contrast, is
# fully imported before any test module is collected, so this block is the
# earliest hook that still beats that import chain. Do NOT "tidy" it into a
# fixture: that silently reopens the hole.
#
# Neutralize the dotenv source for every bare `Settings()` / `get_settings()`
# in the suite. Per-test `monkeypatch.setenv` still takes precedence over this
# (env vars outrank the file source), so fixtures that need a value set one.
Settings.model_config["env_file"] = None
# Defensive: also drop the three secrets from the ambient process environment,
# covering a developer who exports them in the shell rather than via .env.
# DATABASE_URL / CORS_ORIGINS are deliberately NOT scrubbed — test_migrations.py
# sets its own DATABASE_URL per test and .env's value matches the code default.
for _secret in ("SITE_PASSWORD", "TOKEN_SECRET", "ANTHROPIC_API_KEY"):
    os.environ.pop(_secret, None)
get_settings.cache_clear()

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
