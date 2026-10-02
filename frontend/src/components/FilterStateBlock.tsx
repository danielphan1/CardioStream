// The always-visible applied-filter state (16.1-UI-SPEC.md §5.4, D-20).
//
// WHY THIS LIVES OUTSIDE EVERY POPOVER. This is how the primary user — a C4
// quadriplegic who cannot reliably open a popover, and cannot see one he has
// not opened — knows what is currently applied. Burying any of these three
// lines inside the filter popover would mean an agent-applied change
// announces to nothing and shows nothing while the popover is closed, which
// is the NORMAL state. So the block is rendered unconditionally in the
// content column, never inside a panel. It is a hard requirement, not a
// preference: do not move it into a disclosure.
//
// ONE REGION, NOT THREE. Before Phase 16.1 these three sentences each
// carried their own polite live attribute, across two components (FilterBar's
// filter sentence, ShowPanel's note and Show sentence). Merely co-locating
// them would let a single agent command queue three adjacent polite
// announcements on top of the Command Bar's own live region AND the spoken
// composeConfirmation — four or five utterances for one command, in an order
// no screen reader guarantees. So the WRAPPER div owns the single polite live
// region below and the three <p> elements carry no live attributes of their
// own: a change to one line announces that line only, a change to several
// announces them in DOM order, which is the reading order on screen.
//
// The region is also left non-atomic (so one changed line reads alone rather
// than re-reading all three) and is never urgent/interrupting — a filter
// change must not talk over the mic. FilterStateBlock.test.tsx asserts all of
// this, and the plan greps this file for a single live attribute, so keep the
// attribute literals out of these comments.
//
// ACCEPTED CONSEQUENCE, recorded so it is not mistaken for a defect (§5.4):
// at <768px with a filter or dates panel open, this block sits inside an
// `inert` <main>, so it is out of the accessibility tree and announces
// nothing while that panel is up. Each checkbox still announces its own state
// change, and the agent path is carried by the Command Bar's own live region
// plus the spoken confirmation, both of which live in the never-`inert` top
// band. The block is visible and AT-readable again the instant the panel
// closes; it simply does not fire a retroactive announcement for a change
// made behind it.
import { buildFilterSentence, buildShowSentence } from "../lib/showSentence";
import { useFilters } from "../store/filters";

// THE ONLY declaration of this string in the app. Plan 16.1-04 briefly
// duplicated it from ShowPanel.tsx because that file was outside its scope
// while plan 16.1-05 ran in parallel; plan 16.1-07 stripped ShowPanel's two
// sentence paragraphs and collapsed the duplication onto this line. Keep it
// that way — a user-visible string with two homes drifts.
const NOTE_COPY =
  "These datasets show on the Timeline. Switch back to see them.";

type FilterStateBlockProps = {
  /** The UNFILTERED newest-reading anchor, wired once in App.tsx — the same
   *  prop FilterBar takes today (RESEARCH Open Question 1: day presets anchor
   *  to the newest reading, never to today). */
  latestReading: string | null;
};

// Outer spacing (8px below the trigger row, 24px above the vitals strip) is
// applied by the caller in plan 16.1-07, not here — only the inter-paragraph
// rhythm belongs to this component.
export function FilterStateBlock({ latestReading }: FilterStateBlockProps) {
  const datePreset = useFilters((s) => s.datePreset);
  const timeOfDay = useFilters((s) => s.timeOfDay);
  const bpCategory = useFilters((s) => s.bpCategory);
  const pulseCategory = useFilters((s) => s.pulseCategory);
  const visibleDatasets = useFilters((s) => s.visibleDatasets);
  const chartView = useFilters((s) => s.chartView);

  const filterSentence = buildFilterSentence({
    datePreset,
    latestReading,
    timeOfDay,
    bpCategory,
    pulseCategory,
  });
  const showSentence = buildShowSentence(visibleDatasets);
  const appliesHere = chartView === "timeline";

  return (
    <div aria-live="polite" className="space-y-2">
      <p className="text-base text-[var(--color-depth)]">{filterSentence}</p>
      <p className="text-base text-[var(--color-depth)]">{showSentence}</p>
      {!appliesHere && (
        <p className="text-base text-[var(--color-depth)]">{NOTE_COPY}</p>
      )}
    </div>
  );
}
