# Health Visualizer — Chris's Health Dashboard

A personal health data dashboard for a single user: Chris, a C4 quadriplegic individual who tracks blood pressure, pulse, and other health metrics. It replaces an earlier Tableau Public prototype with a voice-controlled web app — Chris explores his data entirely hands-free ("show me my blood pressure for the last 30 days, mornings only"), while his wife and caregivers use the site to enter new readings. Built on a consistent Python (FastAPI, pandas, SQLAlchemy) + React (Vite, Recharts) stack as a data/software engineering and applied-AI portfolio project.

## Setup

Backend requires Python 3.12+:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'      # deps pinned in backend/pyproject.toml
alembic upgrade head          # create the SQLite dev DB (dev.db) — run before seeding
```

`DATABASE_URL` defaults to `sqlite:///./dev.db`; set it in the environment to point at Postgres in production.

Run the test suite with:

```bash
cd backend && python -m pytest tests -q
```

## Seeding

```bash
cd backend && python -m app.seed
```

The seeder picks its source automatically:

1. If a real OMRON export (`*.xlsx`) exists in the gitignored `data/` directory at the repo root, the first one (sorted) is used.
2. Otherwise the committed synthetic sample `backend/sample_data/omron_sample.xlsx` is used — so fresh clones and CI seed zero-config.

Either way the file runs through the **full ETL pipeline** (parse → derive → idempotent merge), the exact code path future uploads use. Output looks like:

```
source (sample): .../backend/sample_data/omron_sample.xlsx
added:     132
updated:   0
unchanged: 0
rejected:  0
total:     132
latest:    2025-06-13 07:36:00
```

Re-running is safe: the merge is idempotent (an unchanged file reports `added: 0`, `unchanged: 132`). The seeder requires a migrated DB — run `alembic upgrade head` first.

## Synthetic sample

`backend/sample_data/omron_sample.xlsx` is a **synthetic** 132-row OMRON-format dataset containing **no real health data**. It is generated deterministically (seeded, byte-reproducible) by:

```bash
cd backend && python scripts/generate_sample.py
```

It matches the real data's documented statistical character (row count, date span, ~88% bradycardia share, all six BP categories) and serves as the seeder fallback, the CI/dev dataset, and the upload demo file.

## Privacy

Real health data lives in the gitignored `data/` directory and is **never committed** to this repository. Only the synthetic sample described above is committed for development, tests, and demos.

- `data/` (real OMRON exports and the cleaned reference CSV) is gitignored; the full git history is audited to contain no file under `data/`.
- The local database file (`dev.db`, which contains real readings after seeding on the dev machine) is gitignored via `*.db`.
- Seeder and test output never print blood-pressure or pulse values — counts, rejection reasons, and dates only.
- Derived medical categories follow the [AHA blood-pressure categories](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings) (retained unchanged by the 2025 AHA/ACC guideline), with one documented extension: a Hypotension gate (systolic <90 or diastolic <60) checked before the AHA ladder.
