# Health Visualizer — Chris's Health Dashboard

A personal health data dashboard for a single user: Chris, a C4 quadriplegic individual who tracks blood pressure, pulse, and other health metrics. It replaces an earlier Tableau Public prototype with a voice-controlled web app — Chris explores his data entirely hands-free ("show me my blood pressure for the last 30 days, mornings only"), while his wife and caregivers use the site to enter new readings. Built on a consistent Python (FastAPI, pandas, SQLAlchemy) + React (Vite, Recharts) stack as a data/software engineering and applied-AI portfolio project.

## Privacy

Real health data lives in the gitignored `data/` directory and is **never committed** to this repository. Only a synthetic, seeded-random sample dataset (matching the real data's shape and statistical character) is committed for development, tests, and demos.

Full setup and seeding documentation will be added as the backend lands.
