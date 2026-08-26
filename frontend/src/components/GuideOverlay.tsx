// Site guide overlay (D-01..D-13; 11-UI-SPEC.md's "Overlay stacking/layering",
// "Guide close control", "Table of contents", and "Per-section fixed format"
// sections are the authoritative, binding markup/class contract for this
// file). This is an always-mounted LANDMARK REGION that returns `null` when
// closed — NOT a modal. Unlike `LogoutConfirmDialog` (Header.tsx), it has no
// dialog role, no modal attribute, and traps no focus: `CommandBar` (and the
// live mic session it drives) must stay fully reachable — including by Tab —
// while the guide is open (D-03/D-04). Mount point (raising the CommandBar
// band above this overlay's z-layer) is deferred to Plan 11-05.
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { X } from "lucide-react";

import { SIMILAR_PHRASINGS_NOTE, VOICE_COMMAND_CATEGORIES } from "../lib/voiceCommands";
import { useGuide } from "../store/guide";

const SECTIONS = [
  { id: "command-bar", label: "Command Bar" },
  { id: "filters", label: "Filters" },
  { id: "charts", label: "Charts" },
  { id: "overlay", label: "Overlay" },
  { id: "voice-replies", label: "Voice Replies" },
  { id: "upload", label: "Upload" },
  { id: "add-a-record", label: "Add a Record" },
  { id: "what-can-i-say", label: "What Can I Say" },
  { id: "about-this-guide", label: "About This Guide" },
];

const h2Class = "text-2xl leading-tight font-bold text-[var(--color-ink)]";
const bodyClass = "text-lg text-[var(--color-ink)]";

// See the paddingTop comment below for what these mean and why they exist.
const CLOSE_BAR_HEIGHT = 64;
const DEFAULT_CLEARANCE_ABOVE = 261;
// Small breathing-room buffer on top of the exact measured value: the
// caller's ResizeObserver-based measurement settles a moment after the
// obstruction's real height changes (e.g. AgentStatusBanner mounting
// async), so a mid-settle read can be a few px stale — this keeps that
// briefly-stale state from reading as a touching/overlapping seam.
const CLEARANCE_BUFFER = 12;

interface GuideOverlayProps {
  /** Real, measured height (px) of whatever sits above this overlay in the
   *  document and stays visible while it's open — e.g. Header + the pinned
   *  CommandBar band on Dashboard, or just Header on Upload/Add Record.
   *  Passed by the caller (ResizeObserver-measured — see App.tsx) rather
   *  than guessed here, because that height varies continuously with
   *  viewport width (the Header and CommandBar both wrap to more rows on
   *  narrow screens) and can't be captured by a single fixed padding value.
   *  Falls back to a static estimate only for the (should-be-unreachable)
   *  case a caller doesn't measure and pass one. */
  clearanceAbove?: number;
}

export function GuideOverlay({ clearanceAbove }: GuideOverlayProps) {
  const open = useGuide((s) => s.open);
  const setOpen = useGuide((s) => s.setOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape-to-close (mirrors LogoutConfirmDialog's Escape branch), but as a
  // window-level listener — there is no local onKeyDown-bearing dialog
  // element here, and this component deliberately has no focus trap.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Focus management (code review CR-01/WR-03). CR-01: App.tsx makes Header
  // (and the "Guide" button inside it) `inert` the instant `open` flips
  // true, in the SAME commit — the browser synchronously blurs that
  // just-activated button as part of applying `inert`, with nowhere to
  // land, dropping keyboard/screen-reader focus to `<body>` with no
  // announcement. That blur is synchronous DOM-mutation behavior, applied
  // before React runs ANY effect (layout or passive) for this commit —
  // verified empirically (Claude-in-Chrome), so capturing
  // `document.activeElement` inside an effect here (the naive fix) always
  // sees `<body>` already, never the original button. Moving focus
  // deliberately onto Close fixes this regardless of that race.
  // WR-03: for the same reason, restoring "whatever was focused before"
  // isn't reliably capturable — instead restore to the Guide button by its
  // stable id (Header.tsx), which is also the semantically correct
  // destination (the control that reopens the guide), mirroring
  // LogoutConfirmDialog's existing restore-to-trigger pattern in spirit.
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    } else {
      document.getElementById("guide-toggle-button")?.focus();
    }
  }, [open]);

  if (!open) return null;

  const sectionScrollStyle: CSSProperties = {
    // Every jump-target section needs the SAME clearance as the initial
    // paddingTop below (WR-02): scrollIntoView aligns a target's top edge
    // to this scroll container's own top (y=0), which is permanently
    // covered by the sticky Close bar *and*, on Dashboard, by the
    // screen-fixed CommandBar band above it (see the paddingTop comment) —
    // that obstruction is present at ANY scroll position, not just the
    // initial one, so this uses the full clearanceAbove (not minus
    // CLOSE_BAR_HEIGHT — unlike paddingTop, this isn't stacked after the
    // Close bar's own normal-flow space; scrollIntoView positions directly
    // against the container's y=0).
    scrollMarginTop: Math.max(
      0,
      (clearanceAbove ?? DEFAULT_CLEARANCE_ABOVE) + CLEARANCE_BUFFER,
    ),
  };

  return (
    <div
      role="region"
      aria-label="Site guide"
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-foam)]"
    >
      <div className="sticky top-0 z-10 flex justify-end bg-[var(--color-foam)] px-4 py-2 md:px-8">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setOpen(false)}
          className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-[20px] font-bold text-[var(--color-ink)]"
        >
          <X aria-hidden="true" size={24} />
          Close
        </button>
      </div>

      {/* paddingTop clears whatever sits above this overlay and stays
          visible while it's open (Header + the pinned CommandBar band on
          Dashboard, or just Header on Upload/Add Record) — Plan 11-05's
          manual verification checkpoint found that a fixed Tailwind
          padding class can't do this correctly: the CommandBar section
          can't actually reach `sticky` top:0 while the guide is open,
          because this overlay is `fixed inset-0` and captures scroll — so
          the outer page's scroll position never advances past 0, leaving
          CommandBar pinned at its natural in-flow position *below* the
          (now-hidden) site header, not at the very top. Worse, that
          combined header+CommandBar height varies continuously with
          viewport width (both wrap to more rows on narrow screens), so
          any single fixed px guess is wrong at some width. `clearanceAbove`
          is the caller's real ResizeObserver measurement of that height;
          CLOSE_BAR_HEIGHT (64px = py-2 + the close button's min-h-12,
          both fixed regardless of viewport) is what the sticky Close-bar
          above already covers via normal flow, so only the remainder needs
          padding. DEFAULT_CLEARANCE_ABOVE is a desktop-shaped fallback for
          the (should-be-unreachable) case a caller doesn't measure and
          pass one. CLEARANCE_BUFFER covers the brief settle-lag window. */}
      <div
        className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-16 md:px-8 xl:px-16"
        style={{
          paddingTop: Math.max(
            0,
            (clearanceAbove ?? DEFAULT_CLEARANCE_ABOVE) - CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER,
          ),
        }}
      >
        <h1 className="text-[32px] font-bold leading-tight text-[var(--color-ink)]">
          Site Guide
        </h1>

        <nav aria-label="Jump to a section">
          <p className="text-[20px] font-bold text-[var(--color-ink)]">
            Jump to a section
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex min-h-12 items-center rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="command-bar" style={sectionScrollStyle}>
          <h2 className={h2Class}>Command Bar</h2>
          <p className={bodyClass}>
            The Command Bar is the box at the top of the dashboard for typing
            or speaking a request, like "show my pulse for the last 30 days."
            It's always visible so you can ask for a new view any time.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Type into the text box, then click Send
            (or press Enter on a keyboard).
          </p>
          <p className={bodyClass}>
            <strong>By voice:</strong> Tap the microphone button, then speak
            your request out loud.
          </p>
        </section>

        <section id="filters" style={sectionScrollStyle}>
          <h2 className={h2Class}>Filters</h2>
          <p className={bodyClass}>
            Filters narrow down which readings are shown — by date range, by
            morning (AM) or evening (PM), or by blood pressure category.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Tap a filter chip (like "Last 30 Days"
            or "Mornings") to turn it on or off.
          </p>
          <p className={bodyClass}>
            <strong>By voice:</strong> Say a filter phrase, like "last 30
            days, mornings only" or "show stage 2 readings."
          </p>
        </section>

        <section id="charts" style={sectionScrollStyle}>
          <h2 className={h2Class}>Charts</h2>
          <p className={bodyClass}>
            Four charts are available: Blood Pressure Timeline, Pulse Trend,
            Blood Pressure Categories, and AM vs PM. The chart-picker cards
            switch which one is shown on the dashboard.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Tap a chart-picker card to switch to
            that chart.
          </p>
          <p className={bodyClass}>
            <strong>By voice:</strong> Say a chart's name, like "show my
            pulse" or "show blood pressure."
          </p>
        </section>

        <section id="overlay" style={sectionScrollStyle}>
          <h2 className={h2Class}>Overlay</h2>
          <p className={bodyClass}>
            The overlay buttons let you show labs, incidents, and procedures
            plotted right on top of the Blood Pressure or Pulse charts, so you
            can see how they relate to a reading.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Tap a Labs, Incidents, or Procedures
            button to show or hide that data on the chart.
          </p>
          <p className={bodyClass}>
            <strong>By voice:</strong> Say something like "show incidents" or
            "hide labs."
          </p>
        </section>

        <section id="voice-replies" style={sectionScrollStyle}>
          <h2 className={h2Class}>Voice Replies</h2>
          <p className={bodyClass}>
            When Voice Replies is on, the dashboard speaks a short
            confirmation out loud after a voice or typed command is applied,
            so you don't have to look at the screen to know it worked.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Tap the "Voice Replies" button in the
            header to turn spoken confirmations on or off.
          </p>
          <p className={bodyClass}>
            <strong>By voice:</strong> Say "mute the voice replies" or "turn
            on voice replies."
          </p>
        </section>

        <section id="upload" style={sectionScrollStyle}>
          <h2 className={h2Class}>Upload</h2>
          <p className={bodyClass}>
            The Upload page lets a caregiver add new blood pressure readings
            from an OMRON monitor's exported file.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Tap the "Upload" button in the header,
            then choose the exported file to add its readings.
          </p>
        </section>

        <section id="add-a-record" style={sectionScrollStyle}>
          <h2 className={h2Class}>Add a Record</h2>
          <p className={bodyClass}>
            The Add Record page has separate forms for logging a lab result,
            an incident (like passing out or a hospital stay), or a
            procedure.
          </p>
          <p className={bodyClass}>
            <strong>By click:</strong> Tap the "Add Record" button in the
            header, choose Lab, Incident, or Procedure, then fill in and
            submit the form.
          </p>
        </section>

        <section id="what-can-i-say" style={sectionScrollStyle}>
          <h2 className={h2Class}>What Can I Say</h2>
          {VOICE_COMMAND_CATEGORIES.map((c) => (
            <div key={c.id}>
              <h3 className="text-[20px] font-bold text-[var(--color-ink)]">
                {c.label}
              </h3>
              <p className="text-lg font-bold text-[var(--color-ink)]">
                "{c.example}"
              </p>
              <p className={bodyClass}>{SIMILAR_PHRASINGS_NOTE}</p>
            </div>
          ))}
        </section>

        <section id="about-this-guide" style={sectionScrollStyle}>
          <h2 className={h2Class}>About This Guide</h2>
          <p className={bodyClass}>
            You can reopen this guide any time by clicking the "Guide" button
            in the header. Close it with the Close button above or by
            pressing Escape.
          </p>
        </section>
      </div>
    </div>
  );
}
