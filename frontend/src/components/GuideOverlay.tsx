// Site guide overlay (D-01..D-13; 11-UI-SPEC.md's "Overlay stacking/layering",
// "Guide close control", "Table of contents", and "Per-section fixed format"
// sections are the authoritative, binding markup/class contract for this
// file). This is an always-mounted LANDMARK REGION that returns `null` when
// closed — NOT a modal. Unlike `LogoutConfirmDialog` (Header.tsx), it has no
// dialog role, no modal attribute, and traps no focus: `CommandBar` (and the
// live mic session it drives) must stay fully reachable — including by Tab —
// while the guide is open (D-03/D-04). Mount point (raising the CommandBar
// band above this overlay's z-layer) is deferred to Plan 11-05.
import { useEffect } from "react";
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

export function GuideOverlay() {
  const open = useGuide((s) => s.open);
  const setOpen = useGuide((s) => s.setOpen);

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

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Site guide"
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-foam)]"
    >
      <div className="sticky top-0 z-10 flex justify-end bg-[var(--color-foam)] px-4 py-2 md:px-8">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-[20px] font-bold text-[var(--color-ink)]"
        >
          <X aria-hidden="true" size={24} />
          Close
        </button>
      </div>

      {/* pt-24 (96px) is a pragmatic estimate of the pinned CommandBar band's
          rendered height (py-4 wrapping a min-h-12 row ≈ 80px, plus buffer).
          Plan 11-05's manual verification checkpoint re-checks this value
          against the band's real height (including taller voice-state
          sub-lines) once the overlay is actually mounted under it. */}
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pt-24 pb-16 md:px-8 xl:px-16">
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

        <section id="command-bar">
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

        <section id="filters">
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

        <section id="charts">
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

        <section id="overlay">
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

        <section id="voice-replies">
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

        <section id="upload">
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

        <section id="add-a-record">
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

        <section id="what-can-i-say">
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

        <section id="about-this-guide">
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
