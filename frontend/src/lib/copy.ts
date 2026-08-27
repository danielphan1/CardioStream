// Fixed, single-sourced UI copy constants (06-UI-SPEC.md's Copywriting
// Contract: "define it once as a constant... never inline, never
// duplicated"). This file currently holds exactly one string.
//
// AGENT_UNAVAILABLE_BANNER_COPY is the THIRD independently-worded "can't
// reach the assistant" string in this codebase, alongside CommandBar.tsx's
// OFFLINE_COPY (a single command's fetch failure) and the backend's
// UNAVAILABLE_MESSAGE (surfaced via AgentReply.message when the agent
// declines). All three exist for different failure moments and must never be
// paraphrased or merged with one another — see 06-UI-SPEC.md's "Precedent
// for a third, independently-authored string" note.
export const AGENT_UNAVAILABLE_BANNER_COPY =
  "Voice and text commands aren't working right now. Filters, charts, and uploads below still work by tap.";
