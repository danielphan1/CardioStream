# Phase 1: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 1-Data Foundation
**Areas discussed:** Category edge rules, Re-ingest conflict policy, Synthetic sample design, Data files & seeding flow

---

## Category edge rules

**Q1: Source of truth for category logic vs bp_data_cleaned.csv golden master?**

| Option | Description | Selected |
|--------|-------------|----------|
| Textbook AHA, verify vs CSV | Implement published AHA rules + documented Hypotension rule from scratch, diff against CSV; investigate mismatches — CSV could have bugs | ✓ |
| CSV is the spec | Reverse-engineer whatever logic produced the CSV and match exactly | |
| You decide | Claude picks and documents | |

**Q2: Hypotension definition?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sys <90 OR dia <60 | Common clinical definition; either number low counts; checked before AHA ladder | ✓ |
| Sys <90 AND dia <60 | Stricter — both numbers must be low | |
| Systolic-only <90 | Only systolic decides | |

**Q3: When systolic and diastolic fall in different AHA categories, which wins?**

| Option | Description | Selected |
|--------|-------------|----------|
| Higher category wins | Standard AHA guidance — more severe number classifies | ✓ |
| Systolic decides | Classify purely on systolic | |
| You decide | Claude picks and documents | |

**Q4: Where does Tachycardia start (Bradycardia locked at <60)?**

| Option | Description | Selected |
|--------|-------------|----------|
| >100 bpm | Standard resting definition — Normal 60–100 inclusive, Tachycardia 101+ | ✓ |
| ≥100 bpm | Normal 60–99; 100 counts as Tachycardia | |
| You decide | Claude picks, checking the cleaned CSV | |

---

## Re-ingest conflict policy

**Q1: Existing datetime re-appears with different values?**

| Option | Description | Selected |
|--------|-------------|----------|
| Update in place | Upsert — incoming file is truth; edits are deliberate corrections; counted as 'updated' | ✓ |
| Skip, keep existing | First write wins; edits never propagate | |
| Skip and flag | Keep existing, report conflict for manual decision | |

**Q2: ETL result summary shape?**

| Option | Description | Selected |
|--------|-------------|----------|
| Added / updated / unchanged | Three counts + total + latest reading date; carries to Phase 5 upload page | ✓ |
| Added / skipped only | Two counts; updates fold into 'skipped' | |
| You decide | Claude picks | |

**Q3: Intra-file duplicate datetimes (minute-granularity collisions)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Last row wins, log it | Keep last occurrence in file order, surface in summary | ✓ |
| Fail the ingest | Reject file, report colliding rows | |
| You decide | Claude picks after inspecting the real export | |

**Q4: Rows with missing/unparseable values?**

| Option | Description | Selected |
|--------|-------------|----------|
| Skip row, report it | Rejected list with per-row reason; bad cell never blocks the rest | ✓ |
| Fail the whole file | All-or-nothing | |
| Ingest partial rows | Store with NULL vitals and NULL derived fields | |

---

## Synthetic sample design

**Q1: How is the committed synthetic sample produced?**

| Option | Description | Selected |
|--------|-------------|----------|
| Generator script + committed output | Seeded-random script; script AND output committed; regenerable, portfolio evidence | ✓ |
| Hand-crafted static file | Write rows by hand, commit the file only | |
| Generated at runtime only | No committed data file | |

**Q2: How faithful to Chris's real distribution?**

| Option | Description | Selected |
|--------|-------------|----------|
| Match the character | ~130 rows, same Feb–Jun span, ~88% bradycardic, systolic ~60–211, every category, mixed AM/PM | ✓ |
| Every-category coverage only | ~30 engineered rows; sparse demo charts | |
| Statistically cloned | Fit distributions to real data; risks leaking characteristics | |

**Q3: Sample file format?**

| Option | Description | Selected |
|--------|-------------|----------|
| OMRON-format .xlsx | Mimics raw export exactly; exercises real ingest path; Phase 5 demo file | ✓ |
| Plain CSV | Readable diffs but bypasses Excel parsing path | |
| Both xlsx + CSV | Both formats, kept in sync by generator | |

**Q4: How does the seeder choose real vs synthetic?**

| Option | Description | Selected |
|--------|-------------|----------|
| Real if present, else synthetic | One zero-config seed command for dev machine, fresh clones, CI | ✓ |
| Explicit file argument | Seeder always takes a path | |
| Two commands | Separate seed-real / seed-demo entry points | |

---

## Data files & seeding flow

**Q1: Where do real data files live, and when added?**

| Option | Description | Selected |
|--------|-------------|----------|
| data/ dir, add before execution | Top-level gitignored data/; files added before execution so ETL is built against the real format | ✓ |
| data/ dir, add during phase | Same layout, files land mid-phase | |
| Different location | User specifies another layout | |

**Q2: What does the seeder ingest; role of bp_data_cleaned.csv?**

| Option | Description | Selected |
|--------|-------------|----------|
| Raw xlsx → ETL; CSV is test-only | Full ETL path for seeding; CSV is only the golden-master test fixture | ✓ |
| Seed from cleaned CSV | Load CSV directly; two ingest paths | |
| You decide | Claude picks | |

**Q3: Monorepo layout?**

| Option | Description | Selected |
|--------|-------------|----------|
| backend/ + frontend/ from day one | Matches Vercel/Railway deploy split; no restructuring later | ✓ |
| Backend at repo root | Flatter now, nested frontend later | |
| You decide | Claude picks | |

**Q4: Seeder invocation?**

| Option | Description | Selected |
|--------|-------------|----------|
| python -m app.seed | Module entry point sharing ETL, models, settings with the API | ✓ |
| Make/task runner target | Wrap module in make/justfile target | |
| You decide | Claude picks | |

---

## Claude's Discretion

- MAP formula precision/rounding
- Numeric column precision
- Alembic migration granularity (one vs. two migrations)
- Test fixture organization
- Synthetic generator script internals

## Deferred Ideas

None — discussion stayed within phase scope.

## Session Note

Discussion was interrupted once mid-way through the fourth area (Data files & seeding flow) and resumed via `/gsd-resume-work` from `01-DISCUSS-CHECKPOINT.json` in the same session; no decisions were lost.
