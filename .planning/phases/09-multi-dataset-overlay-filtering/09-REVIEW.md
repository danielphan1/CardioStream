---
phase: 09-multi-dataset-overlay-filtering
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - backend/app/agent/prompt.py
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/tests/test_agent_schemas.py
  - backend/tests/test_agent_service.py
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/components/ChartDeck.tsx
  - frontend/src/components/OverlayEventsList.test.tsx
  - frontend/src/components/OverlayEventsList.tsx
  - frontend/src/components/OverlayToggle.test.tsx
  - frontend/src/components/OverlayToggle.tsx
  - frontend/src/components/charts/BPTimeline.tsx
  - frontend/src/components/charts/PulseTrend.tsx
  - frontend/src/hooks/useCreateRecord.ts
  - frontend/src/hooks/useIncidents.ts
  - frontend/src/hooks/useLabs.ts
  - frontend/src/hooks/useProcedures.ts
  - frontend/src/index.css
  - frontend/src/lib/agent-parity.test.ts
  - frontend/src/lib/agent.test.ts
  - frontend/src/lib/agent.ts
  - frontend/src/lib/overlayEvents.test.ts
  - frontend/src/lib/overlayEvents.ts
  - frontend/src/lib/overlayMeta.ts
  - frontend/src/store/filters.test.ts
  - frontend/src/store/filters.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-08-22
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This is a fresh pass over the current state of the multi-dataset overlay/filtering
feature, run after the 09-07 gap-closure plan. I re-verified the two prior
BLOCKER-tier findings (CR-1 stale-toggle-off data, CR-2 dark-mode contrast) and
confirmed both are fixed on disk: `App.tsx` and `OverlayEventsList.tsx` both gate
each dataset's contribution on the live `overlayDatasets.*`/`enabled` flag (not
just query `enabled`/`isError`), and the overlay toggle/badge text now uses the
theme-aware `var(--overlay-chip-text)` token instead of hardcoded white. The
previously-flagged `WR-3` (agent-parity test coverage gap for `DatasetToken`) is
also closed — `agent-parity.test.ts` now has full `it.each(DATASETS)` reachability
coverage and a backend↔frontend token-equality test. `IN-1` (the `window` shadow
in `App.tsx`) is fixed — the local binding is now named `dateWindow`. All 100
frontend unit tests and 45 backend agent tests pass locally.

No new BLOCKER/CRITICAL issues were found. I found two new WARNING-level issues
(a misleading transient "No data recorded" flash on overlay toggle-on before the
fetch resolves, and a diagnostics gap in `service.interpret()`'s catch-all
exception handler), and the previously-deferred `WR-1` (overlay toggles are never
mentioned in the spoken/visual D-07 confirmation banner) is still present on disk
exactly as before — restated here for completeness since this review assesses
current state, not prior deferral decisions. One INFO item (a stale docstring)
also carries forward unchanged.

## Warnings

### WR-01: Toggling an overlay dataset ON can flash a false "No data recorded" message before the fetch resolves

**File:** `frontend/src/App.tsx:73-75, 189-201`
**File:** `frontend/src/components/OverlayEventsList.tsx:23-33, 87-91`
**File:** `frontend/src/hooks/useLabs.ts:13-21` (same pattern in `useIncidents.ts`, `useProcedures.ts`)

**Issue:** `useLabs`/`useIncidents`/`useProcedures` are gated with `enabled:
overlayDatasets.X` and use `placeholderData: keepPreviousData`. `keepPreviousData`
only has something to placeholder with if that query key has *previously*
resolved. The very first time a dataset is toggled ON in a session (or after a
date-window change invalidates the cached key), the query transitions
`enabled: false → true` with no prior data under that key: `labs.data` is
`undefined` and `labs.isPending` is `true` for the duration of the network
round-trip.

`App.tsx` passes only `{ enabled, events, isError }` into `OverlayEventsList` —
`events` is already coerced to `labsToEvents(labs.data ?? [])`, i.e. `[]` while
the fetch is in flight — and `OverlayEventsList` has no `isPending`/`isLoading`
field to distinguish "still loading" from "confirmed empty":

```tsx
// OverlayEventsList.tsx
const healthyOnTypes = onTypes.filter((t) => !byType[t].isError);
const emptyMessage =
  merged.length === 0 && healthyOnTypes.length > 0
    ? buildEmptyMessage(healthyOnTypes)   // "No labs recorded in this date range."
    : null;
```

Because `labs.isError` is `false` while pending (it's neither pending-as-error
nor errored — it just hasn't returned yet), `healthyOnTypes` includes `labs` and
`merged.length === 0`, so the component renders `"No labs recorded in this date
range."` — a factually wrong claim — for the duration of the fetch, before
flipping to the real rows (or the real empty message) once the query settles.
For a voice-first app whose stated value proposition is that the user can trust
what the UI/voice confirmation says happened, telling Chris "no labs recorded"
when the data simply hasn't arrived yet is a real (if transient) correctness
gap, and it's most visible exactly when it matters most: right after a caregiver
or Chris says "show my labs."

**Fix:** Thread `isPending`/`isLoading` through the same props channel as
`isError` and skip both the empty-message and error-message branches while
pending, e.g.:

```tsx
// App.tsx
<OverlayEventsList
  labs={{ enabled: overlayDatasets.labs, events: labsEvents, isError: labs.isError, isPending: labs.isPending }}
  ...
/>

// OverlayEventsList.tsx
const healthyOnTypes = onTypes.filter((t) => !byType[t].isError && !byType[t].isPending);
```

---

### WR-02: `service.interpret()`'s catch-all exception handler logs no exception detail, making real bugs undiagnosable in production

**File:** `backend/app/agent/service.py:228-276`

**Issue:** The entire body of `interpret()` — including `_get_client()`,
`call_claude()`, and every result-branch dispatch added in this phase (the new
`isinstance(result, ToggleDataset)` branch at line 245-246) — is wrapped in:

```python
except Exception:  # noqa: BLE001 — absolute never-500 backstop (VOICE-07)
    logger.warning("Unexpected error interpreting /agent input; degrading to unclear reply")
    return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
```

The "never crash the route" contract this implements is reasonable and
intentional (documented, and I'm not proposing changing the returned reply). But
the `logger.warning` call passes no `exc_info=True` and no exception object, so
if a genuine programming error occurs anywhere in this function — e.g. a
`KeyError` in `BP_TOKEN_TO_LABEL`/`AMPM_TOKEN_TO_LABEL`, an `AttributeError` from
a future refactor of `_apply_toggle_dataset`/`_apply_command`, or any other bug
introduced in a future change to this file — it is silently reduced to one fixed
log line with zero stack trace, file/line, or exception type. Combined with the
service's design goal of *never* surfacing errors to the client, this makes the
backend's only diagnostic signal for a real defect in this code path
unrecoverable after the fact. This directly undermines the ability to catch a
regression like this phase's own `ToggleDataset` branch breaking in production.

**Fix:** Keep the safe fallback reply, but log the exception with a trace:

```python
except Exception:  # noqa: BLE001 — absolute never-500 backstop (VOICE-07)
    logger.warning("Unexpected error interpreting /agent input; degrading to unclear reply", exc_info=True)
    return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
```

---

### WR-03: Overlay toggle changes are still never mentioned in the primary confirmation banner (carried forward, still present on disk)

**File:** `frontend/src/lib/agent.ts:114-145`
**File:** `backend/app/agent/prompt.py:3-7`

**Issue:** This is the prior review's `WR-1`, explicitly deferred rather than
fixed by plan 09-07. Re-verifying against the current code: it is still present
exactly as before. `composeConfirmation()` — the function that produces the D-07
full-state echo other filter dimensions rely on — has no clause for
`overlayDatasets`:

```ts
return `Showing ${chartPhrase}, ${rangePhrase}${ampmSuffix}${categorySuffix}`;
```

When a `toggle_dataset` command comes back from `/agent`, `service.py`'s
`_apply_toggle_dataset` intentionally returns `message: ""` and defers to this
frontend echo (per its own comment), and `applyAgentFilters` correctly flips
`overlayDatasets.labs`, but the text the user actually sees/hears via the
primary confirmation channel says nothing about the overlay change — only
`OverlayToggle`'s own secondary `aria-live` sentence discloses it.

Worth noting on this pass: `prompt.py`'s module docstring makes a security/UX
claim that is not accurate for this one command type:

```python
# the worst a hostile transcript can do is flip a filter — visible via the D-07
# echo — because all user text stays in ``user`` role messages...
```

For every other `DashboardCommand` field this is true (the D-07 echo covers
chart/date/AM-PM/category). For `toggle_dataset` specifically it is not — an
unwanted overlay flip (from noise, mis-transcription, or an adjacent
conversation) surfaces only through a secondary live region, not the primary
banner this comment is citing as the mitigation.

**Fix:** (unchanged from prior review) Extend `composeConfirmation`'s template,
or add a sibling helper `agent.ts` callers can append, with an overlay clause
sourced from `buildOverlaySentence`/`overlayDatasets`. If this is deliberately
staying deferred, consider softening the `prompt.py` docstring's blanket "every
filter change is visible via the D-07 echo" claim so it doesn't overstate the
current mitigation for `toggle_dataset`.

## Info

### IN-01: Docstring still overstates the depth limit of `_lower_value`'s recursion (carried forward, unchanged)

**File:** `backend/app/agent/schemas.py:168`

**Issue:** Unchanged since the prior review:

```python
def _lower_value(key: str, val: object) -> object:
    """Lowercase string values (and one level of nested dict, e.g. date_range) except ``question``."""
```

The implementation recurses through `_lower_value` on every nested dict value at
any depth, not just one level. Harmless today (no currently-reachable structure
deeper than two levels), but will mislead a future reader who adds a deeper
nested variant and assumes normalization stops at depth 1.

**Fix:** Tighten the docstring to "recursively lowercases nested dict values at
any depth."

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
