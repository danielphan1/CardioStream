"""Migration smoke test — the drift guard (RESEARCH Pitfall 7).

Unit tests elsewhere use ``Base.metadata.create_all`` for speed, so this module
is the ONLY place the Alembic migrations are exercised. It proves that
``alembic upgrade head`` on an empty database produces exactly the tables the
models declare, and that the readings ``datetime`` column is timezone-free
(DATA-05).
"""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import DateTime, create_engine, inspect

from app.models import Base

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture()
def migrated_db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    """Run ``alembic upgrade head`` against a fresh tmp SQLite file, return its URL."""
    db_url = f"sqlite:///{tmp_path / 'migrations.db'}"
    # env.py reads the URL from app settings (DATABASE_URL); get_settings is
    # lru_cached, so clear it around the override.
    from app.config import get_settings

    monkeypatch.setenv("DATABASE_URL", db_url)
    get_settings.cache_clear()

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")

    yield db_url

    get_settings.cache_clear()


def test_upgrade_head_creates_exactly_the_model_tables(migrated_db_url: str) -> None:
    """Reflected tables == Base.metadata tables — models/migrations parity."""
    inspector = inspect(create_engine(migrated_db_url))
    reflected = set(inspector.get_table_names()) - {"alembic_version"}
    assert reflected == set(Base.metadata.tables.keys())
    assert reflected == {"readings", "lab_results", "incidents", "procedures"}


def test_readings_datetime_column_is_naive(migrated_db_url: str) -> None:
    """DATA-05: the readings datetime column reflects with no timezone."""
    inspector = inspect(create_engine(migrated_db_url))
    columns = {c["name"]: c for c in inspector.get_columns("readings")}
    dt_type = columns["datetime"]["type"]
    assert isinstance(dt_type, DateTime)
    assert getattr(dt_type, "timezone", False) is False


def test_readings_unique_datetime_constraint_survives_migration(migrated_db_url: str) -> None:
    """DATA-03: the named unique constraint exists on the migrated schema."""
    inspector = inspect(create_engine(migrated_db_url))
    unique_names = [u["name"] for u in inspector.get_unique_constraints("readings")]
    assert "uq_readings_datetime" in unique_names
