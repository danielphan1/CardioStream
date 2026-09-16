"""Tests for app.seed's seed_records() (labs/incidents/procedures) and its
mandatory wiring into main() (D-05, D-07, D-11).

The first three tests call seed_records(session) directly against the
in-memory conftest fixtures. The fourth test is the load-bearing one: it runs
the ACTUAL `python -m app.seed` entry point as a subprocess against a fresh,
empty, migrated SQLite file, proving the wiring is real — not just a function
that exists and is callable in isolation (app/db.py's engine/SessionLocal bind
to DATABASE_URL at import time, so a genuine subprocess is the only clean way
to exercise a different database without monkeypatching seed.py's internals).
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from app.models import Incident, LabResult, Procedure
from app.seed import seed_records

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_seed_records_populates_empty_tables(session):
    counts = seed_records(session)
    assert counts == {"labs": 8, "incidents": 5, "procedures": 5}
    assert session.query(LabResult).count() == 8
    assert session.query(Incident).count() == 5
    assert session.query(Procedure).count() == 5


def test_seed_records_is_idempotent_on_second_call(session):
    seed_records(session)
    counts = seed_records(session)
    assert counts == {"labs": 0, "incidents": 0, "procedures": 0}
    assert session.query(LabResult).count() == 8
    assert session.query(Incident).count() == 5
    assert session.query(Procedure).count() == 5


def test_seed_records_maps_incident_datetime_field_correctly(session):
    seed_records(session)
    incident = session.query(Incident).first()
    assert incident is not None
    assert isinstance(incident.datetime_, datetime)


def test_main_via_actual_entry_point_populates_all_four_tables(tmp_path, monkeypatch):
    from alembic import command
    from alembic.config import Config

    from app.config import get_settings

    db_path = tmp_path / "demo_seed.db"
    db_url = f"sqlite:///{db_path}"

    # env.py reads DATABASE_URL via get_settings() (lru_cached), same pattern
    # as test_migrations.py's migrated_db_url fixture.
    monkeypatch.setenv("DATABASE_URL", db_url)
    get_settings.cache_clear()

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")

    get_settings.cache_clear()

    result = subprocess.run(
        [sys.executable, "-m", "app.seed"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": db_url},
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"stderr:\n{result.stderr}\nstdout:\n{result.stdout}"

    conn = sqlite3.connect(db_path)
    try:
        for table in ("readings", "lab_results", "incidents", "procedures"):
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            assert count > 0, f"{table} has 0 rows after seeding"
    finally:
        conn.close()
