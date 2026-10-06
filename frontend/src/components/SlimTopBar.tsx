// SlimTopBar (16.1-05, UI-SPEC §5.2) — the <1024px shell, the counterpart to
// LeftRail. Exactly one of the two is ever mounted (the shell picks with
// useMediaQuery), so there is never a second <h1> or a second status region in
// the DOM.
//
// The bar is a flat mist surface with a 2px depth bottom border and a 64px
// FLOOR, not a fixed height: it is explicitly allowed to wrap to a second row
// at 375px rather than truncate, hide or sideways-scroll anything
// (No-Off-Screen Rule). Plan 16.1-06 measures its real height at runtime, so
// wrapping costs vertical space and nothing else — every panel's top offset
// follows automatically.
//
// Nothing mounts this yet — plan 16.1-06 wires it into App.tsx. Every colour is
// an index.css var() token, there is no hex literal in this file (grep-gated),
// and only font weights 400 and 700 are used.
import { BookOpen, Info, Menu, Sailboat } from "lucide-react";

import { useHealth } from "../hooks/useHealth";
import { useGuide } from "../store/guide";

// Shared header-chrome anatomy for both utility controls, verbatim from
// Header.tsx: 48px floor (the non-negotiable accessibility floor, CLAUDE.md),
// 16px horizontal padding, rounded-lg, mist fill, 2px depth border, depth
// text. Neither control is ever accent-filled — the accent fill is reserved
// for the selected destination in ShellNav. Hoisted into one constant because
// the two buttons must not be able to drift apart; both buttons carrying it is
// asserted by SlimTopBar.test.tsx rather than by a grep count.
const HEADER_CHROME =
  "press-swell flex min-h-12 items-center gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-mist)] px-4 text-label text-[var(--color-depth)]";

export function SlimTopBar({
  menuOpen,
  onToggleMenu,
}: {
  /** Whether the nav panel this bar's menu trigger controls is open. Owned by
   *  the shell (`openOverlay === "nav"`), not here. */
  menuOpen: boolean;
  /** Toggles that panel. A second tap on the still-live trigger closes the
   *  panel it opened (§5.2 dismiss route (d)). */
  onToggleMenu: () => void;
}) {
  // The Guide reads straight from its own store, exactly as Header.tsx does
  // today — no new prop is threaded for it. The guide/overlay mutual exclusion
  // lives in one place in AppShell (plan 16.1-06), not here.
  const guideOpen = useGuide((s) => s.open);
  const toggleGuide = useGuide((s) => s.toggleOpen);

  // Guest-demo detection (Phase 19, D-08): reuses the useHealth() hook already
  // polling /health every 60s — zero new fetch call.
  const demoMode = useHealth().data?.demo ?? false;

  return (
    <div className="flex min-h-16 flex-wrap items-center gap-2 bg-[var(--color-mist)] border-b border-[var(--color-hairline)] px-4 py-2">
      <Sailboat
        aria-hidden="true"
        size={32}
        className="shrink-0 text-[var(--color-depth)]"
      />
      {/* The same string and the same type token as LeftRail's, so the
          document outline does not depend on the viewport width. */}
      <h1 className="text-label leading-tight text-[var(--color-depth)]">
        Chris's Health Dashboard
      </h1>
      {/* Data-provenance disclosure (D-08, T-16.1-18). This lives in the BAR
          and must never move into the nav panel: it discloses that the numbers
          on screen are synthetic, so it cannot itself sit behind a disclosure
          control, or a guest on a phone sees real-looking blood-pressure
          figures with no indication they are fabricated until they choose to
          open a menu. Copy and markup verbatim from Header.tsx. */}
      {demoMode && (
        <span
          role="status"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-hairline)] bg-[var(--color-mist)] px-4 py-1 text-base text-[var(--color-depth)]"
        >
          <Info aria-hidden="true" size={18} />
          Guest Demo · Synthetic Data
        </span>
      )}

      {/* Right-pushed utility group. The auto start-margin that pushes it
          sits on the GROUP, not on either individual control, so the two
          travel together when the bar wraps to a second row. */}
      <div className="ms-auto flex items-center gap-2">
        {/* Menu trigger: icon AND text, never icon-only — the mic button
            remains the app's one documented icon-only control. */}
        <button
          id="menu-trigger-button"
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="nav-panel"
          className={HEADER_CHROME}
        >
          <Menu aria-hidden="true" size={24} />
          Menu
        </button>

        {/* Guide toggle (D-02, GUIDE-01/02/04) — an always-visible control in
            this bar, NOT a nav-panel utility (§5.2 superseding note, client
            decision 2026-10-01). It is here because the alternative is broken,
            not as a layout preference:
              - Below 1024px ShellNav renders only inside NavPanel, so with the
                Guide in the utility group Menu then Guide would be the only
                route to it. That produces guideOpen true AND
                openOverlay === "nav" at once, and because both surfaces are
                fixed z-50 over z-40 backdrops with NavPanel later in tree
                order, the panel paints over GuideOverlay and the screen does
                not change.
              - GuideOverlay restores focus by looking this button up by its
                stable id, which with the panel closed would not exist below
                1024px — so the voice-opened guide path (lib/agent.ts's
                setOpen) would drop focus to <body> with no announcement on
                close.
            Both would be NEW regressions on the voice-first path, since the id
            is mounted at every width today (Header.tsx). Putting the control
            in the always-visible bar makes the bad state unreachable rather
            than managed. ShellNav's includeGuide={false} handles the matching
            omission in the panel, so exactly one element carrying this id
            exists in the DOM at any width.

            Markup verbatim from Header.tsx. The label stays "Guide" in both
            states — the overlay's own Close control owns the dismiss verb
            (Copywriting Contract) — and the pressed-state attribute plus that
            label carry the state, so the control is never accent-filled. */}
        <button
          id="guide-toggle-button"
          type="button"
          onClick={toggleGuide}
          aria-pressed={guideOpen}
          className={HEADER_CHROME}
        >
          <BookOpen aria-hidden="true" size={24} />
          Guide
        </button>
      </div>
    </div>
  );
}
