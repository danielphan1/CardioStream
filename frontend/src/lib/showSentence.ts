// Live selection sentence for the Show panel (D-20 pattern, Phase 14).
//
// NO React imports — same governing constraint as overlayEvents.ts/chartData.ts
// so this stays unit-testable without jsdom. The sentence is read aloud by
// screen readers via aria-live, so wording and ordering are locked by
// 14-UI-SPEC.md §2 and must not drift.
import type { SeriesDataset } from "../api/types";
import { DATASET_META, DATASET_ORDER, hasVitals } from "./datasetMeta";

/** "a" / "a and b" / "a, b and c" — NO Oxford comma, because this string is
 * spoken aloud. Do NOT "fix" it to Intl.ListFormat's conjunction form: that
 * adds the comma. lib/agent.ts's spoken confirmation imports this same one.
 * (Deliberate asymmetry with overlayEvents.ts's joinWithOr, which IS written
 * text and therefore DOES take the Oxford comma.) */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Composes the panel's live-state sentence from the current selection.
 * Always ordered by DATASET_ORDER, never by the order the user ticked boxes,
 * so the same selection always reads the same way.
 */
export function buildShowSentence(
  visible: Record<SeriesDataset, boolean>,
): string {
  const on = DATASET_ORDER.filter((d) => visible[d]);

  if (on.length === 0) return "Nothing selected — pick a dataset to see it.";

  const names = on.map((d) => DATASET_META[d].label.toLowerCase());
  const list = joinWithAnd(names);

  // No vitals means the chart has nothing to plot, so the timeline slot shows
  // a dated list instead (D-05). Say so, rather than letting the sentence
  // imply a chart that isn't there.
  if (!hasVitals(visible)) {
    return `Showing ${list} — no vitals selected, so these are listed by date.`;
  }

  return `Showing ${list}.`;
}
