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
//
// WHY THESE ARE LINE-LEVEL PILLS AND NOT FACET-LEVEL ONES (quick 261005-mj2).
// The design brief asked for a ribbon of five facet chips — date range, time
// of day, BP category, pulse category, datasets — and supplied its own escape
// hatch: "if a ribbon cannot hold all of that, keep the sentences and restyle
// their typography only; the contract outranks the visual." A facet ribbon
// cannot hold it, for a mechanical reason worth writing down so nobody
// re-attempts it:
//
// Testing Library's getNodeText joins only an element's DIRECT text-node
// children. The filter sentence is exactly the string the brief wants cut into
// four chips, and it is asserted by exact string through getByText — so the
// instant that sentence is split across child <span>s the <p>'s matched text
// becomes "" and the assertion fails. Splitting also breaks the p-count
// assertion and turns the " · " separators from text into chip boundaries.
// Those assertions are not describing old markup; they ARE the enforcement of
// the contract clause "the sentences' text content stays derivable from
// buildFilterSentence / buildShowSentence".
//
// So each of the three EXISTING paragraphs becomes its own pill instead. That
// delivers the pill vocabulary and the ribbon read without forking the copy,
// without giving any fact a second home, and with FilterStateBlock.test.tsx
// passing completely unchanged. EACH SENTENCE MUST STAY A SINGLE DIRECT TEXT
// NODE of its <p> — the icon is an <svg> sibling, which contributes no text.
// Do not split a sentence. Do not interpolate into one.
import { Info, ListChecks, SlidersHorizontal } from "lucide-react";

import { buildFilterSentence, buildShowSentence } from "../lib/showSentence";
import { useFilters } from "../store/filters";

/** One pill. `rounded-full` is DESIGN.md's reserved shape for an
 *  information-bearing chip, which is precisely what these are — the same
 *  vocabulary as the Guest-Demo provenance badge in the rail, down to the
 *  18px mark. Every piece of state still carries a WORD, because the
 *  sentences themselves are untouched. */
const PILL =
  "inline-flex items-center gap-2 rounded-full border border-[var(--color-hairline)] bg-[var(--color-mist)] px-4 py-1 text-base text-[var(--color-depth)]";

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
    // `flex flex-wrap gap-2` rather than `space-y-2`: the three pills read as
    // one ribbon on a line instead of a stack of three grey paragraphs, which
    // was the grey wall standing between the controls and the data. The
    // wrapper is otherwise untouched — still the single polite region, still
    // non-atomic, never assertive, and the three <p> children still carry no
    // live attribute, no aria-atomic and no role of their own.
    <div aria-live="polite" className="flex flex-wrap gap-2">
      <p className={PILL}>
        <SlidersHorizontal aria-hidden="true" size={18} className="shrink-0" />
        {filterSentence}
      </p>
      <p className={PILL}>
        <ListChecks aria-hidden="true" size={18} className="shrink-0" />
        {showSentence}
      </p>
      {!appliesHere && (
        <p className={PILL}>
          <Info aria-hidden="true" size={18} className="shrink-0" />
          {NOTE_COPY}
        </p>
      )}
    </div>
  );
}
