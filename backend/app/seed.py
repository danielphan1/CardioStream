"""CLI seeder: ``python -m app.seed`` from ``backend/`` (D-16).

Thin wrapper over the shared ETL — pick a source file, run the FULL pipeline
(``parse_omron`` -> ``transform`` -> ``merge_readings``), print the D-06
IngestSummary. This is the exact code path the Phase 5 upload route will use;
the seeder adds NO logic of its own (D-14).

Source selection (D-12): if any real OMRON export exists in the gitignored
``data/`` directory at the repo root, the first (sorted) ``*.xlsx`` is used;
otherwise the committed synthetic sample ``backend/sample_data/omron_sample.xlsx``
is used, so fresh clones and CI seed zero-config.

The cleaned golden-master CSV is a test fixture ONLY and is never read here —
loading it into the DB would bypass the ETL path the tests exercise (D-14).

Assumes a migrated DB: run ``alembic upgrade head`` first. The seeder never
calls ``create_all`` — if tables are missing, the error surfaces as-is.

Log hygiene (T-1-04): output contains the source path, counts, rejection
reasons, and dates — never systolic/diastolic/pulse values.
"""

from __future__ import annotations

import json
import sys
from datetime import date as date_cls
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.etl import merge_readings, parse_omron, transform
from app.models import Incident, LabResult, Procedure

# Resolve from the module's location, never cwd: backend/app/seed.py
# -> parents[0]=app, parents[1]=backend, parents[2]=repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = _BACKEND_DIR.parent
_REAL_DATA_DIR = _REPO_ROOT / "data"
_SAMPLE_PATH = _BACKEND_DIR / "sample_data" / "omron_sample.xlsx"
_DEMO_RECORDS_PATH = _BACKEND_DIR / "sample_data" / "demo_records.json"


def resolve_source() -> tuple[Path, str]:
    """Pick the seed source per D-12.

    Returns ``(path, kind)`` where kind is ``"real"`` or ``"sample"``.
    """
    real_exports = sorted(_REAL_DATA_DIR.glob("*.xlsx"))
    if real_exports:
        return real_exports[0], "real"
    return _SAMPLE_PATH, "sample"


def seed_records(session: Session) -> dict[str, int]:
    """Idempotently seed labs/incidents/procedures from the committed demo fixture.

    Guests are read-only (D-03) and seeding is a one-time CLI action, so per
    D-07 there is no data-drift/reset problem to solve: a table that already
    has rows is left untouched and is simply a terminal state, not an error.
    Returns the number of rows ADDED per table (0 if that table was already
    populated), keyed ``"labs"``/``"incidents"``/``"procedures"``.

    ``demo_records.json``'s ``date``/``datetime`` fields are plain JSON
    strings (ISO format) — SQLite's strict ``Date``/``DateTime`` bind
    processors reject anything but real ``date``/``datetime`` objects, so
    both are parsed via ``fromisoformat`` before construction, matching the
    naive-local-time convention every other DATA-05 write path in this
    codebase already follows.
    """
    fixture = json.loads(_DEMO_RECORDS_PATH.read_text())
    counts: dict[str, int] = {}

    for model, key in ((LabResult, "labs"), (Incident, "incidents"), (Procedure, "procedures")):
        existing = session.scalar(select(func.count()).select_from(model))
        if existing and existing > 0:
            counts[key] = 0
            continue

        if model is Incident:
            rows = [
                Incident(
                    datetime_=datetime.fromisoformat(row["datetime"]),
                    incident_type=row["incident_type"],
                    duration=row.get("duration"),
                    notes=row.get("notes"),
                )
                for row in fixture[key]
            ]
        else:
            rows = [
                model(**{**row, "date": date_cls.fromisoformat(row["date"])})
                for row in fixture[key]
            ]

        session.add_all(rows)
        counts[key] = len(rows)

    session.commit()
    return counts


def main() -> int:
    source, kind = resolve_source()
    print(f"source ({kind}): {source}")

    raw = parse_omron(source)
    clean, rejected = transform(raw)

    with SessionLocal() as session:
        summary = merge_readings(session, clean, rejected)

    print(f"added:     {summary.added}")
    print(f"updated:   {summary.updated}")
    print(f"unchanged: {summary.unchanged}")
    print(f"rejected:  {len(summary.rejected)}")
    for rej in summary.rejected:
        print(f"  - row {rej.row_index}: {rej.reason}")
    print(f"total:     {summary.total}")
    print(f"latest:    {summary.latest}")

    # Mandatory, non-fatal: labs/incidents/procedures seeding never blocks the
    # readings seed above from succeeding or returning its own exit code
    # (D-05, D-07 — see seed_records' docstring).
    try:
        with SessionLocal() as session:
            counts = seed_records(session)
        print(f"labs seeded:       {counts['labs']}")
        print(f"incidents seeded:  {counts['incidents']}")
        print(f"procedures seeded: {counts['procedures']}")
    except Exception as exc:  # noqa: BLE001 - deliberately broad, never fatal
        print(
            f"WARNING: seed_records failed (readings seed still succeeded): {exc}", file=sys.stderr
        )

    if summary.total == 0:
        print("ERROR: seed produced an empty readings table", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
