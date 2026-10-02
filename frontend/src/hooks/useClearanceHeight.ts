// Lifted verbatim out of App.tsx (16.1-03, UI-SPEC §5.0/§8): the left rail,
// the nav panel and the filter/dates panels all need the same measured
// top-band height, and a local function in App.tsx could neither be imported
// by them nor threaded through props from a sibling that cannot see it.
// Behaviour, signature and ResizeObserver body are unchanged — §8 lists this
// hook as explicitly not modified by this phase.
import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** Sums the live rendered height of one or two elements and keeps it in
 *  sync via ResizeObserver — gives GuideOverlay an exact `clearanceAbove`
 *  instead of a guessed fixed padding (see its paddingTop comment for why
 *  a fixed value can't work: the shell's measured top band wraps to more
 *  rows, and grows taller, on narrower viewports). `primaryRef`/
 *  `secondaryRef` come from `useRef` so they're referentially stable — the
 *  effect attaches its observer once and never needs to re-run. */
export function useClearanceHeight(
  primaryRef: RefObject<HTMLElement | null>,
  secondaryRef?: RefObject<HTMLElement | null>,
): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const elements = [primaryRef.current, secondaryRef?.current].filter(
      (el): el is HTMLElement => el != null,
    );
    if (elements.length === 0) return;
    const recompute = () =>
      setHeight(elements.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0));
    recompute();
    const observer = new ResizeObserver(recompute);
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [primaryRef, secondaryRef]);
  return height;
}
