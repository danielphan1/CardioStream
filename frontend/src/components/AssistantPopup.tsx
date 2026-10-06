// AssistantPopup (quick 261002-kem) — the voice/text assistant as a dismissible
// floating widget instead of a pinned band at the top of every data surface.
// A persistent pill trigger sits bottom-right; the Command Bar and the agent
// status banner live in a card anchored above it with its own Close control.
//
// THE CARD IS HIDDEN, NEVER UNMOUNTED, and that is a safety property rather
// than an optimisation: <CommandBar> owns the live SpeechRecognition session
// (useVoiceCommand), which dies with the component. The primary user is a C4
// quadriplegic with no reliable pointer — if dismissing the panel ended the
// session, voice (the project's primary input method) would stay dead until a
// caregiver tapped the trigger. So `hidden` takes the card out of the
// accessibility tree and the tab order while the recognizer keeps listening,
// and CommandBar re-opens this panel by itself on a wake-word hit.
//
// A DISCLOSURE, NOT A MODAL: role="group" + aria-label, no aria-modal, no
// backdrop and no focus trap — see useDismissable.ts's header for why a trap
// here would lock a keyboard or switch-access user out of the mic. The trigger
// is FIRST in the DOM and the column is reversed, so Tab runs trigger -> panel
// while the panel still renders visually above the trigger.
//
// z-[60] matches the z-layer the Command Bar band used to hold: the assistant
// must stay reachable while the guide, the nav panel or a filter panel covers
// the content (those sit on z-40/z-50).
//
// Every colour is an index.css var() token; the card reuses the non-inverting
// --color-panel / --color-panel-text pair plus data-surface="panel" so
// CommandBar's own panel-scoped tokens (its focus ring included) still resolve.
import { Mic, X } from "lucide-react";
import { useCallback } from "react";

import { AgentStatusBanner } from "./AgentStatusBanner";
import { CommandBar } from "./CommandBar";
import { useDismissable } from "../hooks/useDismissable";
import { useAssistant } from "../store/assistant";

export function AssistantPopup({
  latestReading,
}: {
  /** The unfiltered newest-reading anchor, threaded straight through to
   *  CommandBar exactly as the old band did. */
  latestReading: string | null;
}) {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const toggleOpen = useAssistant((s) => s.toggleOpen);

  // Stable across renders — useDismissable's Escape effect lists it as a dep.
  const close = useCallback(() => setOpen(false), [setOpen]);

  const { mounted, shown, closeButtonRef } = useDismissable({
    open,
    onClose: close,
    triggerId: "assistant-toggle-button",
  });

  return (
    // flex-col-reverse: the trigger is first in the DOM (so the keyboard path
    // reaches it before the panel it controls) but paints at the bottom.
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse items-end gap-2">
      {/* Icon AND text, never icon-only: the Command Bar's own mic button is
          the app's one documented icon-only control. The label stays
          "Assistant" in both states — the card's Close control owns the dismiss
          verb (Copywriting Contract) — and aria-expanded carries the state.
          The id is useDismissable's focus-restoration target on close. */}
      <button
        id="assistant-toggle-button"
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="assistant-panel"
        className="press-swell flex min-h-14 items-center gap-2 rounded-full border border-[var(--color-hairline)] bg-[var(--color-panel)] px-5 text-label text-[var(--color-panel-text)] shadow-[var(--shadow-elevation)]"
      >
        <Mic aria-hidden="true" className="h-6 w-6 shrink-0" />
        Assistant
      </button>

      {/* No display utility on this element: `hidden` must win, and a Tailwind
          `flex`/`grid` class here would override the attribute's display:none.
          max-h + overflow-y keeps a long transcript on screen (the
          No-Off-Screen Rule bans the horizontal kind of scrolling only). */}
      <div
        id="assistant-panel"
        role="group"
        aria-label="Assistant"
        hidden={!mounted}
        data-surface="panel"
        className={`w-[min(92vw,480px)] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-panel)] px-4 pb-4 shadow-[var(--shadow-elevation)] transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Sticky header so Close stays reachable once the transcript grows
            past max-h. */}
        <div className="sticky top-0 flex flex-wrap items-center justify-between gap-2 bg-[var(--color-panel)] py-2">
          <h2 className="text-label leading-tight text-[var(--color-panel-text)]">
            Assistant
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="press-swell flex min-h-12 items-center gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-deck)] px-4 text-label text-[var(--color-depth)]"
          >
            <X aria-hidden="true" className="h-6 w-6 shrink-0" />
            Close
          </button>
        </div>
        <CommandBar latestReading={latestReading} />
        <AgentStatusBanner />
      </div>
    </div>
  );
}
