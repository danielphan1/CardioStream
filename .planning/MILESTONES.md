# Milestones

## v1.0 MVP (Shipped: 2026-08-05)

**Phases completed:** 5 phases, 29 plans, 46 tasks

**Key accomplishments:**

- Privacy gate (.gitignore covering data/ committed first) plus backend/ scaffold with pinned pandas 3/SQLAlchemy 2 deps, pydantic-settings config, and sync engine; real data files explicitly deferred by user ("skip")
- SQLAlchemy 2.0 typed declarative schema (Reading with named unique naive-datetime constraint + 3 empty future tables) managed by Alembic batch-mode migrations, with a smoke test pinning models-vs-migrations parity
- Pure derivations module built test-first: verified AHA BP ladder with D-02 hypotension gate and D-03 severity-max, D-04 pulse categories, MAP (1-decimal float), pulse pressure (int), AM/PM (noon=PM, naive datetimes) — 29 boundary tests green
- Pure ETL built TDD: parse_omron reads (assumed-format) OMRON xlsx from path or buffer into a naive-datetime raw frame with a 10k-row DoS guard; transform derives all five columns exclusively via app.derivations with D-07 last-wins dedupe and D-08 per-row hygiene-safe rejection — 52 tests green
- Seeded byte-reproducible generator (SEED=20250222) + committed 132-row OMRON-format xlsx matching the real data's documented character (87.9% bradycardic, systolic 60-211, all six BP categories), pinned by 7 regression tests importing classify_bp/classify_pulse
- merge_readings built TDD: Python-level idempotent merge keyed on the reading datetime (never session.merge, never ON CONFLICT), D-05 file-is-truth upsert with recomputed derived columns, single-transaction commit, returning the frozen D-06 IngestSummary — double-ingest/overlap/constraint/naive-round-trip all proven, 68 tests green
- `python -m app.seed` seeds through the full parse→transform→merge pipeline (132 added on run 1, 0/132 unchanged on run 2 from the synthetic fallback — data/ absent per D-12), golden-master test ships skipif-guarded with a provisional LABEL_MAP, and the full-history privacy audit is clean (only the synthetic sample ever committed)
- Verification Gap 1 (blocker) closed TDD-style: '118.5'/'inf'/129.9 vitals now become hygiene-safe RejectedRows instead of aborting the file or silently truncating across an AHA boundary, NaN notes converge on re-ingest, stored natural keys are minute-floored to match D-07, and ambiguous slash dates are rejected rather than guessed month-first — 79 passed, 7 skipped
- Nautical header with labeled theme toggle plus a fully keyboard-operable filter bar (presets, AM/PM, category chips, 48px-cell custom calendar) wired to the 02-03 zustand store.
- Typed POST client, backend-contract TS mirrors, and the proven store-mutation + confirmation-composition primitives that make the CommandBar (03-04) and Phase 4 voice pure consumers.
- The visible half of the text→agent→dashboard loop: a full-width command bar with a five-state machine (idle/working/confirmed/clarify/error), in-bar aria-live confirmations, one-turn clarify memory, and a motion-safe FilterBar pulse — all deterministically tested with no backend dependency.
- Pure DOM-free voice primitives (wake-word gating/stripping, iOS + capability detection, recoverable-vs-fatal error classification, restart backoff), an injectable FakeRecognition test double with ambient SpeechRecognition types, and a VOICE-05/ACC-03 lockstep parity test that fails on any frontend↔backend vocabulary drift.
- A single long-lived webkitSpeechRecognition instance behind one testable hook: wake-word-gated command capture with a stripped live transcript, a monotonic newest-wins seq guard that drops superseded late replies, and an invisible onend/onerror restart loop (classifyError + computeBackoff) that survives silence auto-stops, refuses to loop on fatal errors (paused per D-14), pauses when backgrounded, and tears down cleanly — all proven against FakeRecognition in CI.
- The hands-free voice experience mounted on the existing command bar — a ≥48px mic button, a color+word+icon three-state indicator (green LISTENING pulse / amber WORKING / MicOff paused) with a reduced-motion fallback, and a live green stripped transcript replaced in-place by the confirmation — with the real-iOS restart loop and a 10-minute continuous session verified and APPROVED on device.
- Caregiver upload page that ingests an OMRON .xlsx immediately and reports a plain-language IngestSummary, reached via a discreet zustand view-swap Header control, with a focus-trapped logout confirm dialog.
- Live MVP verified private and working: automated curl smoke proves the auth gate on every route, the human live-site flow passes, and the SEC-03 audit confirms no trackers, a private DB, and clean logs — closing milestone v1.0.

**Known limitation at ship (deferred to v2):** The natural-language agent (`/agent`) is inert in production — the Anthropic account has $0 credits and no payment method, so every `claude-haiku-4-5` call returns a billing 400 and degrades to "didn't catch that." The full pipeline (schema, resolver, route, CommandBar, voice capture) is built and verified at the code + deterministic-test level; only the paid API call is unfunded. Live 35-fixture eval against production on 2026-08-05 → **4/35** (all valid commands → `unclear`, only gibberish "passes"). Fix is billing-only, no code change. See `phases/03-agent-via-text-input/03-HUMAN-UAT.md`.

**Known deferred items at close:** 5 open artifacts acknowledged (1 diagnosed debug session, 2 partial UAT phases, 2 verification gaps — see STATE.md → Deferred Items). The Phase 02 verification "gaps" were remaining-phase-scope (dashboard UI), since built and verified live; the Phase 03 items are the agent live-eval above.

---
