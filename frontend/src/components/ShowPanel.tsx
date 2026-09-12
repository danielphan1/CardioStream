// Show panel (Phase 14, D-01/D-02) — the five-dataset checkbox row that
// replaces BOTH the old chart-picker and OverlayToggle.
//
// Why checkboxes and not the aria-pressed buttons used elsewhere: the client
// asked for this control by name ("might be nice if any data sets were
// clickable... like a check box"). A real <input type="checkbox"> also gives
// screen readers the correct role and state for free, and the tick mark is a
// second, non-colour signal of what is on.
//
// The panel doubles as the chart legend — each box carries the exact mark the
// chart draws (solid bar / dashed bar / ◆▲■), so nothing on screen relies on
// colour alone.
//
// Dataset state is deliberately independent of chartView (D-01's original
// lock, carried forward from OverlayToggle): the boxes NEVER disable, even on
// a summary view that can't render them — a caregiver can pre-set datasets
// before switching back to the timeline. The note below is a visible
// indicator only, never a functional gate.
import { useEffect, useState } from "react";

import { useAgentPulse } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import { DATASET_META, DATASET_ORDER } from "../lib/datasetMeta";
import { buildShowSentence } from "../lib/showSentence";
import { useFilters } from "../store/filters";

const NOTE_COPY =
  "These datasets show on the Timeline — switch back to see them.";

// Mirrors FilterBar's control contract (mist card, depth border, 48px floor).
// No opacity dimming under ANY state: quick-task 260827-kir removed exactly
// that anti-pattern from OverlayToggle, and DESIGN.md's disabled-state rule is
// dashed-border-only.
const boxClass =
  "min-h-12 flex items-center gap-3 rounded-xl py-2 pl-3.5 pr-4 text-label " +
  "bg-[var(--color-mist)] text-[var(--color-depth)] " +
  "border-2 border-[var(--color-depth)] shadow-[var(--shadow-elevation)] cursor-pointer";

export function ShowPanel() {
  const visibleDatasets = useFilters((s) => s.visibleDatasets);
  const setDataset = useFilters((s) => s.setDataset);
  const chartView = useFilters((s) => s.chartView);

  // D-08 pulse — identical treatment to FilterBar's own groups so an
  // agent-driven selection change reads as the same system as a manual click.
  const pulseSeq = useAgentPulse((s) => s.seq);
  const pulseFields = useAgentPulse((s) => s.fields);
  const [pulsing, setPulsing] = useState<PulseField[]>([]);
  useEffect(() => {
    if (pulseSeq === 0) return; // no apply yet
    setPulsing(pulseFields);
    const t = setTimeout(() => setPulsing([]), 1500);
    return () => clearTimeout(t);
  }, [pulseSeq, pulseFields]);
  const pulseClass = pulsing.includes("datasets")
    ? " rounded-lg ring-2 ring-[var(--color-brass)] motion-safe:animate-pulse"
    : "";

  const appliesHere = chartView === "timeline";
  const sentence = buildShowSentence(visibleDatasets);

  return (
    <section className="bg-[var(--color-mist)] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-label text-[var(--color-depth)]">Show:</span>
        <div className={`flex flex-wrap gap-2${pulseClass}`}>
          {DATASET_ORDER.map((key) => {
            const { label, kind, color, dash, glyph } = DATASET_META[key];
            const on = visibleDatasets[key];
            return (
              <label key={key} className={boxClass}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setDataset(key, !on)}
                  className="h-[26px] w-[26px] flex-none cursor-pointer accent-[var(--color-brass)]"
                />
                {/* The legend mark. Vitals show the line's own stroke —
                    including its dash — so the panel and the chart cannot
                    disagree about which series is which. */}
                {kind === "vital" ? (
                  <svg
                    aria-hidden="true"
                    width={20}
                    height={4}
                    viewBox="0 0 20 4"
                    className="flex-none"
                  >
                    <line
                      x1="0"
                      y1="2"
                      x2="20"
                      y2="2"
                      stroke={color}
                      strokeWidth={4}
                      strokeDasharray={dash}
                      opacity={on ? 1 : 0.45}
                    />
                  </svg>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex-none text-[18px] leading-none"
                    style={{ color, opacity: on ? 1 : 0.45 }}
                  >
                    {glyph}
                  </span>
                )}
                {label}
              </label>
            );
          })}
        </div>
      </div>
      {!appliesHere && (
        <p
          aria-live="polite"
          className="mt-2 text-[18px] text-[var(--color-depth)]"
        >
          {NOTE_COPY}
        </p>
      )}
      <p
        aria-live="polite"
        className="mt-4 text-[18px] text-[var(--color-depth)]"
      >
        {sentence}
      </p>
    </section>
  );
}
