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

export type PulseCategory = "Bradycardia" | "Normal" | "Tachycardia";

export type TimeOfDayBucket = "Morning" | "Afternoon" | "Evening" | "Night";

export type Reading = {
  id: number;
  datetime: string; // naive local ISO, no Z/offset (DATA-05)
  systolic: number;
  diastolic: number;
  pulse: number;
  am_pm: "AM" | "PM";
  bp_category: BPCategory;
  pulse_category: PulseCategory;
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

// ── Upload wire contract (API-03 / DASH-10) — byte-identical mirror of the
// LOCKED backend etl.py IngestSummary / RejectedRow (Phase 1 D-06 lock; the
// backend returns this shape verbatim from POST /upload). Counts, reasons, and
// dates only — never a blood-pressure value (T-1-04). `reason` is field+problem
// only (value-free), safe to render. `latest` is the DB's newest reading after
// the merge as naive-local ISO (DATA-05), or null when the DB is empty.
export type RejectedRow = {
  row_index: number;
  reason: string;
};

export type IngestSummary = {
  added: number;
  updated: number;
  unchanged: number;
  rejected: RejectedRow[];
  total: number;
  latest: string | null;
};

// ── Records wire contract (OVERLAY-02) — byte-identical mirror of backend
// plan 07-01 schemas.py LabResultOut/LabResultCreate, IncidentOut/
// IncidentCreate, ProcedureOut/ProcedureCreate (backend/app/schemas.py).
export type LabResult = {
  id: number;
  date: string;
  test_name: string;
  result: number | null;
  unit: string | null;
  range_low: number | null;
  range_high: number | null;
  notes: string | null;
};

export type LabResultCreate = {
  date: string;
  test_name: string;
  result?: number | null;
  unit?: string | null;
  range_low?: number | null;
  range_high?: number | null;
  notes?: string | null;
};

export type Incident = {
  id: number;
  datetime: string; // naive local ISO, no Z/offset (DATA-05)
  incident_type: string;
  duration: string | null;
  notes: string | null;
};

export type IncidentCreate = {
  datetime: string;
  incident_type: string;
  duration?: string | null;
  notes?: string | null;
};

export type Procedure = {
  id: number;
  date: string;
  procedure_name: string;
  location: string | null;
  outcome: string | null;
  notes: string | null;
};

export type ProcedureCreate = {
  date: string;
  procedure_name: string;
  location?: string | null;
  outcome?: string | null;
  notes?: string | null;
};

// Agent command vocabulary. Phase 14 split the old four-member `ChartId` in
// two: the two vitals stopped being *charts* and became independently
// toggleable *datasets* on one shared timeline, leaving only the three genuine
// views. `bp_timeline` and `pulse_trend` no longer exist anywhere.
export type ChartView = "timeline" | "bp_categories" | "am_pm_comparison";

// Resolved query params for /readings and /stats/summary
export type ResolvedFilters = {
  start_date?: string; // "YYYY-MM-DD"
  end_date?: string; // "YYYY-MM-DD" (inclusive — backend handles exclusivity)
  bp_category?: BPCategory[];
  pulse_category?: PulseCategory[];
  time_of_day?: TimeOfDayBucket[];
};

// ── Agent wire contract (API-04/VOICE-08) — byte-identical mirror of backend
// plan 03-01 schemas.py JSON form. The server does ALL token translation;
// nothing here translates canonical labels (PATTERNS "Canonical labels vs.
// wire tokens"). Voice (Phase 4) reuses these types unchanged.

// Follow-up round-trip when the agent asks a clarifying question (API-04).
export type ClarifyContext = { original_text: string; question: string };

// POST /agent body — text plus optional clarification context (VOICE-08).
export type AgentRequest = { text: string; context: ClarifyContext | null };

// The single declaration site for the overlay dataset union (OVERLAY-03/04).
// Deliberately still just the three EVENT types: the event hooks, overlayMeta,
// overlayEvents, and OverlayEventsList all key off events specifically, and
// widening this union would let a vitals token leak into code that can only
// render date markers.
export type OverlayDataset = "labs" | "incidents" | "procedures";

// Everything the Show panel can toggle (Phase 14, D-01/D-02) — the three event
// types above plus the two vitals. `blood_pressure` covers systolic AND
// diastolic as one unit: Chris says "blood pressures" as a single thing, it is
// how BP is read clinically, and it keeps the spoken vocabulary at five tokens
// instead of adding "systolic"/"diastolic" for speech recognition to garble.
export type SeriesDataset =
  | "blood_pressure"
  | "pulse"
  | "labs"
  | "incidents"
  | "procedures";

// Server-composed filter delta — only these closed-union fields mutate the
// store (T-03-07). Wire key is `from` (backend serializes `from_` alias "from").
export type AppliedFilters = {
  chartView?: ChartView | null;
  datePreset?: "7d" | "30d" | "90d" | "all" | null;
  customRange?: { from: string; to: string } | null;
  bpCategory?: BPCategory[] | null;
  pulseCategory?: PulseCategory[] | null;
  timeOfDay?: TimeOfDayBucket[] | null;
  // Additive single-dataset toggle ("show my pulse") — leaves every other
  // dataset untouched.
  overlayDataset?: SeriesDataset | null;
  overlayState?: "on" | "off" | null;
  // Additive multi-dataset set — turn these on, leave the rest. Carries the
  // dataset half of a combined utterance ("show me my blood pressure for the
  // last 30 days, mornings only"), which the single-valued toggle above
  // cannot express alongside filters.
  datasetsOn?: SeriesDataset[] | null;
  // Exclusive multi-dataset set ("only blood pressure and pulse") — everything
  // named goes on, everything else goes off. Added in Phase 14 because the
  // single-valued toggle above literally cannot express the client's own
  // example sentence.
  showOnly?: SeriesDataset[] | null;
  speechEnabled?: "on" | "off" | null;
  guideOpen?: "open" | "closed" | null;
  reset?: boolean;
};

// Agent reply envelope (API-04) — five-kind discriminated union. "unavailable"
// (Phase 6, LIVE-01) is the byte-for-byte mirror of backend Plan 06-01's
// AgentReply.kind extension — the agent/breaker is unreachable, distinct from
// "unclear" (the agent responded but the command wasn't understood).
export type AgentReply = {
  kind: "applied" | "clarify" | "refuse" | "unclear" | "unavailable";
  filters: AppliedFilters | null;
  message: string;
  context: ClarifyContext | null;
};

// GET /health response (Phase 6, LIVE-03/LIVE-04; Phase 19, D-08) — byte-for-byte
// mirror of backend Plan 06-01's extended `/health` handler in main.py, plus
// Plan 19-01's `demo` extension. agent_reachable is a plain tri-state: `null` =
// untested this boot (passive-only breaker has no active probe), `true`/`false`
// = the real outcome of the most recent `/agent` call. Never a reason string
// (Pitfall 3 — /health is unauthenticated). `demo` mirrors
// `bool(site_username)` — never a secret, just the guest-deployment flag.
export type HealthStatus = {
  status: string;
  agent_configured: boolean;
  agent_reachable: boolean | null;
  demo: boolean;
};
