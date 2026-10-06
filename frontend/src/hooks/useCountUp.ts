// useCountUp (quick 261005-mj2, brief §4) — counts a KPI readout up to its
// number on arrival and on every filter change, then settles.
//
// THE FINAL FRAME IS THE PAYLOAD STRING, CHARACTER FOR CHARACTER. StatsStrip's
// header contract is that every number on screen comes straight from
// GET /stats/summary and agrees with the API cell-for-cell, so this hook
// interpolates only the frames IN BETWEEN and renders the original value
// verbatim once it lands — never a reformat of it, not even one that happens
// to look identical. `117.90` instead of `117.9` would be a contract break,
// and so would `118`.
//
// A NULL VITAL NEVER COUNTS (D-22). The em dash is the answer to "what is the
// average", not a value on the way to one, so it renders immediately and the
// animation is never entered. A health figure that counts 0 -> 1 -> 2 where
// the real answer is "no data" is a clinical misstatement.
import { useEffect, useState } from "react";

import { prefersReducedMotion } from "../lib/chartData";

/** The D-22 null rendering. U+2014, matching StatsStrip's own literal. */
const EM_DASH = "—";

/** Mirrors --dur-crest. A plain constant rather than a getComputedStyle read
 *  of the token: index.css is not loaded under jsdom, so the custom property
 *  resolves to "" and every count would animate for NaN ms. Keep in step with
 *  index.css if --dur-crest ever changes. */
const DURATION_MS = 460;

/** Decelerating, to match --ease-swell's character. No overshoot: on a
 *  clinical number an overshoot reads as the VALUE changing, not the motion. */
function ease(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Formats an intermediate frame with the same number of decimal places the
 *  payload's own string form carries, so the digit count never jumps mid-count
 *  (117.9 counts through 70.3, not 70.28871). */
function formatLike(value: number, verbatim: string): string {
  const dot = verbatim.indexOf(".");
  return value.toFixed(dot === -1 ? 0 : verbatim.length - dot - 1);
}

/**
 * @param target  The payload value, or null for the D-22 em-dash contract.
 * @param startDelayMs  When the surface carrying this value arrives later in
 *   the entrance ladder, its own delay. NOT optional in practice on the mount
 *   path: `swell-rise` is `from { opacity: 0 }` with `both` fill, so a
 *   staggered card is INVISIBLE until its delay elapses — card 4 is hidden for
 *   its first 360ms, by which point an undelayed 460ms count is three-quarters
 *   done, and the user would watch an already-settled number fade in. The
 *   filter-change path replays no entrance, so it passes nothing and the
 *   default 0 applies.
 * @returns The string to render this frame.
 */
export function useCountUp(target: number | null, startDelayMs = 0): string {
  const verbatim = target === null ? EM_DASH : String(target);

  // `null` means SETTLED: render `verbatim`. Keeping the settled state out of
  // band is what guarantees the last frame is the payload string itself rather
  // than a formatted approximation of it.
  const [frame, setFrame] = useState<string | null>(() =>
    target === null ? null : formatLike(0, verbatim),
  );

  useEffect(() => {
    // Reduced motion gets the final value immediately. The index.css token
    // block cannot reach a JS rAF loop, so this is checked here rather than
    // inherited. Reuses lib/chartData's existing helper (already jsdom-guarded
    // — jsdom implements no matchMedia at all).
    if (target === null || prefersReducedMotion()) {
      setFrame(null);
      return;
    }

    setFrame(formatLike(0, verbatim));

    let raf = 0;
    let started = 0;
    const tick = (now: number) => {
      if (started === 0) started = now;
      const elapsed = now - started - startDelayMs;
      if (elapsed >= DURATION_MS) {
        setFrame(null);
        return;
      }
      if (elapsed >= 0) {
        setFrame(formatLike(target * ease(elapsed / DURATION_MS), verbatim));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Cancels on unmount AND on every target change, so a filter change that
    // lands mid-count cannot leave two loops writing to the same readout.
    return () => cancelAnimationFrame(raf);
  }, [target, verbatim, startDelayMs]);

  return frame ?? verbatim;
}
