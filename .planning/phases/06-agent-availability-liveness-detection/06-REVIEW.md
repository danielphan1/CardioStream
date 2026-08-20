---
phase: 06-agent-availability-liveness-detection
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/app/main.py
  - backend/tests/test_agent_route.py
  - backend/tests/test_agent_service.py
  - backend/tests/test_health.py
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/components/AgentStatusBanner.test.tsx
  - frontend/src/components/AgentStatusBanner.tsx
  - frontend/src/components/CommandBar.test.tsx
  - frontend/src/components/CommandBar.tsx
  - frontend/src/hooks/useHealth.test.ts
  - frontend/src/hooks/useHealth.ts
  - frontend/src/hooks/useVoiceCommand.test.ts
  - frontend/src/hooks/useVoiceCommand.ts
  - frontend/src/lib/copy.ts
  - frontend/src/store/agentStatus.test.ts
  - frontend/src/store/agentStatus.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the backend circuit-breaker/`interpret()` pipeline, the `/health` probe,
the wire schemas, and the frontend liveness plumbing (`useHealth`,
`AgentStatusBanner`, `agentStatus` store) plus the two consumers that report
outcomes into it (`CommandBar`, `useVoiceCommand`).

The backend half is solid: the guard order in `service.py` matches its own
docstring exactly, every `anthropic` SDK exception that can be raised by
`messages.parse()` is a subclass of `APIError` (verified against the installed
0.117.0 SDK, so the `except APIError` / `except ValidationError` split is
exhaustive), the breaker never touches the frontend as a reason string, and the
full backend test suite (29 tests) passes. `tsc --noEmit` and `oxlint` are
clean on every reviewed frontend file, and all 54 frontend tests pass.

The issues found are all in the frontend's edge-case handling: state that
doesn't get reset after certain voice-recognition transitions, a shared local
clarify-context that a concurrent voice command can silently invalidate, and a
missing request-timeout story that undermines the very "liveness detection"
this phase implements once a request hangs instead of failing outright. None
of these are data-loss or security issues; all are real, traceable, currently
untested code paths.

## Warnings

### WR-01: Voice UI can get stuck displaying a stale "triggered" transcript after a wake-word-only utterance or a silence restart

**File:** `frontend/src/hooks/useVoiceCommand.ts:176` and `frontend/src/hooks/useVoiceCommand.ts:214-222`

**Issue:** `handleResult` sets `voiceState` to `"triggered"` the moment an
*interim* result contains a stripped (possibly empty) command
(lines 169-174, `setInterim(command); setVoiceState("triggered")`). The only
code paths that ever move `voiceState` back to `"listening"` are: a completed
mutation (`handleSuccess`/`handleError`, both call `setVoiceState("listening")`),
an explicit `stop()`, or `enterPaused()`. Two reachable paths never do this:

1. Line 176 — when the recognizer finally finalizes a wake-word-only
   utterance (`command === ""`), the function returns immediately without
   resetting `interim`/`voiceState`. If an interim event already flipped the
   state to `"triggered"` (very likely, since `rec.interimResults = true` is
   always set, line 200), the bar is left showing a blank green "triggered"
   line instead of reverting to the `"LISTENING — say ‹wake word›…"` hint.
2. Lines 214-222 (`rec.onend`) — when the browser auto-stops on silence
   *before* a command ever finalizes (user trails off mid-sentence), `onend`
   calls `scheduleRestart()` but never resets `voiceState`/`interim`. The
   recognizer silently restarts and is listening again, but the UI keeps
   showing the last (stale, unsubmitted) interim transcript in the
   "triggered" state indefinitely — misleading feedback in a voice-primary
   accessibility app where the state indicator is the user's only signal.

Neither branch is covered by `useVoiceCommand.test.ts` (existing restart tests
only exercise `onend` while `voiceState` is still `"listening"`, never after an
interim `"triggered"` transition).

**Fix:** Reset the transient capture state on both paths:
```ts
if (command === "") {
  setInterim("");
  setVoiceState("listening"); // wake word alone → back to the armed hint
  return;
}
```
and in `rec.onend`, before calling `scheduleRestart()`, clear any stale
interim capture that never finalized:
```ts
rec.onend = () => {
  if (!armedRef.current) return;
  if (lastErrorFatalRef.current) {
    enterPaused();
    return;
  }
  if (typeof document !== "undefined" && document.hidden) return;
  if (state === "triggered") {
    setInterim("");
    setVoiceState("listening");
  }
  scheduleRestart();
};
```
(or track "captured but not yet finalized" via a ref rather than closing over
`state`, to avoid the stale-closure trap noted in WR-01's sibling code).

### WR-02: Mic button is never locked out, so switching to voice mid-clarify leaves a stale `clarifyContext` that silently corrupts the next text submission

**File:** `frontend/src/components/CommandBar.tsx:170-177` (onSubmit) and `frontend/src/components/CommandBar.tsx:245-258` (mic button)

**Issue:** The mic `<button>` (lines 245-258) has no `disabled` attribute tied
to `status`, unlike the text `<input>`/`Send` button (`disabled={anyWorking}`,
lines 263, 270). This means the mic is tappable in *every* CommandBar status,
including `"clarify"`.

Trace: user types a command, gets a `clarify` reply → `status="clarify"`,
`clarifyContext` is set, text field clears (lines 130-136). Instead of
answering by text, the user taps the mic and issues an unrelated voice
command. `useVoiceCommand` submits that command with `context: null` (its own
flow is correct, by design voice never carries clarify context) and, on
success, sets its own `voiceState` back to `"listening"`. Because the render
logic (`lineText`) shows the voice hook's own message whenever
`voiceState !== "off"` (lines 211-219), the stale `"Which chart?"` clarify
prompt and the `"?"` marker (only rendered in the `else` branch, line
223-226) are now visually hidden — but CommandBar's own local `clarifyContext`
state was never cleared, because voice and text are two independent hook
instances/local-state trees.

If the user then types a brand-new, unrelated command into the text box and
submits, `onSubmit` (line 176) still sends the **stale** `clarifyContext` from
the abandoned turn:
```ts
mutate({ text: trimmed, context: clarifyContext }, { onSuccess, onError });
```
The backend will treat the new, unrelated text as an answer to the old
(already-superseded) clarifying question — with no visual cue anywhere in the
UI warning the user that a stale context is about to be resent.

**Fix:** Clear (or supersede) `clarifyContext` whenever a command is
successfully submitted through the *other* modality. The cleanest fix is to
route both submission paths through one place that owns `clarifyContext`, or
have `CommandBar` clear its own `clarifyContext`/`status` when it detects the
voice hook transitioned out of idle:
```ts
useEffect(() => {
  if (voiceState === "listening" && clarifyContext !== null) {
    // a voice command ran while a text clarify was pending — it is stale now
    setClarifyContext(null);
    if (status === "clarify") setStatus("idle");
  }
}, [voiceState]);
```
At minimum, disable the mic button while `status === "clarify"` so the two
modalities cannot silently interleave mid-turn.

### WR-03: No request timeout anywhere in `api/client.ts` — a hung connection defeats both the CommandBar's "Working…" state and the `/health` liveness poll's fail-safe design

**File:** `frontend/src/api/client.ts:43-69, 76-99, 108-130`

**Issue:** `getJson`, `postJson`, and `postFile` all call raw `fetch(...)`
with no `AbortController`/`AbortSignal.timeout(...)`. Browsers impose no
implicit application-level timeout on a `fetch` that has established a
connection but never receives a response (a stalled backend process, a proxy
that buffers silently, a half-open TCP connection, etc.).

This has two concrete consequences that are squarely inside this phase's
scope (liveness detection):

1. **`/agent` (CommandBar text path):** `onSubmit` sets `status="working"`,
   which disables the input and Send button (`disabled={anyWorking}`) and has
   no cancel affordance. If the `postAgent` fetch hangs instead of rejecting,
   the bar is stuck in "Working…" indefinitely with no way for the user to
   recover short of a full page reload — a serious usability regression for
   the primary user, who has limited/no hand mobility and relies on the
   command bar as the primary control surface (CLAUDE.md). (Voice has a
   partial escape hatch — tapping the mic calls `stop()`, which bumps the
   sequence guard — but the text path has none.)
2. **`/health` (`useHealth`/`AgentStatusBanner`):** The whole fail-safe
   design ("a `/health` fetch failure itself renders the SAME banner") relies
   on `health.isError` becoming `true`. A hung `/health` fetch never resolves
   or rejects, so the query stays `pending` forever — `isError` never fires,
   and the "Assistant unavailable" banner never appears even though the
   backend is, in the sense that matters to the user, unreachable. This is
   precisely the failure mode a liveness probe exists to catch.

**Fix:** Add a bounded timeout to every fetch call, e.g.:
```ts
res = await fetch(`${BASE}${path}`, {
  headers: { ...authHeaders() },
  signal: AbortSignal.timeout(15_000),
});
```
and map the resulting `TimeoutError`/`AbortError` into the same
`ApiError(0, path)` branch already used for network/CORS failures, so
existing callers (including the `/health` poll and `CommandBar`'s `onError`)
handle it for free.

### WR-04: `useHealth` inherits TanStack Query's default `retry: 3` with backoff, so a real outage takes several seconds (and failed round-trips) to be reflected as `agent unavailable`

**File:** `frontend/src/hooks/useHealth.ts:12-20`

**Issue:** `useHealth`'s `useQuery` does not set `retry`. The production
`QueryClient` (`frontend/src/main.tsx:11`, `new QueryClient()`) has no
`defaultOptions` overriding it either, so the library default of 3 retries
with exponential backoff (roughly 1s/2s/4s, capped at 30s) applies to every
`/health` fetch. Only after all retries are exhausted does `status` flip to
`'error'` and `AgentStatusBanner`'s `health.isError` become `true`.

For a liveness probe specifically meant to detect "the backend is down right
now," this means real outages take multiple round trips and several seconds
to surface — and this latency is invisible in the test suite because every
test `QueryClient` in `useHealth.test.ts` / `AgentStatusBanner.test.tsx`
explicitly passes `defaultOptions: { queries: { retry: false } }`, which masks
production behavior from the tests that are supposed to be verifying it.

**Fix:** Set `retry: false` (or a small bounded retry, e.g. `1`) directly on
the `useHealth` query, since a failed poll is cheap to recover from — the next
scheduled poll fires in ≤60s regardless:
```ts
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 60_000,
    staleTime: 0,
    retry: false,
  });
}
```

## Info

### IN-01: `call_claude()`'s "no client" branch reports `reachable=True`, which is semantically backwards and only safe today because of a duplicated guard in the caller

**File:** `backend/app/agent/service.py:142-145`

**Issue:**
```python
client = _get_client()
if client is None:
    return None, True  # defensive fallback only — interpret()'s own earlier
    # guard already returns before call_claude() is reached in this case.
```
Returning `reachable=True` for the "no API key configured" case is the
opposite of what `reachable` is supposed to mean. It is provably dead code
*today* only because `interpret()` (the sole caller) always checks
`_get_client() is None` itself first and returns before ever calling
`call_claude()`. That coupling is documented in a comment but not enforced by
the type system — any future caller of `call_claude()` (a script, a new
route, a refactor that inlines `interpret()`'s early return) that doesn't
replicate the exact same pre-check would silently get "the agent is
reachable" for a completely unconfigured agent.

**Fix:** Either make the return value semantically correct
(`return None, False`) or remove the dead branch entirely and let
`call_claude()` assume a non-`None` client (asserting/raising if that
invariant is violated), pushing the "no key" handling fully into `interpret()`
where it already lives.

---

_Reviewed: 2026-08-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
