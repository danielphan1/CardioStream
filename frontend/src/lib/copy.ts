// Fixed, single-sourced UI copy constants (06-UI-SPEC.md's Copywriting
// Contract: "define it once as a constant... never inline, never
// duplicated").
//
// Fixed friendly copy for every client-visible failure of a single command's
// round-trip (VOICE-07), shared by CommandBar.tsx and useVoiceCommand.ts.
// error.message (which may leak status/stack) and raw recognizer errors are
// NEVER rendered — only these strings are.
export const RATE_LIMIT_COPY =
  "One moment — a lot of commands at once. Try again in a few seconds.";
export const OFFLINE_COPY =
  "Couldn't reach the assistant — use the filters and buttons below instead.";

// AGENT_UNAVAILABLE_BANNER_COPY is the THIRD independently-worded "can't
// reach the assistant" string in this codebase, alongside OFFLINE_COPY above
// (a single command's fetch failure) and the backend's UNAVAILABLE_MESSAGE
// (surfaced via AgentReply.message when the agent declines). All three exist
// for different failure moments and must never be paraphrased or merged with
// one another — see 06-UI-SPEC.md's "Precedent for a third,
// independently-authored string" note.
export const AGENT_UNAVAILABLE_BANNER_COPY =
  "Voice and text commands aren't working right now. Filters, charts, and uploads below still work by tap.";
