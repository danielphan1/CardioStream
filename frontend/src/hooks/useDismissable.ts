// The app's ONE disclosure-dismissal pattern (16.1-03, UI-SPEC §5.5). Three
// consumers: the nav panel (plan 16.1-05) and the Filters / Dates popovers
// (plan 16.1-07). Every effect below is copied from `GuideOverlay.tsx`, which
// already behaves this way and is deliberately NOT refactored onto this hook
// in this phase (§8) — the only adaptation is that GuideOverlay's hardcoded
// "guide-toggle-button" becomes the `triggerId` parameter.
//
// THIS HOOK TRAPS NO FOCUS, and that is a safety property rather than a style
// choice. Quoting GuideOverlay's own header comment: "it has no dialog role,
// no modal attribute, and traps no focus: CommandBar (and the live mic session
// it drives) must stay fully reachable — including by Tab — while the guide is
// open (D-03/D-04)." A trap here would lock a keyboard or switch-access user
// out of the mic and the Command Bar, which is the primary user's only
// reliable input. These surfaces are therefore disclosures, not modals:
// role="group" + aria-label on the panel and aria-expanded / aria-controls on
// the trigger, never aria-modal.
//
// `LogoutConfirmDialog` is the app's one true modal and keeps its trap. Do not
// add a second one here.
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** Open/close opacity-fade duration in ms. Must stay numerically in sync with
 *  the Tailwind `duration-[250ms]` class every consumer applies to its panel
 *  and backdrop — one encodes the CSS transition, the other the JS
 *  delayed-unmount timeout, and both must agree on the same 250ms fade.
 *  Same value and same contract as GuideOverlay's FADE_DURATION_MS. */
export const DISMISSABLE_FADE_MS = 250;

interface UseDismissableOptions {
  /** Whether the surface is logically open. Owned by the caller (e.g.
   *  AppShell's `openOverlay === "nav"`). */
  open: boolean;
  /** Called on Escape. The caller closes itself; this hook never owns state
   *  it did not create. */
  onClose: () => void;
  /** `id` of the control that opens this surface — focus returns to it on a
   *  real open→close transition. A developer-supplied literal from a fixed
   *  set (`menu-trigger-button`, `filters-trigger-button`,
   *  `dates-trigger-button`); a missing element is tolerated by optional
   *  chaining, exactly as GuideOverlay does. */
  triggerId: string;
}

interface UseDismissableResult {
  /** Gates the consumer's early `return null`: true immediately on open, and
   *  on close stays true for DISMISSABLE_FADE_MS so the exit fade can play
   *  before the DOM node is removed. */
  mounted: boolean;
  /** Drives the `opacity-0` / `opacity-100` class toggle. */
  shown: boolean;
  /** Attach to the panel's sticky "Close" button — it is first in DOM and
   *  receives focus on open. */
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

export function useDismissable({
  open,
  onClose,
  triggerId,
}: UseDismissableOptions): UseDismissableResult {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Entrance/exit fade state. `shown` drives the opacity-0/opacity-100 class
  // toggle: on open, a double-rAF (mirrors ChartDeck.tsx's FadeSwap helper)
  // lets the initial opacity-0 paint land before flipping to opacity-100, so
  // the CSS transition actually animates instead of snapping straight to full
  // opacity; on close there's no rAF needed -- the element is already painted
  // at opacity-100, so a synchronous flip to opacity-0 transitions naturally
  // on the next render. `mounted` (seeded from `open` so an initially-open
  // surface renders immediately) gates the consumer's early return: it flips
  // true immediately on open, but on close it stays true for
  // DISMISSABLE_FADE_MS so the exit fade has time to play before the DOM node
  // is actually removed.
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timeout = setTimeout(() => setMounted(false), DISMISSABLE_FADE_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  // Escape-to-close (mirrors LogoutConfirmDialog's Escape branch), but as a
  // window-level listener — there is no local onKeyDown-bearing dialog
  // element here, and these surfaces deliberately have no focus trap. The
  // listener is removed on close and on unmount, so no dangling global
  // handler survives either (T-16.1-09).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus management (GuideOverlay code review CR-01/WR-03). CR-01: the shell
  // can make content `inert` in the SAME commit that flips `open` true — the
  // browser synchronously blurs the just-activated trigger as part of
  // applying `inert`, with nowhere to land, dropping keyboard/screen-reader
  // focus to `<body>` with no announcement. That blur is synchronous
  // DOM-mutation behavior, applied before React runs ANY effect for the
  // commit, so capturing `document.activeElement` inside an effect here (the
  // naive fix) always sees `<body>` already, never the original trigger.
  // Moving focus deliberately onto Close fixes this regardless of that race.
  // WR-03: for the same reason, restoring "whatever was focused before" isn't
  // reliably capturable — instead restore to the trigger by its stable id,
  // which is also the semantically correct destination (the control that
  // reopens the surface).
  // wasOpenRef (CR-01, iteration 2): `useEffect` runs once after every initial
  // mount regardless of `open`'s value, and these surfaces are mounted fresh
  // on every view switch — so without this guard, the `else` branch below
  // would fire `document.getElementById(triggerId)?.focus()` on EVERY
  // navigation (and on initial login), even though the surface was never
  // open. Seeding the ref from `open` means the first render's "wasOpen"
  // always matches `open` itself, so the `else` branch can only run once
  // `wasOpenRef.current` was actually `true` on a prior render — i.e. only on
  // a real open->close transition, never on mount.
  // wasOpenRef now gates BOTH branches on a real transition, not just the
  // close one (quick 261002-kem): AssistantPopup is the first consumer that
  // can mount already open (its dismissal is persisted, so an undismissed
  // popup is open on the very first render), and an unguarded focus() there
  // would steal focus to a Close button on page load.
  //
  // The effect also keys on `mounted`, which fixes a latent bug the old
  // mount-open shortcut hid: `mounted` is seeded from `open` and otherwise
  // set from an effect, so on a real closed->open transition the consumer
  // still renders `null` for the commit in which `open` flips — meaning
  // closeButtonRef.current is null when the effects for that commit run, and
  // `focus()` was a silent no-op. Focus only ever landed on Close for a
  // surface that mounted open, which is exactly what no consumer in the app
  // does. Waiting for `mounted` (without recording the transition until then)
  // moves focus on the next commit, when the panel's DOM actually exists.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    // Equal means no transition — every initial mount included, whichever
    // value `open` had.
    if (open === wasOpen) return;
    if (open) {
      if (!mounted) return; // the panel has no DOM yet; re-runs on `mounted`
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
    } else {
      wasOpenRef.current = false;
      document.getElementById(triggerId)?.focus();
    }
  }, [open, mounted, triggerId]);

  return { mounted, shown, closeButtonRef };
}
