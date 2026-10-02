// LeftRail (16.1-05, UI-SPEC §5.1) — the 240px persistent shell for ≥1024px,
// replacing the 216px horizontal header band. The mark, the single <h1>, the
// Guest-Demo provenance badge and ShellNav's eight controls all live here now.
//
// Flat-Sea Rule: this is a control surface, not an elevated island — a flat
// mist fill (the 30% secondary surface) with a 2px depth border on the right
// edge only, deliberately with no elevation and no stacking offset of its own.
// §5.0 depends on that second omission: the guide's backdrop sits on the layer
// directly beneath its own panel and must cover the rail completely, which it
// only does while the rail stays on the automatic layer.
//
// Vertical scrolling is deliberately allowed here; the No-Off-Screen Rule bans
// only the horizontal kind.
//
// Nothing mounts this yet — plan 16.1-06 wires it into App.tsx. Every colour is
// an index.css var() token, there is no hex literal in this file (grep-gated),
// and only font weights 400 and 700 are used (text-label already carries 700).
import { Info, Sailboat } from "lucide-react";

import { useHealth } from "../hooks/useHealth";
import { ShellNav } from "./ShellNav";

export function LeftRail({
  inert,
}: {
  /** Reassignment of the `inert` that today sits on App.tsx's header wrapper
   *  (§5.0). The eight controls moved into this rail, so the attribute moves
   *  with them — without it, Tab walks a keyboard or switch-access user
   *  through eight invisible, unusable controls while the guide covers them.
   *  Spread straight onto the root; React 19 renders it as the boolean HTML
   *  attribute and omits it entirely when false. */
  inert?: boolean;
}) {
  // Guest-demo detection (Phase 19, D-08): the rail is always mounted deep
  // inside the authed, QueryClientProvider-wrapped tree, so it reuses the
  // useHealth() hook already polling /health every 60s — zero new fetch call.
  const demoMode = useHealth().data?.demo ?? false;

  return (
    // A plain div, and a SIBLING of the top band and of <main> (§5.0) — never
    // a parent or a child of either.
    <div
      inert={inert}
      className="w-60 shrink-0 sticky top-0 h-screen overflow-y-auto bg-[var(--color-mist)] border-r-2 border-[var(--color-depth)] px-4 pt-4 pb-6"
    >
      {/* Stacked header group: 8px gap, 24px below. The decorative curved
          divider that used to close the horizontal band is dropped — it was an
          ornament for a band that no longer exists. */}
      <div className="mb-6 flex flex-col gap-2">
        <Sailboat
          aria-hidden="true"
          size={32}
          className="shrink-0 text-[var(--color-depth)]"
        />
        {/* text-label (20px/700) deliberately, not the larger display token —
            the same string and the same type token as SlimTopBar, so the
            document outline does not depend on the viewport width. */}
        <h1 className="text-label leading-tight text-[var(--color-depth)]">
          Chris's Health Dashboard
        </h1>
        {/* Data-provenance disclosure (D-08): copy and markup verbatim from
            Header.tsx, minus any nowrap — across 208px of item width it is
            allowed to wrap to two lines, and must never truncate. */}
        {demoMode && (
          <span
            role="status"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--color-depth)] bg-[var(--color-mist)] px-4 py-1 text-base text-[var(--color-depth)]"
          >
            <Info aria-hidden="true" size={18} />
            Guest Demo · Synthetic Data
          </span>
        )}
      </div>

      {/* No onNavigate — the rail has nothing to dismiss. includeGuide stays
          at its default true: the rail keeps the Guide in its utility group,
          and because exactly one shell is ever mounted there is still exactly
          one guide-toggle-button in the DOM (§5.2 superseding note). */}
      <ShellNav />
    </div>
  );
}
