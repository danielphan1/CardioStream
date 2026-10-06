// The chart-view vocabulary — the three views' ORDER and their labels.
//
// WHY THIS IS ITS OWN MODULE (quick 261005-mj2). Both ChartViewSwitcher (which
// renders the three buttons) and ChartDeck (which needs to know which WAY a
// view swap travelled, so the outgoing chart can drift out toward the side it
// came from) depend on this order. It used to live in ChartViewSwitcher.tsx,
// but exporting a non-component constant from a component file breaks React
// fast refresh — oxlint's react(only-export-components) says so and prescribes
// exactly this remedy. No React imports here, same as showSentence.ts and
// datasetMeta.ts.
//
// VIEW_ORDER IS THE SINGLE SOURCE OF ON-SCREEN ORDER. ChartViewSwitcher maps
// over it to render, and ChartDeck reads indices out of it to derive a swap
// direction, so the two can never disagree about which view sits left of
// which. Re-typing either list at a call site would let a swap animate the
// wrong way round with nothing to catch it.
import type { ChartView } from "../api/types";

/** Left to right, as rendered. Reordering this reorders the buttons AND the
 *  direction a swap travels — they are the same fact. */
export const VIEW_ORDER: ChartView[] = [
  "timeline",
  "bp_categories",
  "am_pm_comparison",
];

/** The button copy, declared exactly once. `Record<ChartView, string>` is
 *  exhaustive by type, so a fourth view cannot be added without a label.
 *  Do not reword these: they are the visible labels AND the words a caregiver
 *  says out loud, so the agent's vocabulary tracks them. */
export const VIEW_LABEL: Record<ChartView, string> = {
  timeline: "Timeline",
  bp_categories: "BP Categories",
  am_pm_comparison: "AM vs PM",
};
