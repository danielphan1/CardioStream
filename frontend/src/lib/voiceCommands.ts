// Shared voice-command reference (D-08) — the SINGLE source both
// CommandBar's placeholder rotation and GuideOverlay's "What Can I Say"
// section (Plan 11-04) import from. Fixed category order per
// 11-UI-SPEC.md's Copywriting Contract ("Voice-command category headings",
// D-09); one canonical example phrase per category plus the fixed
// "similar phrasings" note (D-10). EXAMPLES is DERIVED from
// VOICE_COMMAND_CATEGORIES, never independently authored, so the two
// surfaces can never drift again.
export type VoiceCommandCategory = {
  id: string;
  label: string;
  example: string;
};

export const VOICE_COMMAND_CATEGORIES: VoiceCommandCategory[] = [
  { id: "charts", label: "Switching charts", example: "show my pulse" },
  { id: "date-range", label: "Filtering by date", example: "last 30 days" },
  {
    id: "am-pm",
    label: "Filtering by AM or PM",
    example: "mornings only",
  },
  {
    id: "bp-category",
    label: "Filtering by blood pressure category",
    example: "show stage 2 readings",
  },
  {
    id: "overlay",
    label: "Showing labs, incidents, and procedures",
    example: "show incidents",
  },
  { id: "reset", label: "Starting over", example: "show all data" },
  {
    id: "speech",
    label: "Voice replies",
    example: "mute the voice replies",
  },
  { id: "guide", label: "Opening this guide", example: "open the guide" },
];

export const SIMILAR_PHRASINGS_NOTE =
  "Similar phrasings work too — you don't need the exact words.";

// Flat placeholder-rotation list for CommandBar (D-02) — derived from the
// categorized source above so there is exactly one authored copy.
export const EXAMPLES = VOICE_COMMAND_CATEGORIES.map((c) => c.example);
