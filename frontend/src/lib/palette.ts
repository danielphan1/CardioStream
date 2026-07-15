// Clinical category palette — the SINGLE source of truth for category colors
// and ordering (D-14, UI-SPEC "never three separate color lists"). Chips,
// bars, and timeline bands all import from here so they can never drift.
//
// NO hex values in this file — every color is a CSS var defined in
// index.css for both themes; light/dark flips via the `.dark` class (D-15).
import type { BPCategory } from "../api/types";

/** Six canonical labels in clinical order — matches backend CLINICAL_ORDER. */
export const CLINICAL_ORDER: BPCategory[] = [
  "Hypotension",
  "Normal",
  "Elevated",
  "Stage 1",
  "Stage 2",
  "Hypertensive Crisis",
];

const CATEGORY_VARS: Record<BPCategory, string> = {
  Hypotension: "var(--cat-hypotension)",
  Normal: "var(--cat-normal)",
  Elevated: "var(--cat-elevated)",
  "Stage 1": "var(--cat-stage1)",
  "Stage 2": "var(--cat-stage2)",
  "Hypertensive Crisis": "var(--cat-crisis)",
};

/** CSS var string for a category — theme-aware via index.css tokens. */
export function categoryColor(cat: BPCategory): string {
  return CATEGORY_VARS[cat];
}

/** Text color on category-colored chips (contrast pair in index.css). */
export const CHIP_TEXT = "var(--cat-chip-text)";
