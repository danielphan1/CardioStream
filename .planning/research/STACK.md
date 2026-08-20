# Stack Research — v1.1 (Polish & Records)

**Domain:** Additions to an existing voice-first health dashboard — spoken TTS replies, multi-dataset chart overlay, in-app help/guide, agent-liveness detection
**Researched:** 2026-08-19
**Confidence:** MEDIUM-HIGH (native-API behavior verified against MDN + multiple independent sources; Anthropic SDK/error findings verified directly against the installed package source, version 0.117.0; Recharts findings verified against the official repo docs via Context7)

## Headline Finding

**This milestone needs zero new npm packages and zero new PyPI packages.** All four features are achieved with native browser APIs, the already-installed `anthropic` SDK (0.117.0, exceeds the 0.116.0 floor), the already-installed `recharts` (3.9.2), and the existing zustand/TanStack Query architecture. The work here is almost entirely *pattern* and *integration-point* research, not library selection. Where a temptation exists to reach for a library (TTS wrapper, router, accordion primitive), the recommendation below is explicitly **do not add it** — see "What NOT to Use."

## Recommended Stack

### Core Technologies (all either native or already installed — no version bumps)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Web `SpeechSynthesis` / `SpeechSynthesisUtterance` (native) | Browser built-in, no package | Spoken confirmation replies (TTS) | Broader browser support than `SpeechRecognition` — works on Chrome/Edge, Firefox, **and** Safari desktop/iOS (Safari 7+). Standard, unprefixed, part of TS's `lib.dom.d.ts` already (unlike `SpeechRecognition`, which this project had to hand-declare in `types/speech.d.ts`). Zero new dependency; fits the fixed "Web Speech API" constraint in CLAUDE.md, which already covers synthesis, not just recognition. |
| Recharts `ComposedChart` + `ReferenceLine` (existing, 3.9.2) | No bump | Overlay incidents/procedures/lab-draw markers on the BP Timeline and Pulse Trend charts | Recharts already supports mixed-series overlay natively — `ComposedChart` is the documented pattern for combining `Line`/`Bar`/`Area`/`Scatter`/`Reference*` children, and z-order is JSX order (a convention this codebase's `BPTimeline.tsx` already documents and relies on for its AHA category bands). No new charting library needed. |
| `anthropic` Python SDK (existing, 0.117.0) — `client.messages.count_tokens()` + typed `APIStatusError` hierarchy | No bump | Cheap, zero-token liveness probe + precise billing-failure classification | `messages.count_tokens` is documented as free (no token cost, no credit-balance requirement) — it validates auth/reachability without ever touching billed inference. Separately, the **installed SDK already ships a distinct `billing_error` `ErrorType`** (`anthropic/types/shared/error_type.py`, `billing_error.py`) surfaced through `APIStatusError.type`, which is exactly the signal needed to detect "the account can't afford a real call" instead of guessing from status codes or string-matching messages. |
| zustand (existing, 5.0.14) | No bump | New store fields: `visibleDatasets` (dataset toggle state), `view: "guide"` | Every new piece of UI state here (which datasets are toggled on, whether the guide tab is open) is exactly the kind of ephemeral client-side UI state this project already keeps in zustand (`store/filters.ts`, `store/view.ts`) — same pattern, no new state library. |

### Supporting Libraries

**None required.** See "What NOT to Use" below for the libraries that were considered and rejected, with reasons.

### Development Tools

No new dev tooling. Existing Vitest/Testing Library setup covers the new hooks (`useSpeechSynthesis`, dataset-toggle store actions); existing pytest/httpx setup covers the new `/health` behavior and the extended `AgentReply` kind.

## Installation

```bash
# Nothing to install for this milestone — frontend and backend package.json /
# pyproject.toml are unchanged. All four features use APIs already present:
#   - window.speechSynthesis (native browser API, no import)
#   - recharts ComposedChart / ReferenceLine (already in node_modules)
#   - anthropic.messages.count_tokens (already in the installed SDK)
#   - zustand (already in node_modules)
```

## Deep Dive 1 — Spoken Replies (Web SpeechSynthesis)

**No library.** Build a small `hooks/useSpeechSynthesis.ts` + `lib/tts.ts` pure-helpers pair, mirroring the existing `lib/voice.ts` + `hooks/useVoiceCommand.ts` split (pure/testable helpers, stateful hook). This project already made this exact call once before — CLAUDE.md's own alternatives table lists "custom hook over raw `webkitSpeechRecognition`" as the fallback if `react-speech-recognition` fought Safari, and the actual `frontend/src/lib/voice.ts` shows they took the custom-hook path directly, never installing that library at all. Do the same for TTS.

**Verified facts (MDN, HIGH confidence):**
- `speechSynthesis.getVoices()` loads **asynchronously in Chrome** — the list is empty on first call until the `voiceschanged` event fires. Standard pattern: call `getVoices()` once immediately, and again in a `speechSynthesis.onvoiceschanged` handler; treat both as valid sources (some browsers never fire the event if voices are already cached).
- `voiceschanged` itself is a broadly supported, non-experimental event (baseline since Sept 2022).

**Safari / iOS-specific quirks (MEDIUM confidence — weboutloud.io + Apple Developer Forum threads + dev.to, cross-checked, no official Apple doc contradicts them):**
- `getVoices()` can return an **empty array on Safari** (documented on 15.4) — voice *selection* is unreliable enough that the safest default is to **not require a specific voice at all**: construct `new SpeechSynthesisUtterance(text)` and let the browser use its default voice/lang. Only offer a voice-picker as a progressive enhancement gated on `getVoices().length > 0`.
- **Speech halts when Safari is backgrounded mid-utterance** (tab switch, screen lock, app backgrounded) and does not auto-resume. This project already solved the analogous problem for `SpeechRecognition` in `lib/voice.ts`/`useVoiceCommand.ts` via a `visibilitychange` listener that aborts and controlledly resumes the recognizer — **reuse that exact pattern** for TTS: on `document.hidden`, call `speechSynthesis.cancel()` rather than let it hang; don't try to auto-resume a stale utterance.
- **iOS Safari requires the *first* `speak()` call to occur synchronously inside a user gesture** (a tap handler), or it silently does nothing — this is the same category of restriction as `SpeechRecognition.start()`, which the project's `useVoiceCommand.start()` already satisfies (must run inside the caregiver's mic tap, per the existing `D-01` comment). **Recommendation: prime `speechSynthesis` in the exact same tap handler** — e.g., call `speechSynthesis.speak(new SpeechSynthesisUtterance(""))` (empty/silent utterance) at the top of the existing `start()` function in `useVoiceCommand.ts` — so that later, gesture-less `speak()` calls triggered by voice-driven confirmations succeed on iOS Safari for the rest of the session.
- **Chrome's ~15-second utterance bug**: Chrome (specifically "Google" network voices) pauses speech after ~14s and doesn't auto-resume unless the app calls `speechSynthesis.resume()` on an interval. This app's confirmation strings (`composeConfirmation()` in `lib/agent.ts`) are short, single-sentence status echoes — well under 15 seconds spoken — so this is a **documented non-issue for v1.1**, not something to build a chunking workaround for. Flag it only if confirmation copy grows materially longer later.

**Load-bearing integration pitfall (new finding, not covered by any existing doc — HIGH confidence, derived directly from this codebase's own architecture):**
`useVoiceCommand.ts` keeps a **continuous, always-listening `SpeechRecognition` session** (`rec.continuous`, `onresult` firing on every result). If the browser plays the TTS confirmation out loud through the same device's speakers while that microphone session is still armed, **the mic can pick up the assistant's own spoken reply as new input** — a feedback loop, and worse, on devices without headphones/echo cancellation, the wake word or a stray phrase in the confirmation could re-trigger a command. **Recommendation:** pause/ignore recognizer results while `speechSynthesis.speaking === true`, and resume listening on the utterance's `onend`/`onerror`. This is the single most important cross-feature integration point between the existing STT and the new TTS work — should be an explicit phase task, not an afterthought.

**Voice selection:** don't build a voice picker for v1.1 — PROJECT.md only asks for spoken replies + a mute/quiet toggle, not voice customization. Default utterance (no explicit `.voice`), default `rate`/`pitch` (`1`). A `mute` toggle is just "don't call `speak()`" — trivial, no API surface needed beyond a boolean in a store (likely `store/theme.ts`-adjacent or a new tiny `store/tts.ts`, matching the existing one-concern-per-store convention).

## Deep Dive 2 — Multi-Dataset Overlay Charting (Recharts)

**Use `ComposedChart` + `ReferenceLine`, not `ReferenceDot` or `Scatter`, for incidents/procedures.** This is the one genuinely non-obvious finding of this research, derived from combining the actual DB schema (`backend/app/models.py`) with Recharts' primitive semantics:

- `Incident` has `datetime_` + free-text `duration` (no structured end time) and `Procedure` has a `date` — both are **point-in-time events with no numeric y-value** on the BP/pulse scale. `ReferenceDot` and `Scatter` both require an (x, y) pair; forcing a y-coordinate onto an incident (what would "hospitalization = 140 mmHg" even mean?) is semantically wrong and was never asked for.
- `ReferenceLine` with `x={timestamp}` (no `y`) draws a **full-height vertical line** — the standard "something happened here" annotation pattern (e.g., stock-chart earnings-call markers). It takes a domain value directly (Recharts maps it through the x-axis scale for you), supports `label` (same `{value, position, fontSize, fill}` shape `BPTimeline.tsx` already uses for its AHA band labels — direct pattern reuse), `stroke`/`strokeDasharray` for visually distinguishing incidents vs. procedures (pair with the existing `lib/palette.ts` categorical-color convention rather than inventing new colors), and `onClick`.
- `ReferenceLine`'s default `ifOverflow: 'discard'` means a marker outside the currently filtered date range **simply doesn't render** — the existing date-filter store already drives this for free, no extra clipping logic needed.
- This overlay only makes sense on the two **continuous time-series charts** (BP Timeline, Pulse Trend) — the two aggregate/categorical charts (BP Categories bar, AM/PM grouped bars) have no time axis to place a point-in-time marker on. Scope the overlay work to those two chart components only.
- **Labs** don't fit this pattern either, for a different reason: lab results have heterogeneous units (mg/dL, mmol/L, etc.) that don't share a y-axis with mmHg/bpm. Do **not** add a secondary `yAxisId` to cram lab values onto the BP chart for v1.1 — PROJECT.md is explicit that v1.1 overlay is "visual only" with no cross-metric correlation math. Treat a lab result the same as an incident/procedure: a `ReferenceLine` marking "a lab was drawn here," with the actual value/unit surfaced in the accessible list, not plotted.

**Accessibility — the load-bearing gap (HIGH confidence, verified against the Recharts 3.0 Accessibility docs via Context7):** Recharts' `accessibilityLayer` (on by default in 3.x, already relied on by this app) gives ArrowLeft/ArrowRight keyboard navigation and a Tooltip **only across the chart's shared `data` array indices for series with a `dataKey`**. `ReferenceLine`/`ReferenceDot` are static SVG annotations outside that data model — they are **not** tab-focusable and **do not** appear in the keyboard-navigated Tooltip payload (confirmed: `TooltipContentProps.payload` only reflects series data, and `ReferenceDotProps`/`ReferenceLine` have no index/tabIndex concept, only mouse handlers). This means the chart-overlay markers alone **cannot** satisfy this project's non-negotiable accessibility bar (keyboard navigable, no precise-pointing-only interactions) on their own.

**Recommendation:** the chart overlay is a *visual enhancement layered on top of* — not a replacement for — an accessible list. This project already has exactly the right existing component for this: `ReadingsTable.tsx`. Extend that pattern (new sections/rows for incidents, procedures, labs, filtered by the same `visibleDatasets` toggle + date range store state) as the authoritative, keyboard/screen-reader-navigable, voice-filterable surface; the `ReferenceLine`s on the chart are decoration that happens to line up with it. This satisfies "one accessible, voice-filterable view" without inventing new accessibility machinery.

**Toggle mechanism:** add `visibleDatasets` (a `Record<DatasetType, boolean>` or a `Set`) to `store/filters.ts`, one boolean per dataset type (bp, pulse, labs, incidents, procedures), each mapped 1:1 to a future voice command — exactly the existing convention that file's own header comment states ("Each action maps 1:1 to a future voice command"). No new store, no new library.

## Deep Dive 3 — Full Site Guide / Instructions Tab

**No new library — third `view` value.** `store/view.ts` already documents *why* this app deliberately doesn't use `react-router`: "a plain state flip, NOT react-router (no URL change, no Vercel rewrite)." Add `"guide"` as a third `View` union member (`"dashboard" | "upload" | "guide"`) exactly like `"upload"` was added. `react-router-dom` is not in `package.json` and should not be introduced for one more full-screen panel swap.

**Accessible expand/collapse — native `<details>`/`<summary>`, not an accordion library.** For "what does this button do" style content, the native HTML disclosure widget gives keyboard support (Enter/Space toggles when focused), correct exposed/collapsed semantics to assistive tech, and zero JavaScript, across all evergreen browsers including Safari. This project has no other complex UI-primitive need (no dialogs, comboboxes, menus) that would justify adding a primitives library like Radix or Headless UI for this one use — `<details>` covers it exactly.

**Guide content — plain TS/TSX data, not markdown/CMS.** The guide describes a small, fixed set of on-screen controls; a hardcoded array of `{ section, question, answer }` objects rendered directly is sufficient. Do not add `react-markdown` or any content-management dependency for this.

**Voice-navigating the guide — do not route it through `/agent`.** This is the most important cross-cutting finding of this research, and it applies to both the guide and the dataset-toggle voice commands in Deep Dive 2:

`useVoiceCommand.ts` currently sends **every** wake-word-gated command straight to `mutateRef.current(...)` → `postAgent` → the backend `/agent` route → Claude. Per this project's own `PROJECT.md`, that pipeline is **currently inert in production** (`$0` API credits, every real call fails). The v1.1 milestone's own goal is explicitly to work "without needing the paid API." Routing brand-new voice features (dataset toggles, guide navigation) through the same broken pipeline would ship them non-functional by voice on day one.

**Recommendation:** add a small **client-side deterministic command matcher** for the new, closed vocabulary ("show labs," "hide incidents," "open the guide," "close the guide," etc.) that runs *before* the network call — a natural extension of the existing `extractCommand()` in `lib/voice.ts`, which already does exactly this kind of pure, regex-based, pre-network parsing for the wake word. A new sibling pure function (e.g. `lib/localCommands.ts`) can pattern-match the stripped command string against the fixed vocabulary and, on a match, mutate the `filters`/`view` stores directly — short-circuiting before `mutateRef.current(...)` is ever called. This makes the new voice features work regardless of Claude's billing state, keeps latency lower for a fixed vocabulary that doesn't need NL flexibility, and costs nothing extra to build (same pattern already proven in this codebase). Text/click always remains the fallback either way.

## Deep Dive 4 — Real Agent-Liveness Detection

**Current state (verified by reading `backend/app/main.py`/`test_health.py`):** `/health` already exists (ungated) but only reports `agent_configured: bool(settings.anthropic_api_key)` — i.e., "is a key present," never "does the key actually work." This is precisely the gap PROJECT.md's v1.1 goal calls out.

**The account's real failure mode, verified against the installed SDK and current official docs:**
- CLAUDE.md/PROJECT.md describe the current $0-credit failure as "every call 400s." **Current official Anthropic docs (fetched live, `platform.claude.com/docs/en/api/errors`) classify billing/payment issues as `402 billing_error`**, distinct from `400 invalid_request_error` and `401 authentication_error`. Older community reports (2025 GitHub issues) describe a `400 invalid_request_error` with a "credit balance is too low" message string — it's plausible the API's classification changed between when this project last tested it and now, or that different failure sub-cases (no payment method vs. depleted balance) map to different codes. **Treat this as MEDIUM confidence and code defensively for both:** primarily branch on the typed `error.type == "billing_error"`, and keep a fallback substring check on `"credit balance"` in the error message for older/edge-case responses.
- The installed `anthropic` SDK (0.117.0, confirmed by reading `anthropic/_exceptions.py` and `anthropic/types/shared/error_type.py` directly) exposes exactly the types needed: `APIStatusError.status_code`, `APIStatusError.type` (a `Literal[..., "billing_error"]`), and a dedicated `BillingError` model in the `ErrorObject` union. **Catch `anthropic.APIStatusError` (parent of `BadRequestError`/`AuthenticationError`/etc.) and branch on `.type`** rather than string-matching or guessing status codes — this is the precise, forward-compatible way to detect the billing failure mode the question asks for.

**Cheap active probe — `client.messages.count_tokens()`, confirmed free (MEDIUM confidence, cross-referenced across Anthropic's token-counting docs and third-party guides, no official page states this in one line but every source agrees):** it counts tokens for a hypothetical request **without generating a completion and without a credit-balance requirement**. This means it validates "is the API key authenticated and is Anthropic reachable" (catches key rotation/revocation → `authentication_error`, network/DNS failures, timeouts) — but **it will NOT catch the credit-balance/billing failure**, because `count_tokens` is explicitly exempt from the billing gate that only applies to `/v1/messages`. Don't rely on it alone as "the" liveness check.

**Recommended design — combine an active probe with passive observation of real traffic, add zero net API cost:**
1. **Active, cached probe:** call `client.messages.count_tokens()` on a short in-memory TTL cache (e.g. 60s — mirror the existing lazy-singleton pattern `_client` already uses in `agent/service.py`), not on every `/health` hit — this avoids adding external-network latency to a liveness endpoint and stays well under the documented rate limit (2000 rpm). Tells you: key valid, network reachable.
2. **Passive circuit breaker on real `/agent` traffic:** `call_claude()` in `agent/service.py` already wraps every real request in a `try/except (APIError, ValidationError)`. Narrow/extend that catch to record the last-observed outcome (a module-level cache, same pattern as `_client`) — specifically capturing when `isinstance(err, APIStatusError) and err.type == "billing_error"`. This costs **zero extra API calls** (it rides on traffic that already happens) and is the only way to observe the credit-balance failure specifically, since it only manifests on the real endpoint.
3. **Compose both into `/health`'s existing response**, extending it with an `agent_status` field (e.g. `"unconfigured" | "ok" | "billing_unavailable" | "auth_error" | "unknown"`) alongside the existing `agent_configured` boolean — additive, doesn't break the existing three tests in `test_health.py`.

**Frontend integration point:** the milestone asks for a **distinct "unavailable" UI state**, not just better logging. That means the `AgentReply`/voice-state contract (`api/types.ts`, `AgentReply.kind` in `agent/schemas.py`, `VoiceState` in `useVoiceCommand.ts`) needs a new outcome distinct from the existing `"unclear"` (which today means "Claude responded but the utterance didn't parse" — a *user*-facing miss) versus a new `"unavailable"` (the service itself couldn't be reached/afforded — an *infrastructure* fact). This is a schema/contract decision for the roadmap/phase, not a new dependency — flagging it here because it's the concrete point where the backend liveness signal (Deep Dive 4) has to surface through the same pipe voice commands already use (Deep Dive 3's local-command work also needs to know this state, so it can decide whether to even attempt a network round trip).

**Rejected approach — Admin API / organization usage endpoints:** Anthropic's Admin API (organization-level cost/usage reporting) requires a *separate* Admin API key (a different secret with broader scope than the per-request API key this app uses). Pulling in a second, more privileged credential just to check "do we have credit" is disproportionate for a single-user personal app — the `count_tokens` + passive-observation combination above answers the same question with the one secret already in `ANTHROPIC_API_KEY`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Native `SpeechSynthesis` + custom hook | `react-speech-kit` (npm) | Never for this project — last published years ago, "not healthy" release cadence per Socket.dev, same category of unmaintained wrapper this project already bypassed for `react-speech-recognition`'s escape hatch. Only reconsider if a future, actively maintained wrapper emerges and the custom hook becomes a maintenance burden. |
| `ComposedChart` + `ReferenceLine` for event markers | `ReferenceDot` / `Scatter` | Only if incidents/procedures ever gain a real numeric y-value worth plotting (e.g., a severity score) — not the case with the current schema. |
| Chart overlay + existing `ReadingsTable`-style accessible list | Relying on Recharts `accessibilityLayer` alone for event markers | Never — confirmed `accessibilityLayer`'s keyboard nav only covers `dataKey` series, not `Reference*` annotations. |
| Client-side local command matcher for new voice features | Routing through `/agent` like existing commands | Once the paid Claude API is reactivated (deferred milestone) *and* NL flexibility for these specific commands is actually wanted — until then, local matching is strictly better (works during the outage, lower latency, zero cost). |
| `count_tokens` active probe + passive `billing_error` capture | A synthetic `messages.create(max_tokens=1)` health-check call | Only if the team is fine with **that check itself spending real tokens once credits exist** — directly conflicts with "without burning tokens." Rejected. |
| `<details>`/`<summary>` for guide sections | Radix UI / Headless UI Accordion | Only if the guide's interaction needs grow beyond simple disclosure (e.g., animated accordions, single-open-at-a-time groups with complex focus management) — not required by PROJECT.md's guide scope. |
| Third `view` store value (`"guide"`) | `react-router-dom` | Only if the app later needs deep-linkable URLs (e.g., sharing a link straight to a specific chart) — explicitly rejected already for `"upload"` for the same CORS/Vercel-rewrite reasons documented in `store/view.ts`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-speech-kit` or any TTS wrapper library | Unmaintained (years since last release); this project already chose the custom-hook path once for the STT half of the same API family | A ~50-80 LOC `useSpeechSynthesis` hook mirroring `useVoiceCommand.ts`'s structure |
| `ReferenceDot`/`Scatter` for incidents & procedures | Both require a y-value; incidents/procedures have none — forcing one is semantically wrong | `ReferenceLine` with `x` only (vertical, full-height marker) |
| A secondary Y-axis to plot lab values against BP/pulse | Different units (mg/dL vs. mmHg); PROJECT.md scopes v1.1 overlay as visual-only, no cross-metric math | Treat labs like incidents — `ReferenceLine` marker + real value shown in the accessible list/table |
| Relying on Recharts `accessibilityLayer` alone to make event markers keyboard-navigable | Confirmed: keyboard nav + Tooltip payload only cover `dataKey` series, not `Reference*` annotations | Pair the chart with an accessible list (extend `ReadingsTable`-style component) |
| `react-router-dom` for the guide tab | This app deliberately has zero routing (see `store/view.ts`'s own rationale: no URL/Vercel-rewrite concerns) | A third `view` value, same pattern as `"upload"` |
| An accordion/disclosure UI library for the guide | Native `<details>`/`<summary>` already gives correct keyboard + screen-reader semantics for free | `<details>`/`<summary>` |
| Routing new v1.1 voice commands (dataset toggles, guide nav) through `/agent` | `/agent` is billing-gated and inert in production right now; v1.1's own goal is to work without the paid API | A client-side deterministic command matcher (extends `extractCommand()`'s existing pattern) |
| A synthetic `messages.create()` call as the liveness probe | Costs real tokens the moment credits exist — the opposite of "cheaply, without burning tokens" | `client.messages.count_tokens()` (confirmed free) + passive observation of real `/agent` traffic |
| String-matching `"credit balance"` in error messages as the *primary* billing-detection mechanism | Fragile, and the installed SDK already exposes a typed `error.type == "billing_error"` | Branch on `APIStatusError.type`; keep the string match only as a defensive fallback |
| A separate Anthropic Admin API key for usage/billing visibility | Disproportionate privilege escalation (a second, broader-scoped secret) for a single-user personal app | `count_tokens` + passive circuit breaker on the existing per-request API key |

## Stack Patterns by Variant

**If real-device Safari/iOS testing (already flagged as this project's #1 device-test risk for STT) also covers TTS:**
- Test the "prime `speechSynthesis` inside the mic-tap gesture" pattern specifically on iOS Safari — this is the one Safari TTS behavior with the highest chance of silently failing if skipped.
- Test the STT/TTS feedback-loop mitigation (pause recognizer while `speechSynthesis.speaking`) on a device playing through speakers, not headphones — that's the scenario most likely to reproduce the self-triggering bug.

**If the `/agent` pipeline is reactivated in a future milestone (paid API credits added):**
- The client-side local command matcher built for v1.1 doesn't need to be removed — it can stay as a fast-path short-circuit ahead of the NL agent for the fixed vocabulary, with `/agent` only handling genuinely free-form phrasing. No rework required, just an optional future optimization.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|------------------|-------|
| `SpeechSynthesis`/`SpeechSynthesisUtterance` (native) | TS `lib.dom.d.ts`, all current TS versions incl. 5.9 | Already fully typed — no `.d.ts` additions needed, unlike `SpeechRecognition` (which required the hand-written `types/speech.d.ts` in this repo because TS's DOM lib omits it) |
| `recharts@3.9.2` `ComposedChart`/`ReferenceLine` | React 19.2.x (existing peerDep, already verified) | No version change; same package already installed |
| `anthropic@0.117.0` `messages.count_tokens` + typed `billing_error` | Python ≥3.9 (existing constraint), already exceeds the 0.116.0 floor in CLAUDE.md | No version change; both features confirmed present by reading the installed package source directly |
| zustand 5.0.14 new store fields | Existing `store/filters.ts`/`store/view.ts` patterns | No version change |

## Sources

- `/recharts/recharts` (Context7, resolved via `ctx7` CLI) — `ComposedChart` combination pattern, `ReferenceLine`/`ReferenceDot` prop shapes, `accessibilityLayer` keyboard-navigation scope, `TooltipContentProps` payload model, 3.0 migration notes — HIGH (official repo source + storybook docs)
- `backend/.venv/lib/python3.12/site-packages/anthropic/_exceptions.py`, `types/shared/error_type.py`, `types/shared/billing_error.py`, `resources/messages/messages.py` (installed package, version 0.117.0, read directly) — `APIStatusError`/`BillingError`/`count_tokens` existence and shape — HIGH (primary source, exact installed version)
- https://platform.claude.com/docs/en/api/errors — current official HTTP error code table (`402 billing_error`, `401 authentication_error`, etc.) — HIGH (official docs, fetched live)
- https://platform.claude.com/docs/en/api/messages/count_tokens and https://platform.claude.com/docs/en/build-with-claude/token-counting (via search cross-reference) — count_tokens is free / no credit-balance requirement — MEDIUM (consistent across multiple independent sources, no single official one-line confirmation found)
- https://platform.claude.com/docs/en/api/models/list — confirms `/v1/models` is a metadata-listing endpoint; did not find a definitive statement on whether it's billing-gated, hence not relied on for the billing-specific check — MEDIUM
- GitHub issues (anthropics/claude-code#54839, continuedev/continue#5499, BerriAI/litellm#24320) — historical `400 invalid_request_error` "credit balance too low" reports predating the current `402 billing_error` docs — MEDIUM, flagged as a possible API-generation discrepancy worth defensive coding
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices and /voiceschanged_event — async voice loading pattern, event support baseline — HIGH (MDN)
- https://weboutloud.io/bulletin/speech_synthesis_in_safari/ — Safari/iOS `getVoices()` gaps, background-tab speech halting — MEDIUM (single blog source, but internally consistent and matches the general "Web Speech API is a draft spec, Safari's implementation is partial" consensus)
- Apple Developer Forums thread ("Text To Speech API Not Working on iOS Safari") + dev.to (nicozerpa) — iOS Safari user-gesture requirement for the first `speak()` call — MEDIUM (community reports, cross-checked across two independent sources, consistent with the same-family `SpeechRecognition` gesture requirement this project already codes around)
- Chromium issue tracker #41346274 + StackOverflow-linked gist (woollsta) — Chrome's ~15s long-utterance pause bug and the `resume()`-polling / chunking workarounds — MEDIUM (widely cited community-documented Chrome bug, not an official Chrome bug-fix confirmation, but consistent across many years of reports)
- npm/Socket.dev search results for `react-speech-kit` — maintenance status (stale, unhealthy cadence) — MEDIUM
- Direct repo inspection: `frontend/src/lib/voice.ts`, `hooks/useVoiceCommand.ts`, `store/view.ts`, `store/filters.ts`, `components/charts/BPTimeline.tsx`, `components/ChartDeck.tsx`, `backend/app/main.py`, `backend/app/agent/service.py`, `backend/app/models.py`, `backend/tests/test_health.py`, `frontend/package.json` — existing architecture, conventions, and exact current behavior this milestone must integrate with — HIGH (primary source, this codebase)

---
*Stack research for: Health Visualizer v1.1 (Polish & Records) — spoken replies, multi-dataset overlay, site guide, agent liveness*
*Researched: 2026-08-19*
