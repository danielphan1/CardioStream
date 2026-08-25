# Phase 11: Full Site Guide / Instructions Tab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 11-full-site-guide-instructions-tab
**Areas discussed:** Guide overlay mechanism, Voice open/close for the guide, Voice-command reference source, Content structure & depth

---

## Guide overlay mechanism

**Q1: What should the guide look like when open?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen overlay | Covers the viewport, dashboard stays mounted underneath (unlike useView). Best fit for content this long — more room to scroll/read than a modal, simpler to make voice/keyboard navigable than a cramped drawer. | ✓ |
| Centered modal (mirrors LogoutConfirmDialog exactly) | Reuses the existing modal pattern verbatim, but LogoutConfirmDialog's box is sized for a couple sentences, not a full guide. | |
| Slide-in side drawer | Common pattern but no existing precedent in this codebase. | |

**User's choice:** Full-screen overlay

**Q2: How is the guide opened by click, and how is it closed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Header button open, X + Escape to close | A new Header-right button opens it; closing is X button + Escape key. | ✓ |
| Header button open, only X to close | Same open mechanism, click/tap-only close. | |
| Something else | Freeform. | |

**User's choice:** Header button open, X + Escape to close

**Q3: While the guide overlay is open, should the CommandBar/mic status stay visible, or fully hidden?**

| Option | Description | Selected |
|--------|-------------|----------|
| Stay visible, pinned at top or bottom | Chris can always see mic state and issue a voice command while reading. | ✓ |
| Fully hidden, recognizer stays alive unseen | Simpler layout, but no visual mic feedback while reading. | |

**User's choice:** Stay visible, pinned at top or bottom

**Q4: Where should the pinned CommandBar sit within the guide overlay?**

| Option | Description | Selected |
|--------|-------------|----------|
| Top, same as the dashboard | Matches CommandBar's existing top-anchored position. | ✓ |
| Bottom of the overlay | Different position than the dashboard. | |

**User's choice:** Top, same as the dashboard

---

## Voice open/close for the guide

**Q1: Should opening/closing by voice go through a new Claude agent action, or a local client-side shortcut?**

| Option | Description | Selected |
|--------|-------------|----------|
| New agent action, mirrors toggle_dataset/toggle_speech | Consistent with every other voice command; same known production-inert limitation as everything else (accepted, tracked). | ✓ |
| Local client-side shortcut (first of its kind) | Would work even with the agent inert, but breaks the established "no client-side keyword bypass" invariant. | |

**User's choice:** New agent action, mirrors toggle_dataset/toggle_speech

**Q2: Does the new voice action stop at open/close only, or also jump to a specific section?**

| Option | Description | Selected |
|--------|-------------|----------|
| Open/close only | Explicit on/off, mirrors toggle_dataset/toggle_speech exactly. Avoids re-building GUIDE-05 (deferred to v2) early. | ✓ |
| Open/close + jump to a section | Richer vocabulary but expands scope closer to GUIDE-05's deferred territory. | |

**User's choice:** Open/close only

**Q3: If Chris says a different command while the guide is open, what should happen?**

| Option | Description | Selected |
|--------|-------------|----------|
| Command applies AND closes the guide | Dashboard command runs normally and the guide auto-closes so Chris sees the result immediately. | ✓ |
| Command applies, guide stays open | Dashboard updates underneath while the guide stays on screen. | |
| Guide open state ignores/blocks other commands | Only guide open/close commands honored while open. | |

**User's choice:** Command applies AND closes the guide

---

## Voice-command reference source

**Q1: How should the guide's full reference list relate to CommandBar's EXAMPLES array?**

| Option | Description | Selected |
|--------|-------------|----------|
| Expand EXAMPLES into one shared, comprehensive list | Extract into a new exported module both CommandBar and the guide import from — exactly what GUIDE-02 asks for. | ✓ |
| Keep EXAMPLES as-is, add a separate comprehensive list | Two lists to keep in sync by hand — the "second, divergent list" GUIDE-02 warns against. | |

**User's choice:** Expand EXAMPLES into one shared, comprehensive list

**Q2: How should the comprehensive voice-command list be organized?**

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by category | Matches how a real reference doc reads, maps onto GUIDE-01's "every control, filter, chart" wording. | ✓ |
| Flat list, no grouping | Simpler data structure, harder to scan. | |

**User's choice:** Grouped by category

**Q3: For each command category, how many example phrases should the guide show?**

| Option | Description | Selected |
|--------|-------------|----------|
| One canonical example per category | Matches the existing project philosophy — no fixed keyword list to lock — paired with a "similar phrasings work too" note. | ✓ |
| 2-3 synonym examples per category | More reassuring but more content to write and keep accurate. | |

**User's choice:** One canonical example per category

---

## Content structure & depth

**Q1: How should the guide's content be organized on the page?**

| Option | Description | Selected |
|--------|-------------|----------|
| One scrollable page with a jump-to-section nav | Fewer interactive states, easy keyboard/voice navigation, nothing hidden behind an extra click. | ✓ |
| Accordion (expand/collapse sections) | Shorter initial page but adds extra interactive elements and an extra tap before content is visible. | |
| Tabbed sections | Only one section visible at a time, more complex keyboard nav pattern. | |

**User's choice:** One scrollable page with a jump-to-section nav

**Q2: Should the guide include illustrative visuals (screenshots/diagrams) alongside text, or stay text-only?**

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only | Lowest maintenance burden (no screenshot pipeline to keep in sync, especially with Phase 12's visual refresh next), matches accessibility-first design. | ✓ |
| Text + screenshots | More visually helpful but real maintenance cost every future visual change. | |

**User's choice:** Text-only

**Q3: Should every section follow the same fixed format, or read as freeform prose tailored to each topic?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed format per section | What it does → click → voice (when applicable). Predictable and scannable. | ✓ |
| Freeform prose per topic | Reads more naturally but less predictable/scannable, inconsistent across topics with/without voice equivalents. | |

**User's choice:** Fixed format per section

---

## Claude's Discretion

- Exact section copy/wording for each guide topic.
- Exact icon choice for the new Header guide-open button and exact table-of-contents visual styling.
- Exact shape/naming of the new agent action's schema field (e.g. a dedicated `GuideVisibility` action vs. folding into an existing field).
- Whether the guide overlay is reachable from every `view` (`dashboard`/`upload`/`records`) or only from `dashboard`, given the live mic session only exists on the dashboard view today.

## Deferred Ideas

- Voice-triggered contextual help reachable mid-task without opening the guide tab (GUIDE-05, already v2-deferred in REQUIREMENTS.md).
- Staged/contextual onboarding hints beyond the static guide (GUIDE-06, already v2-deferred in REQUIREMENTS.md).
- Section-jump/deep-link voice commands within the guide — considered and explicitly deferred (reads too close to GUIDE-05's territory).
