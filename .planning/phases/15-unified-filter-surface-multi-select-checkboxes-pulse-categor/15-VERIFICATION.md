---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
verified: 2026-09-17T14:00:00Z
status: human_needed
score: 25/25 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Tab through FilterBar's Time of Day, BP Category, and Pulse Category checkbox groups in both light and dark theme; confirm a visible focus ring on each checkbox/label and that colored-chip fills (BP/Pulse Category) meet contrast against their checked-state ring and unchecked background."
    expected: "Every checkbox is keyboard-reachable via Tab, toggleable via Space, shows a visible focus indicator, and chip text/tick remain legible against all 6 BP + 3 pulse background colors in both themes."
    why_human: "No automated Recharts/chip accessibility test exists in this suite (per 15-VALIDATION.md's own Manual-Only Verifications table); visual contrast and focus-ring rendering cannot be graded by grep or unit test."
  - test: "Once the Anthropic account has a positive balance (AGENT-01, currently $0), re-run the 43-fixture live eval (`pytest -m live`) and manually speak 2-3 utterances exercising the new pulse_category/time_of_day tokens (e.g. 'show tachycardia readings', 'mornings and evenings')."
    expected: "The live model correctly maps these utterances to bp_category_all/pulse_category/time_of_day fields per the updated SYSTEM_PROMPT vocabulary, and the fixed 9-site agent_utterances.json conversion (amPm→timeOfDay, scalar bpCategory→list) produces matching live results."
    why_human: "Agent is inert in production (pre-existing, project-wide AGENT-01 blocker, not introduced by this phase) — no live model call is possible in this environment. This is the same accepted limitation carried since Phase 3's verification."
---

# Phase 15: Unified Filter Surface — Verification Report

**Phase Goal:** Chris can combine filters instead of picking one — "Stage 1 and Stage 2", "mornings and evenings" — through the same checkbox control model the Show panel already uses, plus two filters whose data already exists but has never been reachable.

**Verified:** 2026-09-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase's headline capability — combining two BP categories, or two time-of-day buckets, in one query — is real and tested, not a stub. `FilterBar.tsx` renders real `<input type="checkbox">` elements (not `aria-pressed` buttons) for Time of Day, BP Category, and Pulse Category; `store/filters.ts` holds each group as a `Record<K, boolean>` map with independent `toggle*`/`set*` actions; `backend/app/deps.py`'s `ReadingFilters` converts `bp_category` to a real SQL `IN`-clause, adds a mirrored `pulse_category` filter, and adds a new query-time-only `time_of_day` filter with correct midnight-wrap handling. All three layers (backend query, agent wire schema, frontend store/UI) are consistently wired end to end.

**Scope note (documented deviation, not a gap):** ROADMAP.md's scope bullet reads "FilterBar AM/PM + BP category → multi-select checkboxes" (implying AM/PM becomes a checkbox group alongside a new Time of Day group — UI-SPEC §10's "Option A"). The actual shipped implementation instead **replaces** AM/PM with the new four-bucket Time of Day filter (UI-SPEC §10's "Option B", which the UI-SPEC's own author explicitly recommended). This was a documented planner decision (PD-01 in 15-02-PLAN.md, PD-02 in 15-01-PLAN.md) resolved and approved before execution (15-VALIDATION.md, "no amPm migration needed — dropped per resolved Open Question 1", approved 2026-09-16). ROADMAP.md's `success_criteria` array is empty for this phase (confirmed via `gsd-sdk query roadmap.get-phase 15`), so there is no machine-readable contract this contradicts, and the phase goal's own substance — combining "mornings and evenings" — is fully satisfied via the Time of Day group. Flagged for visibility, not scored as a failure.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Caregiver can filter `/readings` by 2+ BP categories at once (OR) | ✓ VERIFIED | `backend/app/deps.py:188-189` `.in_()`; `test_bp_category_or_within_group` passes |
| 2 | Caregiver can filter by pulse category (previously unreachable) | ✓ VERIFIED | `deps.py:190-191`; `test_pulse_category_filter` (3 cases) passes; `FilterBar.tsx` Pulse Category group |
| 3 | Caregiver can filter by time of day incl. midnight-wrapping Night bucket, zero ETL/schema change | ✓ VERIFIED | `classify_time_of_day`/`_time_of_day_predicate` in `deps.py`; `test_time_of_day_night_wraps_midnight` proves 23:15 + 03:45 both match one query |
| 4 | Zero/omitted filter group returns every row, never always-false `IN ()` | ✓ VERIFIED | `if self.field:` truthy guard (not `is not None`); `test_omitted_bp_category_returns_all_rows` |
| 5 | Claude can express "Stage 1 and Stage 2" as one filter command | ✓ VERIFIED | `DashboardCommand.bp_category: list[BPCategoryToken]`; `_apply_command`'s list-comprehension mapping |
| 6 | Claude can express "back to all categories" distinct from not mentioning | ✓ VERIFIED | sibling `bp_category_all`/`pulse_category_all`/`time_of_day_all` flags; precedence coded in `_apply_command`; `test_all_flags_default_false_and_settable_independently_of_list_field` |
| 7 | Claude can filter by pulse category and 4-bucket time of day via the same list pattern | ✓ VERIFIED | `PulseCategoryToken`/`TimeOfDayToken` + matching `_apply_command` branches; `test_pulse_category_and_time_of_day_parse_as_lists_and_lowercase` |
| 8 | `am_pm` token vocabulary no longer exists anywhere in the agent surface | ✓ VERIFIED | `grep -rn "AMPM_TOKEN_TO_LABEL\|amPm\|\bam_pm\b" backend/app/agent/ backend/tests/test_agent_*.py` → zero matches (one unrelated `am_pm=` Reading-fixture kwarg in `test_agent_route.py` is the untouched `Reading.am_pm` column, not the retired filter) |
| 9 | Multi-value filter serializes as repeated query params, not comma-joined | ✓ VERIFIED | `client.ts:56-57` `Array.isArray(value)` → `search.append(key, v)` per item |
| 10 | Zero/every value in a group resolves to an omitted query key | ✓ VERIFIED | `selectedOrOmit` in `dates.ts`; `dates.test.ts` |
| 11 | Prior single BP-category selection survives first load post-deploy (never silently reset) | ✓ VERIFIED | `migrateV2` in `store/filters.ts`; `filters.test.ts` "v2 → v3 migration" describe block |
| 12 | Multi-select across BP/pulse/time-of-day groups, no group limited to one choice | ✓ VERIFIED | `Record<K, boolean>` store shape; `FilterBar.test.tsx` "Stage 1 then Stage 2 leaves BOTH true" |
| 13 | Clicking one checkbox changes only that checkbox; agent full-replace replaces the whole group | ✓ VERIFIED | `toggle*` (single-key) vs `set*` (exhaustive rebuild) action pairs in `filters.ts`, both unit-tested |
| 14 | Caregiver can check Stage 1 + Stage 2 together and see both apply | ✓ VERIFIED | `FilterBar.test.tsx:113-121`, comment explicitly names this the phase's headline capability |
| 15 | Caregiver can filter by Pulse Category (new control) | ✓ VERIFIED | `FilterBar.tsx:223-255`; 3 checkboxes, tested |
| 16 | Caregiver can filter by Time of Day, replacing the AM/PM binary | ✓ VERIFIED | `FilterBar.tsx:159-181`; 4 checkboxes, tested |
| 17 | Every checkbox is a real `<input type=checkbox>`, ≥48px target, Tab/Space operable | ✓ VERIFIED | `boxClass`/chip `<label>` both carry `min-h-12`; `FilterBar.test.tsx` "48px accessibility floor" asserts all 13 labels; native `<input>` guarantees Tab/Space (see Human Verification for the visual focus-ring/contrast spot-check) |
| 18 | Server-composed multi-select delta correctly replaces whole BP Category selection | ✓ VERIFIED | `applyAgentFilters`'s `f.bpCategory != null` branch calling `s.setBpCategory(f.bpCategory)` (full replace); `agent.test.ts` |
| 19 | Spoken confirmation names every selected category/bucket grammatically, never a raw list dump | ✓ VERIFIED | `composeConfirmation`'s `joinWithAnd`-based suffixes; exact UI-SPEC §9 worked example reproduced verbatim in `agent.test.ts:358-381` |
| 20 | Reset marks correct D-08 pulse groups (timeOfDay/pulseCategory, not amPm) | ✓ VERIFIED | `agent.ts:110-118` `touched.add("timeOfDay")`/`touched.add("pulseCategory")` in the `f.reset` branch |
| 21 | Zero-result empty state describes which of the (now 3) filter groups produced no matches | ✓ VERIFIED | `EmptyState.tsx`'s `timeOfDayPrefix`/`bpCategoryClause`/`pulseCategoryClause` |
| 22 | Stats query + empty-state copy read from the store's v3 shape, not a stale scalar | ✓ VERIFIED | `useStats.ts`/`App.tsx` subscribe to `timeOfDay`/`pulseCategory`/`bpCategory` maps; zero `amPm` references |
| 23 | Guide's "What Can I Say" + Filters help text describe time-of-day/pulse-category, not AM/PM | ✓ VERIFIED | `voiceCommands.ts` 10 entries incl. `time-of-day`/`pulse-category`; `GuideOverlay.tsx` Filters section rewritten; `grep "AM or PM\|morning (AM)"` → zero matches |
| 24 | Full frontend test suite compiles/passes against the v3 shape, no scalar fixture remains | ✓ VERIFIED | `npx vitest run` → 523/523 passed (39 files); `npx tsc -b --force` → 0 errors |
| 25 | ACC-03 parity suite proves every list-typed field voice-reachable + byte-for-byte token parity | ✓ VERIFIED | `agent-parity.test.ts` reads `backend/app/agent/schemas.py` off disk via regex, asserts `BPCategory`/`PulseCategory`/`TimeOfDayBucket` token sets match exactly; passes |

**Score:** 25/25 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/deps.py` | list-typed filters + `PulseCategory`/`TimeOfDayBucket` + `classify_time_of_day`/`_time_of_day_predicate` | ✓ VERIFIED | All present, `am_pm` param fully removed, truthy-guard discipline intact |
| `backend/tests/test_time_of_day.py` | boundary unit tests incl. midnight wrap | ✓ VERIFIED | 10 parametrized boundary cases, all pass |
| `backend/app/agent/schemas.py` | list-typed `DashboardCommand`/`AppliedFilters` + `*_all` flags + `PULSE_TOKEN_TO_LABEL` | ✓ VERIFIED | Matches plan exactly; `"all"` sentinel removed from `BPCategoryToken` |
| `frontend/src/api/types.ts` | `PulseCategory`/`TimeOfDayBucket` unions; list-typed `ResolvedFilters`/`AppliedFilters` | ✓ VERIFIED | Exact match |
| `frontend/src/lib/dates.ts` | `selectedOrOmit`/`selectedKeys`/`selectedOrAll` + `TIME_OF_DAY_ORDER` | ✓ VERIFIED | Present, reused consistently across `agent.ts`/`EmptyState.tsx`/`FilterBar.tsx` |
| `frontend/src/api/client.ts` | array-valued query param support via `.append()` | ✓ VERIFIED | `Array.isArray(value)` branch confirmed |
| `frontend/src/store/filters.ts` | v3 shape + `migrateV2` + toggle/set action pairs | ✓ VERIFIED | Full v1→v2→v3 chain; all 6 new actions present and tested |
| `frontend/src/components/FilterBar.tsx` | 4-group checkbox surface | ✓ VERIFIED | Date (buttons, unchanged) + Time of Day/BP Category/Pulse Category (real checkboxes) |
| `frontend/src/components/FilterBar.test.tsx` | component tests, ≥80 lines | ✓ VERIFIED | 185 lines, 11 tests, all pass |
| `frontend/src/lib/agent.ts` | `applyAgentFilters` + `composeConfirmation` multi-select grammar | ✓ VERIFIED | Matches UI-SPEC §9 worked example verbatim |
| `frontend/src/lib/agent-parity.test.ts` | v3 parity + `toggleBpCategory` exclusion documented | ✓ VERIFIED | 366 lines; regex reads real backend file; `toggleBpCategory` correctly excluded from agent-reachable surface |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `backend/app/routers/readings.py` | `backend/app/deps.py` | `ReadingFilters` dependency + `.apply(stmt)` | ✓ WIRED | Unchanged wiring, confirmed by passing integration tests |
| `deps.py apply()` | `Reading.pulse_category`/`bp_category` | `.in_()` | ✓ WIRED | Confirmed via `test_pulse_category_filter`/`test_bp_category_or_within_group` |
| `service.py _apply_command` | `schemas.py BP_TOKEN_TO_LABEL`/`PULSE_TOKEN_TO_LABEL` | list comprehension `TOKEN_TO_LABEL[t]` | ✓ WIRED | Confirmed in `service.py:211-229` |
| `prompt.py SYSTEM_PROMPT` | `schemas.py` token Literals | vocabulary text | ✓ WIRED | `time_of_day`/`pulse_category` sections present, tokens match schema |
| `lib/dates.ts resolveFilters` | `api/client.ts getJson` | `ResolvedFilters` → `search.append` | ✓ WIRED | `useStats.ts` → `resolveFilters` → `getJson`, confirmed by reading all three files |
| `FilterBar.tsx` | `store/filters.ts toggle*` | checkbox `onChange` | ✓ WIRED | Confirmed via `FilterBar.test.tsx` state-mutation assertions |
| `FilterBar.tsx` sentence | `lib/dates.ts selectedOrAll` | zero-or-all collapse | ✓ WIRED | Confirmed via sentence-collapse tests |
| `lib/agent.ts applyAgentFilters` | `store/filters.ts set*` | `AppliedFilters` delta application | ✓ WIRED | Confirmed via `agent.test.ts` |
| `lib/agent.ts composeConfirmation` | `lib/showSentence.ts joinWithAnd` | multi-select grammar | ✓ WIRED | Confirmed by exact worked-example test |
| `App.tsx` | `EmptyState.tsx` | `timeOfDay`/`bpCategory`/`pulseCategory` props | ✓ WIRED | Confirmed by direct file read |
| `useStats.ts useResolvedFilters` | `dates.ts resolveFilters` | store subscription → resolved params | ✓ WIRED | Confirmed by direct file read |
| `agent-parity.test.ts` | `backend/app/agent/schemas.py` | `readFileSync` + regex, `list[Literal[...]]` | ✓ WIRED | Regex tolerant of ruff line-wrapping, confirmed passing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend targeted suite (readings/time-of-day/agent schema/service/route/fixtures) | `pytest tests/test_api_readings.py tests/test_time_of_day.py tests/test_agent_schemas.py tests/test_agent_service.py tests/test_agent_route.py tests/test_agent_fixtures.py -q` | `126 passed, 43 deselected` | ✓ PASS |
| Backend full suite | `pytest -q` | `329 passed, 7 skipped, 43 deselected` | ✓ PASS |
| Frontend full suite | `npx vitest run` | `523 passed (523), 39 files` | ✓ PASS |
| TypeScript project build | `npx tsc -b --force` | 0 errors | ✓ PASS |
| `agent_utterances.json` fixture — zero stale `amPm` keys | `python3` JSON re-parse + key scan | `stale amPm entries: 0`, 9 entries converted to `timeOfDay`/list `bpCategory` | ✓ PASS |
| `am_pm`/`amPm` fully removed from agent surface | `grep -rn "AMPM_TOKEN_TO_LABEL\|amPm\|\bam_pm\b" backend/app/agent/ backend/tests/test_agent_*.py` | one unrelated `Reading.am_pm=` fixture kwarg only | ✓ PASS |

### Requirements Coverage

No standalone `REQUIREMENTS.md` file exists in this repository (confirmed: `.planning/REQUIREMENTS.md` not present). Requirement traceability for this phase instead lives in `15-VALIDATION.md`'s Per-Task Verification Map and each plan's `requirements:` frontmatter, cross-checked against every `SUMMARY.md`'s `requirements-completed` field.

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PH15-01 | 15-05 | FilterBar AM/PM(dropped)/BP Category render as checkboxes, multi-select | ✓ SATISFIED | `FilterBar.tsx` + `FilterBar.test.tsx` |
| PH15-02 | 15-01 | `pulse_category` filters `/readings`/`/stats/summary` via IN | ✓ SATISFIED | `deps.py`, `test_pulse_category_filter` |
| PH15-03 | 15-01 | `time_of_day` boundary function classifies hours correctly, incl. midnight wrap | ✓ SATISFIED | `test_time_of_day.py` (10 boundary cases) |
| PH15-03b | 15-01 | `time_of_day` query filter returns correct rows across midnight boundary | ✓ SATISFIED | `test_time_of_day_night_wraps_midnight` |
| PH15-04 | 15-04 | v2→v3 localStorage migration preserves a single prior BP-category selection | ✓ SATISFIED | `filters.test.ts` "v2 → v3 migration" |
| PH15-05 | 15-01, 15-03, 15-04 | Empty selection == no restriction (zero-or-all) | ✓ SATISFIED | `deps.py` truthy guard, `selectedOrOmit`, store default maps |
| PH15-05b | 15-01 | IN clause with 2+ values ORs correctly within a group | ✓ SATISFIED | `test_bp_category_or_within_group`, `test_time_of_day_or_within_group` |
| PH15-06 | 15-02 | Agent schema accepts list-typed `bp_category`/`pulse_category`/`time_of_day`, case-insensitive | ✓ SATISFIED | `test_pulse_category_and_time_of_day_parse_as_lists_and_lowercase` |
| PH15-07 | 15-06 | `composeConfirmation` produces grammatically correct multi-select suffixes | ✓ SATISFIED | `agent.test.ts` UI-SPEC §9 worked-example test |
| PH15-08 | 15-01 | Omitted `list[X] \| None` resolves to `None` (all), not `[]` (none) | ✓ SATISFIED | `test_omitted_bp_category_returns_all_rows` |

No orphaned requirement IDs found — every PH15-* ID referenced across the 8 plans' frontmatter is accounted for in `15-VALIDATION.md`'s mapping table and confirmed satisfied above.

### Anti-Patterns Found

None in the files this phase modified. Scanned all 17 primary artifact files (backend `deps.py`/`schemas.py`/agent `schemas.py`/`service.py`/`prompt.py`; frontend `types.ts`/`palette.ts`/`client.ts`/`dates.ts`/`filters.ts`/`FilterBar.tsx`/`agent.ts`/`EmptyState.tsx`/`App.tsx`/`useStats.ts`/`voiceCommands.ts`/`GuideOverlay.tsx`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — zero matches.

**Carried forward from `15-REVIEW.md` (0 critical, 4 warning, 1 info — pre-existing on record, not new findings from this verification pass, and none block the phase goal):**

| File | Severity | Impact |
|------|----------|--------|
| `GuideOverlay.tsx:308-323` (Charts/Overlay sections) | ⚠️ Warning (WR-01) | Describes pre-Phase-14 UI ("Pulse Trend" chart, "chart-picker cards"); explicitly out-of-scope for Phase 15 per 15-07-PLAN.md's own action text ("pre-existing Phase-14-era inaccuracy... leave it as-is") — a real accessibility debt item, but not this phase's to fix |
| `backend/app/agent/prompt.py:43-51` | ⚠️ Warning (WR-02) | No disambiguation rule for the shared "normal" token between BP category and pulse category — only exercised by the live-gated eval suite |
| `backend/app/agent/service.py:141-162` | ⚠️ Warning (WR-03) | Client-supplied `ClarifyContext.question` replayed into `assistant`-role messages with no server-side signature — bounded risk (closed-schema output, single-user threat model) |
| `frontend/src/lib/agent.ts:94-105` vs `:130-134` | ⚠️ Warning (WR-04) | `hasOtherCommand`'s `customRange` presence check (`!= null`) disagrees with the mutation guard (`&&` truthy) — not reachable today since the backend never emits empty-string dates |
| `frontend/src/components/FilterBar.tsx:196-197`/`232-233` | ℹ️ Info (IN-01) | BP/Pulse Category chip className duplicated instead of a shared `chipClass` constant |

### Human Verification Required

### 1. Colored-chip checkbox keyboard navigation + contrast

**Test:** Tab through FilterBar's Time of Day, BP Category, and Pulse Category groups in both light and dark theme; confirm a visible focus ring on every checkbox/label, and that chip fill/text/tick remain legible (≥3:1 contrast) across all 6 BP-category and 3 pulse-category background colors.
**Expected:** Every checkbox is keyboard-reachable via Tab and toggleable via Space; a visible focus indicator appears on each; no color combination is illegible in either theme.
**Why human:** No automated Recharts/chip accessibility test exists in this suite (this exact gap is called out in `15-VALIDATION.md`'s own Manual-Only Verifications table). Visual contrast and focus-ring rendering cannot be graded by grep or unit test.

### 2. Live voice round-trip for the new pulse-category/time-of-day tokens

**Test:** Once the Anthropic account has a positive balance (AGENT-01, currently $0), re-run the 43-fixture live eval (`pytest -m live`) and manually speak 2-3 utterances exercising the new tokens (e.g. "show tachycardia readings", "mornings and evenings").
**Expected:** The live model correctly routes these utterances through the updated `SYSTEM_PROMPT` vocabulary to `pulse_category`/`time_of_day`/`*_all` fields; the 9-site `agent_utterances.json` conversion (`amPm`→`timeOfDay`, scalar `bpCategory`→list) produces matching live results.
**Why human:** The agent is inert in production (pre-existing, project-wide AGENT-01 blocker — not introduced by this phase). This is the same accepted limitation carried since Phase 3's verification; offline unit/fixture coverage (already 100% green) is the best available substitute until billing is funded.

### Gaps Summary

No gaps. All 25 derived observable truths (merged from ROADMAP's phase goal plus all 8 plans' `must_haves.truths`) are verified against actual, working code — not stubs. The headline capability ("Stage 1 AND Stage 2" simultaneously) is proven by a real component test clicking two checkboxes and asserting both remain true in the store, backed by a real SQL `IN`-clause on the server. The two new filters (Pulse Category, Time of Day) are fully wired from backend query through agent schema to the FilterBar UI. `am_pm` is cleanly retired from every layer except the still-required `Reading.am_pm` column/response field (explicitly preserved per plan). Full backend (329 passed/7 skipped) and frontend (523/523) suites are green, `tsc -b --force` is clean, and no debt markers exist in any file this phase touched.

Status is `human_needed` rather than `passed` solely because two items require a human/live environment: a visual accessibility spot-check of the new colored checkboxes (no automated equivalent exists), and the live voice round-trip (blocked on Anthropic account funding, a pre-existing project-wide condition, not a defect introduced by this phase).

One scope deviation is noted for visibility (not scored as a gap): the shipped design replaced AM/PM with Time of Day (UI-SPEC §10 "Option B") rather than having both coexist as ROADMAP.md's prose literally suggests (§10 "Option A"). This was an explicit, approved planning decision (15-VALIDATION.md, approved 2026-09-16) and ROADMAP.md carries no machine-readable `success_criteria` that this contradicts.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
