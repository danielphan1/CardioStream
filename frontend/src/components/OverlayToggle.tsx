// Overlay toggle row (OVERLAY-03/OVERLAY-05, D-01) — the codebase's first
// true multi-select control group, mounted as a peer sibling of FilterBar
// (not nested inside it — 09-UI-SPEC.md's resolved discretion item). Each of
// the 3 buttons independently controls one overlay dataset flag in
// store/filters.ts, reachable by voice (toggle_dataset agent command, Plan
// 09-01/09-02) or click.
//
// Overlay state is deliberately independent of activeChart (D-01's lock):
// the buttons never disable, even when the current chart doesn't render
// overlays — a caregiver can pre-set overlays before switching back to a
// timeline chart. The "doesn't apply here" note (OVERLAY-05) is a visible
// indicator only, never a functional gate.
import { useEffect, useState } from "react";

import { useAgentPulse } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import { buildOverlaySentence } from "../lib/overlayEvents";
import { OVERLAY_META, OVERLAY_ORDER } from "../lib/overlayMeta";
import { useFilters } from "../store/filters";

const NOTE_COPY =
  "Overlays aren't shown on this chart — switch to Blood Pressure or Pulse to see them.";

// Shared inactive-button styling (mirrors FilterBar's own inactiveClass) —
// the ACTIVE fill is per-dataset (inline style), not a shared accent class,
// per 09-UI-SPEC.md's Marker & Icon Contract.
const inactiveClass =
  "min-h-12 flex items-center gap-2 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 flex items-center gap-2 rounded-lg px-4 text-[20px] font-bold text-white border-2";

export function OverlayToggle() {
  const overlayDatasets = useFilters((s) => s.overlayDatasets);
  const setOverlayDataset = useFilters((s) => s.setOverlayDataset);
  const activeChart = useFilters((s) => s.activeChart);

  // D-08 pulse — identical treatment to FilterBar.tsx's own groups so an
  // agent-driven overlay change reads as the same system as a manual click.
  const pulseSeq = useAgentPulse((s) => s.seq);
  const pulseFields = useAgentPulse((s) => s.fields);
  const [pulsing, setPulsing] = useState<PulseField[]>([]);
  useEffect(() => {
    if (pulseSeq === 0) return; // no apply yet
    setPulsing(pulseFields);
    const t = setTimeout(() => setPulsing([]), 1500);
    return () => clearTimeout(t);
  }, [pulseSeq, pulseFields]);
  const pulseClass = pulsing.includes("overlay")
    ? " ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
    : "";

  const overlayApplies =
    activeChart === "bp_timeline" || activeChart === "pulse_trend";

  const sentence = buildOverlaySentence(overlayDatasets);

  return (
    <section className="bg-[var(--color-sky)] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[20px] font-bold text-[var(--color-ink)]">
          Overlay:
        </span>
        <div
          role="group"
          aria-label="Overlay events"
          className={`flex flex-wrap gap-2${overlayApplies ? "" : " opacity-60"}${pulseClass}`}
        >
          {OVERLAY_ORDER.map((key) => {
            const { label, Icon, color } = OVERLAY_META[key];
            const on = overlayDatasets[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setOverlayDataset(key, !on)}
                className={on ? activeClass : inactiveClass}
                style={on ? { backgroundColor: color, borderColor: color } : undefined}
              >
                <Icon aria-hidden="true" size={20} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {!overlayApplies && (
        <p
          aria-live="polite"
          className="mt-2 text-[18px] text-[var(--color-ink)]"
        >
          {NOTE_COPY}
        </p>
      )}
      <p aria-live="polite" className="mt-4 text-[18px] text-[var(--color-ink)]">
        {sentence}
      </p>
    </section>
  );
}
