# Phase 16: Trend Clarity and Chart Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 16-trend-clarity-and-chart-polish
**Areas discussed:** Rolling average window, Which series get a trend line, Trend line visual treatment, Readability pass priorities

---

## Rolling average window

**Q1 — Window basis:**

| Option | Description | Selected |
|--------|-------------|----------|
| Count-based: last N readings | Average of the last N readings regardless of how many days they span — smooth, evenly-weighted, easiest to test | ✓ |
| Calendar-based: last 7 days | True "7-day average" but inconsistent smoothness given sparse/clustered readings | |
| You decide | Let researcher/planner pick based on real data distribution | |

**User's choice:** Count-based: last N readings

**Q2 — Window size:**

| Option | Description | Selected |
|--------|-------------|----------|
| 7 | Matches ROADMAP's "7-day or similar" suggestion | ✓ |
| 5 | Tighter window, reacts faster, less smoothing | |
| 10 | Wider window, smoother, slower to reflect recent changes | |

**User's choice:** 7

**Q3 — Minimum readings before drawing:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — wait for a full window | Trend line starts only once 7 readings exist | ✓ |
| No — average whatever exists so far | Trend line covers the full chart, partial-window at the start | |

**User's choice:** Yes — wait for a full window

**Notes:** Directly resolves the ROADMAP's own flagged concern about handling gaps in the series (readings are not daily).

---

## Which series get a trend line

| Option | Description | Selected |
|--------|-------------|----------|
| Blood pressure only | Matches Chris's "am I getting better or worse" framing; less clutter | |
| BP + Pulse | Consistent treatment across all series; pulse direction matters given ~88% bradycardia prevalence | ✓ |
| You decide | Let researcher/planner judge based on visual clutter | |

**User's choice:** BP + Pulse

**Notes:** None additional.

---

## Trend line visual treatment

**Q1 — Line style:**

| Option | Description | Selected |
|--------|-------------|----------|
| Thicker/more opaque trend line; dim/shrink raw dots | Trend line becomes visual foreground, raw data stays inspectable via tooltip | ✓ |
| Raw lines unchanged; trend line as a distinct dashed overlay | More lines on screen, nothing existing changes | |
| Toggle: raw view vs. trend view | Cleanest per-view but adds a new control surface beyond polish-only scope | |

**User's choice:** Thicker/more opaque trend line; dim/shrink raw dots (via interrupt: "Go with first option" — user declined the full multi-question AskUserQuestion turn and directed both remaining questions in that batch to their first/recommended option)

**Q2 — Trend color:**

| Option | Description | Selected |
|--------|-------------|----------|
| Same color per series | Trend-systolic and raw-systolic share --line-systolic, distinguished by weight/opacity | ✓ |
| New dedicated trend color(s) | Separate token for all trend lines, needs new contrast verification | |

**User's choice:** Same color per series (via the same interrupt)

**Notes:** User interrupted the AskUserQuestion tool call and said "Go with first option" — both questions in that batch resolved to their recommended/first option without a further round-trip.

---

## Readability pass priorities

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | No specific pain point named yet; let researcher/planner judge from real rendered charts | ✓ |
| Quick discussion | User has specific complaints in mind | |

**User's choice:** You decide

**Notes:** Deferred to Claude's discretion — see CONTEXT.md D-06.

---

## Claude's Discretion

- Exact readability improvements (density/labelling/colour/axis) on `CombinedTimeline`, `CategoryBars`, `AmPmComparison` — no specific pain point named this round.
- Exact opacity/stroke-width values for dimmed raw points vs. bold trend line — cosmetic detail for `/gsd-ui-phase 16`.
- Whether the trend line gets its own end-label pill or a different line-end treatment.

## Deferred Ideas

None — discussion stayed within phase scope.
