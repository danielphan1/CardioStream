// Live media-query match as React state (16.1-03, UI-SPEC §5.0/§5.2/§5.5).
// Two callers, two queries, never interchangeable: `isDesktop` =
// "(min-width: 1024px)" picks the rail-vs-slim-bar shell, `isWide` =
// "(min-width: 768px)" picks the anchored-popover-vs-full-panel filter
// presentation. Named at the point of use, not here.
//
// Why a JS hook instead of `lg:hidden` / `hidden lg:flex` on two
// always-rendered trees: the <h1> and the role="status" Guest-Demo badge
// appear in both shells, and two copies in the DOM would hand assistive
// tech two page titles and two status regions even with one visually
// hidden (§5.2). Exactly one shell is mounted at a time.
import { useEffect, useState } from "react";

/** True when `window.matchMedia` is usable. jsdom does not implement
 *  matchMedia at all (empirically `undefined` — `src/tests/setup.ts` stubs
 *  `ResizeObserver` but deliberately not this), so every component test
 *  that renders the shell would throw without this guard. Mirrors
 *  `prefersReducedMotion()` in `src/lib/chartData.ts`. */
function matchMediaSupported(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return true;
}

/**
 * Whether `query` currently matches. Returns `false` — never throws — when
 * matchMedia is unavailable, which is what makes jsdom render the <1024px
 * slim-bar shell and keeps that path unit-testable rather than browser-only
 * (§5.2).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    matchMediaSupported() ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!matchMediaSupported()) return;
    const mql = window.matchMedia(query);
    // Re-read on (re-)subscribe: `query` may have changed, or the viewport
    // may have moved between the initial render and this effect.
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
