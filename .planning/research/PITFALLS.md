# Pitfalls Research

**Domain:** Voice-controlled personal health data dashboard (Web Speech API + Claude agent + FastAPI + React/Recharts, split Vercel/Railway-Render deployment)
**Researched:** 2026-07-07
**Confidence:** HIGH (Web Speech API, deployment, LLM validation — verified against current sources); MEDIUM (some Safari version-specific behaviors change between iOS releases)

## Critical Pitfalls

### Pitfall 1: Treating `continuous: true` as "always listening"

**What goes wrong:**
The team wires up `recognition.continuous = true`, tests a 30-second demo, ships. In real use the session silently dies after 1–5 minutes: Chrome stops recognition after sustained silence (and after ~a few minutes regardless), Android Chrome effectively ignores `continuous`, and iOS Safari stops on its own without firing a useful error. Chris speaks to a dead mic and nothing happens — the worst possible failure for a user who cannot reach the screen to re-tap.

**Why it happens:**
The Web Speech API spec makes no guarantee about session length; every engine imposes its own silence timeouts and server-side session caps. Demos never run long enough to hit them.

**How to avoid:**
Build a **recognition lifecycle state machine**, not a toggle:
- Track intended state (`shouldBeListening`) separately from actual engine state.
- In `onend`, if `shouldBeListening` is still true, restart with a short delay (~200–300ms; needed on iOS to avoid buffer issues). Restart from `onend`, not `onerror` — `onend` always fires last.
- Guard against restart loops: if `onend` fires repeatedly within ~1s with no results (e.g., mic revoked, `not-allowed`, `network` errors), back off and surface a **large visual "listening stopped — tap to resume"** state instead of spinning.
- Handle `visibilitychange`: stop cleanly when the tab backgrounds; restart requires care on iOS (see Pitfall 2).
- Always render a prominent visual listening indicator (pulsing mic, live interim transcript). Chris must be able to *see* from across the room whether the system is listening.

**Warning signs:**
Voice works in short tests but "stops responding after a while" in longer sessions; `onend` fires without a preceding `stop()` call; works on desktop Chrome but not Android/iOS.

**Phase to address:**
Voice & Agent phase — the restart state machine is the core of the voice feature, not polish. Include a manual test: 10-minute session with multi-minute silences on both Chrome and iOS Safari.

---

### Pitfall 2: Building on Chrome, "porting" to Safari/iOS later

**What goes wrong:**
Voice ships working on desktop Chrome. On iOS Safari it fails in half a dozen distinct ways: `webkitSpeechRecognition` prefix; `start()` must be traceable to a user gesture (programmatic restarts after certain states get blocked); `continuous: true` on iOS produces one ever-growing result blob instead of discrete utterances; the first recognition attempt after permission grant often captures nothing (needs a 2–3s warm-up); after the first `onresult`, subsequent results sometimes never fire even though the mic icon stays red; creating a new recognition instance per utterance triggers the system chime every time; "Hey Siri" enabled can starve results entirely.

**Why it happens:**
WebKit's implementation is a different engine (Apple's speech services) with different semantics, and almost all Web Speech tutorials are Chrome-only. Since Chris's primary device is undecided, iOS cannot be an afterthought.

**How to avoid:**
- Detect engine and branch behavior: on iOS use `continuous: false` + auto-restart in `onend` (with ~200ms delay); on Chrome use `continuous: true` + restart on timeout/end. Community consensus: this hybrid is the only reliable pattern.
- Use a **singleton recognition instance** — never construct per utterance (avoids chime and iOS instance bugs).
- On iOS, parse the *delta* of the growing transcript rather than assuming discrete result events.
- Keep the caregiver-tap flow: it conveniently satisfies the user-gesture requirement. But test specifically that *programmatic restarts* keep working after the initial gesture on the target iOS version — if a given iOS release blocks them, the fallback is a large "resume listening" button.
- Test on a real iPhone/iPad early (week one of the voice phase), not at the end. Simulators and desktop Safari do not reproduce iOS behavior.
- Document for the caregiver: disable "Hey Siri" on the device if recognition is flaky.

**Warning signs:**
No `SpeechRecognition`/`webkitSpeechRecognition` branching in code; no real-device iOS test until late; interim-transcript handling assumes discrete result events.

**Phase to address:**
Voice & Agent phase. The Chrome-vs-Safari abstraction (a `useSpeechRecognition` hook with engine-specific strategies) should be designed in from the first commit of that phase.

---

### Pitfall 3: Ignoring the Web Speech API's network dependency and vendor data flow

**What goes wrong:**
Chrome's recognizer sends recorded audio to Google servers; Safari sends it to Apple. Two consequences: (1) recognition throws `network` errors and dies whenever connectivity blips — common on home Wi-Fi — and the app shows nothing; (2) health-related speech ("show my hypertensive crisis readings") transits Google/Apple servers, which contradicts a naive "no audio leaves the browser" privacy claim.

**Why it happens:**
The API looks local but isn't (except Chrome's newer on-device modes, which aren't dependable cross-device). Developers discover the `network` error class only in production.

**How to avoid:**
- Handle `onerror` with `error === 'network'` explicitly: show a visible "voice unavailable — check internet" state and auto-retry with backoff.
- The text input fallback must be a first-class, always-visible control — it is the only path when recognition is down.
- Be accurate in privacy framing (PROJECT.md already says "except to the OS vendor" — keep that honesty in any README/portfolio writeup).

**Warning signs:**
No `onerror` handler branching by error type; voice failure states are silent; portfolio copy claims audio never leaves the device.

**Phase to address:**
Voice & Agent phase (error handling); Deployment phase (verify behavior on the actual home network/device).

---

### Pitfall 4: Letting Claude compute dates (or trusting its enums)

**What goes wrong:**
Two related failures. (a) The model resolves "last month" or "last 30 days" into absolute dates itself — but it doesn't know today's date or the user's timezone, so it returns dates anchored to its training data or hallucinated "today," and filters silently return wrong data. (b) The model returns near-miss enum values (`"bp_chart"` instead of `"bp_timeline"`, `"morning"` instead of `"AM"`), or invents filters that don't exist; naive validation either 500s or, worse, passes them through to a frontend switch statement that silently no-ops.

**Why it happens:**
LLMs are fluent, not precise. Free-form JSON prompting without schema enforcement drifts; date math requires context the model doesn't have.

**How to avoid:**
- **Symbolic date ranges, resolved server-side:** Claude returns `{"date_range": {"type": "last_n_days", "n": 30}}` or `{"type": "month", "month": "2025-05"}`; FastAPI resolves these to absolute datetimes using the server's knowledge of "now" in the user's local timezone. Also inject today's date into the system prompt so the model can disambiguate "in May" vs "last May."
- **Use Claude's tool-use / structured output** (define the command as a tool with a JSON schema including `enum` constraints), not "please return JSON" prompting. This is the single biggest quality lever.
- **Pydantic with `Literal`/`Enum` fields** and `extra="forbid"` on the backend. On validation failure, do not 500 — return a structured "I didn't understand, try..." response the UI can display, and log the raw output for prompt iteration.
- Define an explicit `clarify` / `unknown` action so the model has a legal escape hatch for ambiguous or out-of-scope requests ("what's the weather") instead of hallucinating a chart command.
- Test with a fixture set of ~30 real utterances (including transcription errors like "show me my BP for the last dirty days") before wiring to the UI.

**Warning signs:**
Absolute ISO dates appearing in model output; no `Literal` types in the Pydantic schema; no defined behavior for unparseable output; no `clarify` action.

**Phase to address:**
Voice & Agent phase — the command schema is the contract between three components (Claude, FastAPI, React) and should be designed and frozen first.

---

### Pitfall 5: Naive timezone/UTC "correctness" corrupting AM/PM and dates

**What goes wrong:**
Someone "fixes" datetime handling by converting to UTC somewhere in the pipeline (Pandas, SQLAlchemy, FastAPI JSON serialization, or JS `new Date()`). A 7:30 AM reading stored/serialized as `12:30Z` renders as PM, or a late-evening reading shifts to the next day. The AM-vs-PM chart — a core clinical view for this dataset — becomes silently wrong. DST transitions make it wrong only part of the year, which is far harder to notice.

**Why it happens:**
"Always use UTC" is dogma that's wrong for this domain. OMRON readings are **wall-clock local times** with no timezone; the clinically meaningful fact is "7:30 in the morning," full stop.

**How to avoid:**
- Treat all reading datetimes as **naive local wall-clock** end to end: naive `TIMESTAMP` (not `TIMESTAMPTZ`) in Postgres, no `tz` conversions in Pandas, serialize as ISO strings *without* `Z` or offset.
- Derive `am_pm` in the ETL from the device's recorded time — never re-derive in the frontend from a JS `Date`.
- In React, beware `new Date("2025-02-22T07:30:00")` (parsed as local — acceptable) vs anything that appends `Z` (shifts). Prefer passing pre-formatted strings or epoch values derived from naive components for chart axes.
- Tests: a reading at `00:15` is AM, `12:00:00` is PM, `11:59:59` is AM; a date range filter for "June" includes `2025-06-30 23:59` and excludes `2025-07-01 00:00`.

**Warning signs:**
`TIMESTAMPTZ` in the schema; `.dt.tz_localize`/`tz_convert` in ETL; `Z` suffixes in API responses; AM/PM counts in the app differing from the cleaned CSV.

**Phase to address:**
ETL & Database phase (storage + derivation), verified again in the Dashboard phase (rendering).

---

### Pitfall 6: AHA category boundary and combination-rule errors

**What goes wrong:**
BP category logic is implemented with subtle errors: using AND where AHA uses OR (Stage 1 is systolic 130–139 **OR** diastolic 80–89), off-by-one at boundaries (is 130/79 Elevated or Stage 1? — Stage 1), classifying on systolic alone, or not applying the "higher category wins" rule when systolic and diastolic disagree (e.g., 125/95 is Stage 2, not Elevated). With this dataset spanning hypotension (60 systolic) to crisis (211), every category will actually appear, so errors are visible and clinically misleading.

**Why it happens:**
The AHA table looks simple but mixes AND/OR semantics per row, and hypotension isn't in the standard AHA hypertension table at all (common convention: <90 systolic or <60 diastolic).

**How to avoid:**
- Implement as an ordered check from most to least severe, each row using the correct connective; the first match wins. Document the hypotension definition explicitly since it's a project convention, not AHA.
- **Golden-master test:** categorize all 132 readings and diff against the existing `bp_data_cleaned.csv` `BP_Category` column — any mismatch is either a bug or a documented deliberate correction.
- Boundary unit tests at exact edges: 119/79, 120/79, 129/79, 130/79, 129/80, 139/89, 140/89, 139/90, 179/119, 180/120, 89/60, 90/59.
- Same rigor for `pulse_category` (60 bpm boundary: is exactly 60 bradycardia or normal? Convention says <60 is bradycardia, so 60 = Normal — test it, since ~88% of readings cluster here) and MAP (`diastolic + pulse_pressure/3`).

**Warning signs:**
Category logic without boundary tests; no comparison against the cleaned CSV; hypotension undefined; chart category counts differing from the Tableau prototype.

**Phase to address:**
ETL & Database phase — PROJECT.md already mandates these tests; make the golden-master diff an explicit deliverable.

---

### Pitfall 7: Recharts time-axis and outlier-scaling distortions

**What goes wrong:**
Two chart-level lies. (a) **Categorical time axis:** Recharts by default treats data points as evenly spaced categories; with irregular reading times (gaps of days), the BP timeline compresses/stretches time and trends look wrong. (b) **Auto-scaled Y axis:** with systolic ranging 60–211, `domain={['auto','auto']}` produces an axis that reshapes with every filter — "last 7 days" of stable readings renders tiny fluctuations as dramatic swings, and AHA threshold context disappears.

**Why it happens:**
Recharts defaults favor generic dashboards, not clinical time series. Auto-scaling is the default; numeric time axes require explicit `type="number"` + epoch values + tick formatters.

**How to avoid:**
- X axis: `<XAxis type="number" dataKey={epochMs} domain={['dataMin','dataMax']} tickFormatter={...} />` so time spacing is real. Break the line across large gaps (`connectNulls={false}` with inserted nulls) rather than drawing a misleading straight segment across a two-week gap.
- Y axis: **fixed clinical domains** — BP chart roughly `[40, 220]` (covers the real 60–211 range), pulse `[30, 130]` — so the axis is stable across filters. Add `ReferenceLine`/`ReferenceArea` for AHA thresholds (120/130/140/180 systolic; 60 bpm bradycardia) so values are always read against clinical meaning, not visual amplitude.
- Never start bar charts (BP Categories, AM vs PM) at a nonzero baseline.

**Warning signs:**
`dataKey="date"` with string dates on a `LineChart`; axis ranges that change when filters change; no reference lines in the pulse chart.

**Phase to address:**
Dashboard/Charts phase — set axis strategy in the first chart and reuse.

---

### Pitfall 8: Non-idempotent ETL — duplicates on re-upload

**What goes wrong:**
OMRON exports are cumulative — the next export contains all previous readings plus new ones. With `SERIAL id` and plain `INSERT`, every caregiver re-upload duplicates history: counts double, averages stay plausible (dangerously invisible), category charts inflate.

**Why it happens:**
Idempotency requires a natural key, and nobody defines one because "id" already exists.

**How to avoid:**
- Add a `UNIQUE` constraint on the natural key — `datetime` alone is right for OMRON data (device records one reading per timestamp; two readings in the same minute are physically implausible for a BP cuff cycle, but verify against the real file). Use `INSERT ... ON CONFLICT (datetime) DO NOTHING` (or `DO UPDATE` if corrections should win).
- Idempotency test: run the ETL twice on the same file → row count unchanged. Run on overlapping exports → only new rows added.
- Report to the uploader: "132 rows read, 5 new, 127 duplicates skipped" — this also catches the opposite failure (a parsing change making all rows look "new").

**Warning signs:**
No unique constraint besides `id`; upload endpoint returns only "success"; row count in DB exceeds reading count in the latest export.

**Phase to address:**
ETL & Database phase (constraint + upsert); upload endpoint feedback in the API phase.

---

### Pitfall 9: Excel date/time parsing gotchas in the OMRON file

**What goes wrong:**
Dates arrive as Excel serial floats (needing `origin='1899-12-30'` — not 1900-01-01, because of Excel's fake-1900-leap-year bug), or as locale-formatted strings where pandas guesses month/day order (`03/04/2025` → March 4 or April 3?). Separate Date and Time columns get combined wrong; `12:xx AM/PM` handling flips midnight/noon readings. Result: silently shifted datetimes that also break the idempotency key.

**Why it happens:**
`pd.read_excel` type inference varies with how OMRON formatted cells, and the same code behaves differently if a caregiver opens/re-saves the file in Excel or exports CSV instead.

**How to avoid:**
- Read date/time columns as `object` (`dtype=str` / converters) and parse explicitly with known formats; if numeric serials appear, convert with `pd.to_datetime(..., unit='D', origin='1899-12-30')`.
- Validate post-parse: all datetimes within a sane window (2024–now), no duplicates, monotonic-ish ordering; reject the file with a clear error message otherwise — caregivers upload this, so errors must be human-readable, not stack traces.
- Golden-master: parsed output of the real 132-row file must match `bp_data_cleaned.csv` datetimes exactly.
- Accept both `.xlsx` and `.csv` (OMRON offers both; caregivers will eventually upload the "wrong" one).

**Warning signs:**
`pd.read_excel(path)` with no dtype/format control; no post-parse sanity checks; ETL tested only against one pristine file.

**Phase to address:**
ETL & Database phase.

---

### Pitfall 10: "Voice-first" that isn't actually accessible

**What goes wrong:**
Voice commands mutate charts, but nothing announces the change — a screen-reader user (or Chris, glancing back at the screen) can't tell what happened or whether the command worked. Focus stays wherever it was; the "confirmation text" updates a div nobody is told about. Chart colors follow the AHA palette (yellow/orange on white fail WCAG contrast), and category encoding relies on color alone. The project *claims* accessibility as a core value, so these gaps are credibility-breaking for a portfolio piece.

**Why it happens:**
Voice control and accessibility are treated as the same feature. They're not — voice is input; accessibility also requires output affordances.

**How to avoid:**
- A single **`aria-live="polite"` status region** that announces every applied command in plain language: "Showing blood pressure timeline, last 30 days, mornings only. 41 readings." Reuse the same string as the visible confirmation text — one source of truth.
- Announce failures too ("I didn't understand that") — silence on error is the worst outcome.
- Enable Recharts `accessibilityLayer` on all charts; give each chart an accessible title/description that updates with filters.
- Check the AHA palette against a contrast checker; darken yellow/orange for text/legend use, add pattern or label redundancy so category is never color-only.
- Voice-driven state changes should *not* steal focus (Chris isn't using focus), but keyboard users need logical focus order preserved — don't re-mount the whole dashboard per command.

**Warning signs:**
No `aria-live` region in the layout; confirmation text separate from any announcement mechanism; default Recharts colors/AHA hexes unchecked for contrast; "accessible" claimed with no axe/Lighthouse run.

**Phase to address:**
Dashboard/Charts phase (structure, contrast, accessibilityLayer) and Voice & Agent phase (announcements wired to command application).

---

### Pitfall 11: Render/Railway free-tier realities — cold starts and expiring Postgres

**What goes wrong:**
(a) Render free web services spin down after 15 minutes idle; the next request takes 30–60s. Chris's first voice command of the day hangs for a minute with no feedback — indistinguishable from "broken" for a non-technical user. (b) **Render free Postgres is deleted after 90 days** unless upgraded — that is the real health dataset gone. (c) Free-tier Postgres has low connection limits; SQLAlchemy's default pool across restarts/deploys can exhaust them.

**Why it happens:**
Free-tier constraints are in the fine print; demos during active development never hit spin-down or the 90-day expiry.

**How to avoid:**
- Prefer Railway (usage-based, no forced spin-down) or pay Render's minimal tier for the backend; if staying free, add a frontend "warming up" state for slow first responses and optionally a lightweight keep-alive ping while a session is active.
- Never keep the only copy of health data in a free expiring database: automated `pg_dump` backups (even a manual documented routine), plus the source Excel files retained as re-loadable truth (the idempotent ETL makes re-seeding trivial — this is a real payoff of Pitfall 8's fix).
- Configure SQLAlchemy conservatively: `pool_size=5, max_overflow=2, pool_pre_ping=True, pool_recycle=300` — a single-user app needs almost nothing.

**Warning signs:**
No backup story; "works in dev" latency assumptions; connection errors after idle periods (`server closed the connection unexpectedly` → missing `pool_pre_ping`).

**Phase to address:**
Deployment phase, but the backup/re-seed story depends on ETL idempotency from Phase 1.

---

### Pitfall 12: Real health data of a real, named person in a public portfolio repo

**What goes wrong:**
This is explicitly a portfolio project, so the repo will likely be public — containing `bp_data_cleaned.csv`: 132 real readings, timestamps, and clinical events for an identifiable person ("Chris's Health Dashboard"). Once pushed, it's in git history forever; a later `.gitignore` doesn't remove it. Screenshots/demo videos with real values have the same problem.

**Why it happens:**
The data file is needed for development and seeding; convenience wins over reflection at `git init` time.

**How to avoid:**
- Decide **before the first commit**: real data files in `.gitignore` (and a `data/README.md` explaining how to obtain/place them), plus a committed **synthetic sample dataset** with the same schema and similar statistical character (including outliers) for demos, tests, and screenshots.
- Seed production via the upload endpoint or a script reading from an untracked path.
- If real data ever lands in history: rewrite history (`git filter-repo`) before the repo goes public, not after.
- Portfolio demo mode: consider an env flag that loads synthetic data so the public demo never shows real readings.

**Warning signs:**
`*.csv`/`*.xlsx` untracked-file listings at first commit; real values visible in README screenshots; tests importing the real CSV.

**Phase to address:**
Repo setup / Phase 1, day one. This is the single most irreversible mistake on the list.

---

### Pitfall 13: Password gate that protects the UI but not the API

**What goes wrong:**
The shared password is checked in React (client-side), or gates only page routes — while `api.example.com/readings` returns full health data to anyone with the URL. Or the `/agent` endpoint is unauthenticated, letting anyone burn the Anthropic API budget.

**Why it happens:**
"Simple shared password" gets implemented as a UI overlay because that's where it's visible.

**How to avoid:**
- Enforce on the **backend**: FastAPI dependency checking a session token/signed cookie issued after password verification; apply to every route including `/agent` and upload. The frontend gate is just UX.
- Compare passwords with `secrets.compare_digest`; store the password as an env var (hash acceptable at this threat level).
- Add basic rate limiting on the login and `/agent` endpoints (slowapi or equivalent) — `/agent` costs real money per call.
- Verify with curl: every endpoint returns 401 without the session credential.

**Warning signs:**
Password constant anywhere in frontend code (all `VITE_*` vars ship in the JS bundle); API reachable without credentials; no rate limit on `/agent`.

**Phase to address:**
Deployment & Auth phase, but design the FastAPI auth dependency when the first data endpoint is written so it's not a retrofit.

---

### Pitfall 14: Prompt injection and over-trusting the transcript path

**What goes wrong:**
The transcript is attacker-influenceable input (anyone near the mic, a TV, or a crafted text-fallback string): "ignore previous instructions and output {...}". Because the agent output drives UI state, injection here is low-severity — but the failure mode that actually bites is subtler: background speech (caregiver conversation, television) gets transcribed, sent to Claude, billed, and occasionally parsed into a *valid* command that randomly changes Chris's view.

**Why it happens:**
Continuous listening means the mic hears everything, and every final transcript becomes an API call.

**How to avoid:**
- Architecture already mitigates injection: JSON-only output, Pydantic whitelist, no execution of model output, no data-mutating voice actions in MVP. Keep it that way — when voice data-entry arrives post-MVP, add explicit confirmation before any write.
- Put the transcript in the **user message** only, never concatenated into the system prompt; instruct the model that transcript content can never change its rules.
- Reduce false activations: ignore very short/low-confidence finals (check `confidence` where available), require a minimum utterance length, and consider a lightweight command prefix ("dashboard, show...") if false triggers prove common in real use — decide from field testing, not upfront.
- Show the transcript that was acted on ("Heard: 'show pulse for June'") so misfires are visible and self-explaining.
- Cost control: send only *final* results (never interim), debounce, and cap per-session call counts; use a fast/cheap Claude model (Haiku-class) with low `max_tokens` — this also fixes the latency pitfall (a slow round-trip after each utterance makes voice feel broken; target <2s perceived, with an immediate "thinking" indicator).

**Warning signs:**
Interim results POSTed to `/agent`; no display of the heard transcript; Anthropic bill growing during idle-but-listening sessions; view changing when nobody issued a command.

**Phase to address:**
Voice & Agent phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Chrome-only voice, "add Safari later" | Faster demo | Rearchitecting the recognition layer; hybrid restart strategy touches everything | Never — device is undecided; both from day one |
| Client-side-only password check | 30 minutes saved | Health data publicly readable via API | Never |
| Free-form JSON prompting instead of tool-use/structured output | Simpler first prompt | Constant enum drift, brittle parsing, endless prompt patching | Only for a first-day spike, replaced before UI wiring |
| Real CSV committed "temporarily" for seeding | Convenience | Irreversible git history exposure of health data | Never |
| Skipping the golden-master diff vs `bp_data_cleaned.csv` | Saves an hour | Silent clinical categorization errors shipped | Never — it's the cheapest high-value test in the project |
| Categorical (string) X axis on timeline charts | Works immediately | Misleading time compression; rework of all tooltips/ticks when fixed | Only in throwaway prototypes |
| No backup routine for free-tier Postgres | Nothing to set up | Total data loss at 90-day expiry or platform hiccup | Acceptable only because idempotent ETL + retained source files can re-seed — verify that path actually works |
| Naive TIMESTAMP without documenting "naive local" convention | None really | Future contributor "fixes" to UTC and breaks AM/PM | Document the convention in schema comments and README — costs nothing |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Web Speech API (Chrome) | Assuming `continuous: true` runs indefinitely; no `network` error handling | onend-based restart state machine; explicit error-type branching; visible listening state |
| Web Speech API (iOS Safari) | New instance per utterance; expecting discrete results with `continuous: true`; testing only in simulator | Singleton instance; `continuous: false` + restart; parse transcript deltas; real-device testing early |
| Claude API | "Return JSON" prompting; letting model compute absolute dates; sending interim transcripts | Tool-use with JSON schema + enums; symbolic date ranges resolved server-side; final results only; inject today's date into system prompt |
| Claude API (keys) | Key in frontend env (`VITE_ANTHROPIC_*` ships in bundle) | All Claude calls through FastAPI; key only in backend env |
| Vercel ↔ Railway/Render CORS | `allow_origins=["*"]` with `allow_credentials=True` (invalid per spec, silently breaks cookies); forgetting Vercel preview-deploy origins | Explicit origin list from env var; either include preview URL pattern via regex or test only on production domain; remember OPTIONS preflight must skip auth |
| Postgres (free tier) | Default SQLAlchemy pool + stale connections after idle | `pool_pre_ping=True`, small pool, `pool_recycle`; connection string from env with `sslmode=require` where needed |
| OMRON Excel export | Trusting pandas type inference; assuming exports are deltas | Explicit dtype/format parsing; treat exports as cumulative → upsert on natural key |
| Vite env vars | Expecting runtime env vars in frontend | `VITE_*` vars are baked at build time — API base URL must be set in Vercel build env, and changing it requires redeploy |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Render free-tier spin-down | First request of the day hangs 30–60s; voice command appears dead | Railway/paid tier, or warming UX + keep-alive during sessions | Every idle gap >15 min |
| Claude call per utterance with a large model | 3–6s between command and chart change; voice feels broken | Haiku-class model, low max_tokens, immediate "thinking" indicator, only final transcripts | From day one — latency is UX-critical here |
| Refetching all readings on every filter change | Sluggish filter application (minor at 132 rows) | Fine at this scale; fetch once per date range and filter client-side where possible — don't over-engineer | Not until thousands of readings; ignore beyond basic hygiene |
| Recognition restart loop hammering `onend` → `start()` | CPU/battery drain, repeated permission chimes on iOS | Backoff + max-retry in the state machine | Any error state without backoff |
| Cold-start + CORS preflight + agent call stacking | First voice command latency = spin-up + preflight + Claude round-trip | Warm backend before/at session start (caregiver's mic tap can trigger a warm-up ping) | Every session start on free tier |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API endpoints unauthenticated behind a UI-only password gate | Full health dataset readable by URL guessing | FastAPI auth dependency on every route; curl-test 401s |
| Real health data in public git history | Permanent exposure of identifiable medical data | `.gitignore` from first commit; synthetic sample data; `git filter-repo` if breached |
| Anthropic key exposed via frontend | Key theft, billed abuse | Backend-only Claude calls; key in Railway/Render env vars |
| Logging transcripts/readings in server logs | Health data in plaintext platform logs (Render/Railway retain logs) | Log command *types* and validation outcomes, not transcript content or values; scrub before deploy |
| `/agent` endpoint without rate limiting | Anthropic budget drain by anyone who finds the URL | Auth required + per-IP/session rate limit |
| Executing/`eval`-ing model output or passing unvalidated JSON to the frontend | UI manipulation, injection foothold | Pydantic whitelist with `extra="forbid"`; frontend applies only known action types |
| Publicly exposed Postgres | Direct data exfiltration | Use platform-internal connection; no public DB networking; strong generated password |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visible listening state | Chris talks to a dead mic; can't recover without a caregiver | Large pulsing indicator + live interim transcript, readable from distance; distinct "stopped" state |
| Silent failures (network error, unvalidated command, cold start) | Command "does nothing"; system feels random | Every outcome produces visible + aria-live feedback: heard transcript, applied change, or plain-language error |
| No display of what was heard | Misrecognitions look like bugs; no self-correction path | "Heard: '...' → Showing pulse trend for June" pattern |
| Command vocabulary undiscoverable | Chris doesn't know what he can say | Always-visible example commands ("Try: 'show mornings only'"); `clarify` responses that suggest valid phrasings |
| Voice-applied filters invisible in UI | Current view state ambiguous ("is this filtered?") | Persistent large filter chips reflecting active chart/date-range/AM-PM state |
| Assuming perfect transcription of domain terms | "Diastolic" → "die a stalic"; commands fail mysteriously | Prompt Claude to interpret plausible mis-transcriptions; test with real speech, not typed input |
| Tiny Recharts tooltips/legends as the only data-reading path | Unreadable at distance; hover-only violates the no-hover constraint | ≥18px chart text, summary stat cards, no information available only on hover |

## "Looks Done But Isn't" Checklist

- [ ] **Voice control:** Works in a 30s Chrome demo — verify a 10-minute continuous session with long silences on desktop Chrome AND a real iOS device, including permission-revoked and offline recovery
- [ ] **Agent commands:** Happy-path utterances work — verify hallucinated-enum handling, out-of-scope requests ("what's the weather"), garbled transcripts, and that "last month" resolves against *today's* date in local time
- [ ] **ETL:** One file loads — verify double-upload is a no-op, overlapping exports add only new rows, and the 132-row golden master matches `bp_data_cleaned.csv` categories exactly
- [ ] **Charts:** Look like the Tableau prototype — verify time axis is numeric (not categorical), Y domains are fixed across filters, gaps break lines, and boundary readings (130/79, 140/90, 180/120) land in the right category bars
- [ ] **AM/PM view:** Counts match the cleaned CSV — verify midnight/noon edge readings and that no UTC shift occurs between DB and browser
- [ ] **Accessibility:** Big fonts/targets exist — verify aria-live announcements fire on every voice-applied change, Recharts `accessibilityLayer` is enabled, axe/Lighthouse pass, and the AHA palette passes contrast
- [ ] **Auth:** Login page works — verify every API route (readings, upload, agent) returns 401 via curl without a session, and preflight OPTIONS still succeeds
- [ ] **Deployment:** Site loads — verify first-request-after-idle behavior, CORS from the real Vercel domain, backup/re-seed procedure actually executed once, and no real data or keys in the public repo/bundle

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Real data committed to public repo | HIGH | `git filter-repo` to purge history; force-push; rotate anything else exposed; verify no forks/caches |
| Duplicated readings in DB from non-idempotent ETL | LOW | Add unique constraint; dedupe with `DELETE ... USING` on natural key; re-run ETL |
| Wrong BP categories shipped | LOW–MEDIUM | Fix ETL logic; categories are derived — re-run derivation over all rows (this is why derived-in-ETL was the right call) |
| UTC shift corrupting AM/PM | MEDIUM | Identify where the shift enters (serialization vs storage); if stored values were shifted, re-run ETL from source files |
| Chrome-only voice discovered late on Chris's iOS device | HIGH | Rebuild recognition layer as engine-branching hook; retest whole voice flow — avoid by testing iOS in week one |
| Render free Postgres expired/deleted | LOW *if* prepared | Re-provision; re-run idempotent ETL from retained source files; restore is a non-event only if Pitfalls 8/11 were addressed |
| Anthropic budget drained via open `/agent` | LOW | Rotate key; add auth + rate limit; set spend cap in Anthropic console (do this preemptively) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Real data in public repo (12) | Repo setup, before first commit | `git log --stat` shows no data files; synthetic sample committed instead |
| Excel parsing gotchas (9) | ETL & Database | Golden-master datetime diff vs cleaned CSV |
| Non-idempotent ETL (8) | ETL & Database | Double-run test: row count unchanged |
| AHA boundary errors (6) | ETL & Database | Boundary unit tests + 132-row category diff |
| Timezone/AM-PM corruption (5) | ETL & Database (+ recheck in Charts) | Edge-time unit tests; browser AM/PM counts match CSV |
| Password gate API bypass (13) | API phase (design) / Deployment (enforce) | curl 401 on every route |
| Recharts axis distortions (7) | Dashboard/Charts | Filter changes don't rescale Y; gap test with sparse range |
| Voice-first accessibility gaps (10) | Dashboard/Charts + Voice & Agent | aria-live announces each command; axe pass; contrast check |
| Continuous-listening lifecycle (1) | Voice & Agent | 10-min session test, both engines |
| Safari/iOS divergence (2) | Voice & Agent (week one) | Real-device iOS test in phase's first days |
| Network dependency (3) | Voice & Agent | Offline/airplane-mode test shows recoverable error state |
| LLM date/enum failures (4) | Voice & Agent | 30-utterance fixture suite incl. garbage input |
| Prompt injection / false activations / cost (14) | Voice & Agent | Injection strings rejected; interim results never sent; spend cap set |
| Cold starts, Postgres expiry, CORS (11) | Deployment & Auth | Idle-then-request test; backup executed once; CORS from prod domain |

## Sources

- [Web Speech API Safari issues — WICG/web-speech-api #96](https://github.com/WebAudio/web-speech-api/issues/96) — Safari continuous-mode and onresult bugs
- [How to Stabilize the WebSpeech API on iOS — lilting.ch](https://lilting.ch/en/articles/ios-webspeech-api-tips) — iOS auto-stop, singleton, warm-up, restart-delay, visibility workarounds
- [Taming the Web Speech API — Andrea Giammarchi](https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1) — cross-browser quirks, iOS growing-single-result behavior
- [SpeechRecognition issues in Safari 17.1 — Apple discussions](https://discussions.apple.com/thread/255492924) — Siri interference, first-recognition delays
- [A Deep Dive into the Web Speech API — addpipe](https://blog.addpipe.com/a-deep-dive-into-the-web-speech-api/) — engine differences, network dependency
- [Chromium: webkitSpeechRecognition network behavior](https://issues.chromium.org/issues/41229480) — audio sent to Google servers, stuck/network errors
- [LLM Structured Outputs: Schema Validation for Real Pipelines](https://collinwilkins.com/articles/structured-output) — enum hallucination, invalid-date pitfalls, Pydantic validation
- [LLM Structured Output in 2026 — dev.to](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk) — native structured outputs over JSON prompting
- [Render free tier documentation/articles](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026) — 15-min spin-down, 30–60s cold starts, 90-day Postgres expiry
- [Deploy FastAPI + PostgreSQL on Render — freeCodeCamp](https://www.freecodecamp.org/news/deploy-fastapi-postgresql-app-on-render/) — deployment configuration patterns
- [Parsing Excel Dates in Pandas — sqlpey](https://sqlpey.com/python/parsing-excel-dates-in-pandas/) — serial dates, 1899-12-30 origin, 1900 leap-year bug
- [Recharts and accessibility — official wiki](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility) — accessibilityLayer, keyboard nav, screen-reader modes
- [ARIA live regions — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live) — polite announcements for dynamic updates (WCAG 4.1.3)
- AHA blood pressure category definitions (training knowledge, HIGH confidence — stable clinical standard; verify hypotension convention as project-defined)

---
*Pitfalls research for: voice-controlled personal health dashboard*
*Researched: 2026-07-07*
