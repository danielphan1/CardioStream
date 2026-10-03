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
// before switching back to the timeline.
//
// THE TWO STATE SENTENCES ARE DELIBERATELY NOT HERE (16.1-UI-SPEC 5.4). The
// Show sentence and the not-applicable note both moved to
// FilterStateBlock.tsx, which the shell renders unconditionally in the
// content column — the primary user cannot see a sentence inside a popover he
// has not opened, and the note's copy now has exactly one declaration instead
// of the two it briefly had. This file therefore carries no live region of
// its own: three regions across two components became exactly one. Do not
// reintroduce one here, and do not re-declare the note copy.
import { useAgentPulseFlash } from "../lib/agent";
import { DATASET_META, DATASET_ORDER } from "../lib/datasetMeta";
import { useFilters } from "../store/filters";

// Mirrors FilterBar's control contract (mist card, depth border, 48px floor).
// No opacity dimming under ANY state: quick-task 260827-kir removed exactly
// that anti-pattern from OverlayToggle, and DESIGN.md's disabled-state rule is
// dashed-border-only.
const boxClass =
  "min-h-12 flex items-center gap-2 rounded-xl py-2 px-4 text-label " +
  "bg-[var(--color-mist)] text-[var(--color-depth)] " +
  "border border-[var(--color-hairline)] shadow-[var(--shadow-elevation)] cursor-pointer";

export function ShowPanel() {
  const visibleDatasets = useFilters((s) => s.visibleDatasets);
  const setDataset = useFilters((s) => s.setDataset);

  // D-08 pulse — identical treatment to FilterBar's own groups so an
  // agent-driven selection change reads as the same system as a manual click.
  const pulsing = useAgentPulseFlash();
  const pulseClass = pulsing.includes("datasets")
    ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
    : "";

  // No surface chrome of its own: FilterSurface supplies the mist fill, the
  // border and the padding.
  return (
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
                  className="h-[26px] w-[26px] flex-none cursor-pointer accent-[var(--color-accent)]"
                />
                {/* The legend mark. Vitals show the line's own stroke —
                    including its dash — so the panel and the chart cannot
                    disagree about which series is which. Rendered at full
                    strength in both states: the mark is information (which
                    series this is), and the checkbox's own checked state plus
                    its tick already carry on/off without colour. */}
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
                    />
                  </svg>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex-none text-base leading-none"
                    style={{ color }}
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
  );
}
