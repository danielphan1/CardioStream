// TS mirrors of backend/app/schemas.py JSON payloads (plan 02-01 interface
// contract). JSON keys are the clean names `datetime` and `map` — the backend
// bridges its ORM attribute names with Pydantic aliases (Shared Pattern 6).
// Category labels are verbatim WITH spaces (Shared Pattern 2, source of truth
// backend/app/derivations.py) — never snake_case them; URL-encode in params.

export type BPCategory =
  | "Hypotension"
  | "Normal"
  | "Elevated"
  | "Stage 1"
  | "Stage 2"
  | "Hypertensive Crisis";

export type Reading = {
  id: number;
  datetime: string; // naive local ISO, no Z/offset (DATA-05)
  systolic: number;
  diastolic: number;
  pulse: number;
  am_pm: "AM" | "PM";
  bp_category: BPCategory;
  pulse_category: string;
  map: number;
  pulse_pressure: number;
  notes: string | null;
};

export type VitalStats = {
  avg: number;
  min: number;
  max: number;
};

export type CategoryStat = {
  category: BPCategory;
  count: number;
  percent: number;
};

export type StatsSummary = {
  count: number;
  systolic: VitalStats | null;
  diastolic: VitalStats | null;
  pulse: VitalStats | null;
  categories: CategoryStat[]; // always all six labels, clinical order, zero-filled
  latest_reading: string | null; // UNFILTERED newest reading (D-11 / preset anchor)
};

// Future agent command vocabulary (RESEARCH Code Example 3)
export type ChartId =
  | "bp_timeline"
  | "pulse_trend"
  | "bp_categories"
  | "am_pm_comparison";

// Resolved query params for /readings and /stats/summary
export type ResolvedFilters = {
  start_date?: string; // "YYYY-MM-DD"
  end_date?: string; // "YYYY-MM-DD" (inclusive — backend handles exclusivity)
  am_pm?: "AM" | "PM";
  bp_category?: BPCategory;
};
