// NavPanel (16.1-05, UI-SPEC §5.2) — the <1024px overlay the slim bar's menu
// trigger opens. Implemented as a full-width panel at GuideOverlay's EXACT
// geometry rather than a 240px sliding drawer: same user-visible behaviour
// class, one geometry in the app instead of two, the 48px items get the full
// width, and nothing new has to be positioned.
//
// IT IS A DISCLOSURE, NOT A MODAL, and that is a safety property rather than a
// style choice. No modal role, no modal attribute, and no key handling that
// would cycle focus inside it: the Command Bar and the live mic session it
// drives must stay fully reachable while this panel covers the content
// (D-03/D-04). Trapping focus here would lock a keyboard or switch-access user
// away from the mic, which is the primary user's only reliable input.
// LogoutConfirmDialog remains the app's one true modal; do not add a second.
//
// Every dismissal and focus mechanic comes from useDismissable, which is
// GuideOverlay's behaviour lifted verbatim. Nothing mounts this yet — plan
// 16.1-06 wires it into App.tsx. Every colour is an index.css var() token and
// there is no hex literal in this file (grep-gated).
import { X } from "lucide-react";

import { useDismissable } from "../hooks/useDismissable";
import { ShellNav } from "./ShellNav";

// Fixed id so the panel's accessible name can point at its own heading.
const HEADING_ID = "nav-panel-heading";

export function NavPanel({
  open,
  onClose,
  clearanceAbove,
}: {
  /** Whether the panel is logically open. Owned by the shell
   *  (`openOverlay === "nav"`), which also keeps it mutually exclusive with
   *  the guide and auto-closes it when the viewport crosses 1024px. */
  open: boolean;
  /** Closes the panel. Wired to Escape, the Close button, and selecting any
   *  destination (§5.2 dismiss routes (a)/(b)/(c)); route (d) is a second tap
   *  on the still-live menu trigger, which the shell owns. */
  onClose: () => void;
  /** Measured height (px) of the top band above this panel, from
   *  useClearanceHeight. Becomes this panel's own `top` offset, so its
   *  scrollable coordinate space starts below the band and content can never
   *  scroll behind it. */
  clearanceAbove: number;
}) {
  const { mounted, shown, closeButtonRef } = useDismissable({
    open,
    onClose,
    triggerId: "menu-trigger-button",
  });

  if (!mounted) return null;

  return (
    <>
      {/* The backdrop is a SEPARATE always-`fixed inset-0` element from the
          panel below, and that split is required rather than decorative.
          GuideOverlay splits its own out precisely because a panel offset by a
          measured `top` cannot guarantee opaque coverage of the band's
          un-stuck in-flow rectangle, or of any sliver between the stuck band
          and the measured offset — it fixes a documented bleed-through
          regression (T-16.1-20). This panel has the same geometry and the same
          measured-offset dependency, so it inherits the same element. Filled
          with mist to match this panel's own surface; the guide uses deck to
          match its own. */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[var(--color-mist)] transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* role="group" + aria-labelledby, never the modal pair — see the file
          header. The opacity pair fades the panel in and out over 250ms with a
          static reduced-motion fallback; the panel never travels, so there is
          no motion to reduce beyond the fade. */}
      <div
        id="nav-panel"
        role="group"
        aria-labelledby={HEADING_ID}
        className={`fixed inset-x-0 bottom-0 z-50 overflow-y-auto bg-[var(--color-mist)] transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        style={{ top: clearanceAbove }}
      >
        {/* Sticky dismiss bar, identical to GuideOverlay's. First in DOM so it
            receives focus on open, and an explicit ≥48px target so a switch or
            voice user always has a route out (T-16.1-19). "Close" is this
            product's one word for this gesture — GuideOverlay and ChartTooltip
            already use it, so it adds no vocabulary. */}
        <div className="sticky top-0 z-10 flex justify-end bg-[var(--color-mist)] px-4 py-2 md:px-8">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-mist)] px-6 text-label text-[var(--color-depth)]"
          >
            <X aria-hidden="true" size={24} />
            Close
          </button>
        </div>

        <div className="px-4 pb-6 md:px-8">
          <h2
            id={HEADING_ID}
            className="mb-6 text-heading leading-tight text-[var(--color-depth)]"
          >
            Menu
          </h2>

          {/* Selecting any destination dismisses the panel. The Guide is
              DELIBERATELY omitted (§5.2 superseding note, client decision
              2026-10-01): with it here, Menu then Guide would be the only
              route to the guide below 1024px, producing guideOpen and
              openOverlay === "nav" at once — and because both surfaces are
              fixed on the panel layer over backdrops on the layer beneath,
              with this panel after GuideOverlay in tree order, this panel
              would paint over the guide and the screen would not change
              (T-16.1-19a). Omitting it also keeps the Guide button's fixed id
              unique in the DOM once SlimTopBar mounts its own copy. */}
          <ShellNav onNavigate={onClose} includeGuide={false} />
        </div>
      </div>
    </>
  );
}

// Deliberately NOT in this panel, and do not add them: the page title heading
// and the Guest-Demo provenance badge (both live in the slim bar, where the
// badge is reachable without opening anything — T-16.1-18), the Guide control,
// the filter controls (they have their own triggers, §5.3), and the Command
// Bar (never inside an overlay).
