// Clinical category palette — the SINGLE source of truth for category colors
// and ordering (D-14, UI-SPEC "never three separate color lists"). Chips,
// bars, and timeline bands all import from here so they can never drift.
//
// NO hex values in this file — every color is a CSS var defined in
// index.css for both themes; light/dark flips via the `.dark` class (D-15).
import type { BPCategory, PulseCategory } from "../api/types";

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

// Selected-chip fill tints, mirroring CATEGORY_VARS exactly. The tint values
// themselves are precomputed per theme in index.css (16.1-UI-SPEC section
// 4.4: 12% of the category hue over --color-deck). These accessors exist so
// that no component ever has to carry one of those literals.
const CATEGORY_TINT_VARS: Record<BPCategory, string> = {
  Hypotension: "var(--cat-hypotension-tint)",
  Normal: "var(--cat-normal-tint)",
  Elevated: "var(--cat-elevated-tint)",
  "Stage 1": "var(--cat-stage1-tint)",
  "Stage 2": "var(--cat-stage2-tint)",
  "Hypertensive Crisis": "var(--cat-crisis-tint)",
};

/** CSS var string for a category's selected-chip tint fill. */
export function categoryTint(cat: BPCategory): string {
  return CATEGORY_TINT_VARS[cat];
}

/** Text color on category-colored chips (contrast pair in index.css). */
export const CHIP_TEXT = "var(--cat-chip-text)";

/** Three canonical Pulse Category labels in clinical order. */
export const PULSE_CLINICAL_ORDER: PulseCategory[] = [
  "Bradycardia",
  "Normal",
  "Tachycardia",
];

const PULSE_CATEGORY_VARS: Record<PulseCategory, string> = {
  Bradycardia: "var(--ref-bradycardia)",
  Normal: "var(--cat-normal)",
  Tachycardia: "var(--cat-elevated)",
};

/** CSS var string for a Pulse Category — reuses existing CSS vars, no new ones. */
export function pulseCategoryColor(cat: PulseCategory): string {
  return PULSE_CATEGORY_VARS[cat];
}

// Same token reuse as PULSE_CATEGORY_VARS above: pulse has no tints of its
// own, it borrows the bradycardia reference and two category tints.
const PULSE_CATEGORY_TINT_VARS: Record<PulseCategory, string> = {
  Bradycardia: "var(--ref-bradycardia-tint)",
  Normal: "var(--cat-normal-tint)",
  Tachycardia: "var(--cat-elevated-tint)",
};

/** CSS var string for a Pulse Category's selected-chip tint fill. */
export function pulseCategoryTint(cat: PulseCategory): string {
  return PULSE_CATEGORY_TINT_VARS[cat];
}
