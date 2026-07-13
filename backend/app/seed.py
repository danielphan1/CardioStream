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

import sys
from pathlib import Path

from app.db import SessionLocal
from app.etl import merge_readings, parse_omron, transform

# Resolve from the module's location, never cwd: backend/app/seed.py
# -> parents[0]=app, parents[1]=backend, parents[2]=repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = _BACKEND_DIR.parent
_REAL_DATA_DIR = _REPO_ROOT / "data"
_SAMPLE_PATH = _BACKEND_DIR / "sample_data" / "omron_sample.xlsx"


def resolve_source() -> tuple[Path, str]:
    """Pick the seed source per D-12.

    Returns ``(path, kind)`` where kind is ``"real"`` or ``"sample"``.
    """
    real_exports = sorted(_REAL_DATA_DIR.glob("*.xlsx"))
    if real_exports:
        return real_exports[0], "real"
    return _SAMPLE_PATH, "sample"


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

    if summary.total == 0:
        print("ERROR: seed produced an empty readings table", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
