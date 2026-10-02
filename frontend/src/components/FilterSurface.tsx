// FilterSurface (16.1-07, UI-SPEC 5.5) — the ONE disclosure body behind both
// filter triggers, in two presentations:
//
//   anchored  ≥768px, an absolutely-positioned box inside <main>, rendered
//             immediately after its trigger in DOM order so Tab flows
//             trigger, contents, next control. The content behind it stays
//             visible and interactive; <main> is NOT made inert.
//   panel     <768px, a full-viewport fixed panel rendered as a SIBLING of
//             <main> (5.0's structure table). <main> is inert while it is
//             open, which is exactly why the panel cannot live inside it —
//             rendering it there would disable its own controls.
//
// One component with a presentation variant, deliberately: two call sites with
// genuinely different geometry but identical contents, identical dismissal
// mechanics and an identical sticky bar. Duplicating it would guarantee the
// two drift.
//
// IT IS A DISCLOSURE, NOT A MODAL, and that is a safety property rather than a
// style choice. No modal role, no modal attribute, and no key handling that
// cycles focus inside it: the Command Bar and the live mic session it drives
// must stay fully reachable while this surface is up (D-03/D-04). Trapping
// focus here would lock a keyboard or switch-access user away from the mic,
// which is the primary user's only reliable input. LogoutConfirmDialog remains
// the app's one true modal; do not add a second.
//
// Every dismissal and focus mechanic comes from useDismissable, which is
// GuideOverlay's behaviour lifted verbatim. There is no third-party
// positioning library and no reposition-on-overflow logic: the trigger is
// always at the left edge of the content column, so a left-aligned 560px box
// always fits (the narrowest rail-present viewport is 1024px, giving a 720px
// content column), and below 768px this is a full-width panel anyway.
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useDismissable } from "../hooks/useDismissable";
import { DatesPanel } from "./DatesPanel";
import { FilterBar } from "./FilterBar";
import { ShowPanel } from "./ShowPanel";

// Fixed id so the filters surface can point its accessible name at its own
// heading. The dates surface has no heading of its own: the copy contract
// introduces no "Dates" heading string, and DatesPanel's visible "Date:"
// prefix already names its contents, so that one is labelled directly.
const FILTERS_HEADING_ID = "filter-surface-heading";

// The anchored popover dismisses on pointer-down rather than on click, so a
// tap outside closes it before the pressed control acts on it.
const OUTSIDE_DISMISS_EVENT = "pointerdown";

export function FilterSurface({
  kind,
  presentation,
  open,
  onClose,
  clearanceAbove,
}: {
  /** Which trigger owns this surface — picks both the contents and the
   *  `id`/`triggerId` pair. */
  kind: "filters" | "dates";
  /** Geometry only. Chosen by the caller from one
   *  `useMediaQuery("(min-width: 768px)")`, never measured here. */
  presentation: "anchored" | "panel";
  /** Whether the surface is logically open. Owned by the shell
   *  (`openOverlay === kind`). */
  open: boolean;
  /** Closes the surface. Wired to Escape, the Close button, and — anchored
   *  only — a pointer press outside. A second tap on the still-live trigger
   *  is route (d), which the trigger itself owns. */
  onClose: () => void;
  /** Measured height (px) of the top band above this surface, from
   *  useClearanceHeight. Becomes the panel's own `top` offset so content can
   *  never scroll behind it. Unused in the anchored presentation. */
  clearanceAbove?: number;
}) {
  const triggerId = `${kind}-trigger-button`;
  const { mounted, shown, closeButtonRef } = useDismissable({
    open,
    onClose,
    triggerId,
  });
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Outside-press dismissal, anchored presentation ONLY. The panel
  // presentation deliberately has none: it covers the whole viewport over an
  // opaque backdrop, so "outside" is not a place the user can aim at.
  //
  // Excluding the trigger itself is load-bearing — without it a closing tap
  // fires both this handler and the trigger's own toggle, which cancel out and
  // leave the surface open. Outside-press is never the only route out: Close
  // is an explicit 48px target, which is what a voice or switch user needs.
  useEffect(() => {
    if (!open || presentation !== "anchored") return;
    function handleOutside(event: Event) {
      const target = event.target as Node | null;
      if (target === null) return;
      if (surfaceRef.current?.contains(target)) return;
      if (document.getElementById(triggerId)?.contains(target)) return;
      onClose();
    }
    document.addEventListener(OUTSIDE_DISMISS_EVENT, handleOutside);
    return () =>
      document.removeEventListener(OUTSIDE_DISMISS_EVENT, handleOutside);
  }, [open, presentation, onClose, triggerId]);

  if (!mounted) return null;

  // role="group" plus a name, never the modal pair — see the file header.
  const naming =
    kind === "filters"
      ? { "aria-labelledby": FILTERS_HEADING_ID }
      : { "aria-label": "Dates" };

  const contents = (
    <>
      {/* Sticky dismiss bar, identical to NavPanel's and GuideOverlay's. First
          in DOM so it receives focus on open, and an explicit 48px target so a
          switch or voice user always has a route out. "Close" is this
          product's one word for this gesture across every disclosure. */}
      <div className="sticky top-0 z-10 flex justify-end bg-[var(--color-mist)] py-2">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-[var(--color-depth)] bg-[var(--color-mist)] px-6 text-label text-[var(--color-depth)]"
        >
          <X aria-hidden="true" size={24} />
          Close
        </button>
      </div>
      {kind === "filters" ? (
        <>
          <h2
            id={FILTERS_HEADING_ID}
            className="mb-4 text-heading leading-tight text-[var(--color-depth)]"
          >
            Filters
          </h2>
          {/* Time of Day, BP Category, Pulse Category, then Show — 5.5's
              order. The controls are moved, not rewritten. */}
          <div className="flex flex-col gap-4">
            <FilterBar />
            <ShowPanel />
          </div>
        </>
      ) : (
        <DatesPanel />
      )}
    </>
  );

  if (presentation === "anchored") {
    // The caller supplies the `relative` wrapper. The explicit stacking level
    // on the element below is REQUIRED, not cosmetic: an absolutely-positioned
    // box at an automatic level can be painted over by Recharts'
    // ResponsiveContainer,
    // which creates its own positioned box later in DOM order, hiding this
    // surface's controls behind the chart. No backdrop — this disclosure
    // covers nothing and leaves the content behind it live.
    return (
      <div
        ref={surfaceRef}
        id={`${kind}-popover`}
        role="group"
        {...naming}
        style={{ maxHeight: "min(70vh, 640px)" }}
        className={`absolute left-0 top-[calc(100%+8px)] z-30 w-[560px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border-2 border-[var(--color-depth)] bg-[var(--color-mist)] p-6 shadow-[var(--shadow-elevation)] transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      >
        {contents}
      </div>
    );
  }

  return (
    <>
      {/* The backdrop is a SEPARATE always-`fixed inset-0` element from the
          panel below, and that split is required rather than decorative. A
          panel offset by a measured `top` cannot guarantee opaque coverage of
          the top band's un-stuck in-flow rectangle, or of any sliver between
          the stuck band and the measured offset — it is the documented
          bleed-through regression GuideOverlay's own split backdrop exists to
          fix, and this panel has the same geometry and the same
          measured-offset dependency. Filled with mist to match the panel. */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[var(--color-mist)] transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Full width and NO shadow: this is not an island, it fills the
          viewport. The panel never travels, so the only motion to reduce is
          the fade. */}
      <div
        ref={surfaceRef}
        id={`${kind}-popover`}
        role="group"
        {...naming}
        style={{ top: clearanceAbove }}
        className={`fixed inset-x-0 bottom-0 z-50 overflow-y-auto bg-[var(--color-mist)] p-6 transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      >
        {contents}
      </div>
    </>
  );
}
