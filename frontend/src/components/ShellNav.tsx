// ShellNav (16.1-03, UI-SPEC §5.1/§5.2) — the single home for the eight
// controls that live in today's header band: four destinations plus Theme,
// Voice Replies, Guide and Log out. Both shells render THIS component (the
// ≥1024px left rail and the <1024px nav panel, plans 16.1-05/06), so they can
// never disagree about what the controls are, what they say, or how they look.
//
// No `variant` prop. Every item is `w-full`; the rail (208px of content width)
// or the panel (full viewport width) owns the sizing. The ONE content-level
// difference between the two shells is `includeGuide` — see its prop comment.
//
// All colours are index.css var() tokens; there is no hex literal in this file
// (grep-gated). Only font weights 400 and 700 are used — `text-label` already
// carries 700, and Atkinson Hyperlegible ships only those two static files.
import { useRef, useState } from "react";
import {
  BookOpen,
  ClipboardPlus,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Table2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useHealth } from "../hooks/useHealth";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import { useAuth } from "../store/auth";
import { useGuide } from "../store/guide";
import { useSpeech } from "../store/speech";
import { useTheme } from "../store/theme";
import { useView } from "../store/view";
import type { View } from "../store/view";

// Item anatomy, shared by both groups (§5.1): 48px floor, 16px horizontal
// padding, 24px icon + 8px gap + text-label, left-aligned, full width, 2px
// border. `min-h-12` is the non-negotiable accessibility floor (CLAUDE.md) and
// is asserted on every button by ShellNav.test.tsx.
const ITEM_BASE =
  "flex min-h-12 w-full items-center gap-2 border-2 px-4 text-left text-label";

// Utility controls are NEVER accent-filled, even when toggled on: `aria-pressed`
// plus the label text ("Dark", "Voice Replies: On") carries the state. The
// accent fill is reserved for the selected destination. `rounded-lg` instead of
// `rounded-xl` is DESIGN.md's existing quiet tell that these are utilities.
const UTILITY_ITEM = `${ITEM_BASE} rounded-lg border-[var(--color-depth)] bg-[var(--color-mist)] text-[var(--color-depth)]`;

interface NavItem {
  view: View;
  label: string;
  Icon: LucideIcon;
  /** Hidden in guest demo, exactly as today's header does — the two write
   *  surfaces. The real gate is the backend's demo write rejection; this is a
   *  UX affordance only (T-16.1-08). */
  writeSurface: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Dashboard", Icon: LayoutDashboard, writeSurface: false },
  { view: "readings", label: "Readings", Icon: Table2, writeSurface: false },
  { view: "upload", label: "Upload", Icon: Upload, writeSurface: true },
  { view: "records", label: "Add Record", Icon: ClipboardPlus, writeSurface: true },
];

export function ShellNav({
  onNavigate,
  includeGuide = true,
}: {
  /** Called after a destination is selected, so the nav panel can dismiss
   *  itself (§5.2 dismiss route (c)). Utility toggles deliberately do NOT fire
   *  it — toggling the theme should not close the panel. */
  onNavigate?: () => void;
  /** Whether the Guide belongs in the utility group. The rail leaves this at
   *  its default `true`; the nav panel passes `false`.
   *
   *  This is a client decision (§5.2 superseding note, 2026-10-01), not a
   *  style choice. Below 1024px ShellNav renders ONLY inside the nav panel, so
   *  a Guide here would make Menu -> Guide the only route to the Guide. That
   *  produces `guideOpen` and `openOverlay === "nav"` simultaneously, and
   *  because both surfaces are `fixed z-50` with the panel later in tree
   *  order, the panel paints over GuideOverlay and tapping Guide appears to do
   *  nothing. Worse, GuideOverlay restores focus by looking up the Guide
   *  button's stable id, which would not exist with the panel closed —
   *  breaking the voice-opened guide path (`lib/agent.ts` setOpen) by dropping
   *  focus to `<body>` with no announcement. The Guide is therefore an
   *  always-visible slim-top-bar control below 1024px, and EXACTLY ONE element
   *  carrying that id exists in the DOM at any width. */
  includeGuide?: boolean;
}) {
  const view = useView((s) => s.view);
  const go = useView((s) => s.go);

  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);
  const isDark = theme === "dark";
  const speechEnabled = useSpeech((s) => s.enabled);
  const toggleSpeech = useSpeech((s) => s.toggleEnabled);
  const guideOpen = useGuide((s) => s.open);
  const toggleGuide = useGuide((s) => s.toggleOpen);
  const logout = useAuth((s) => s.logout);

  // Guest-demo detection (Phase 19, D-08): ShellNav is always mounted deep
  // inside the authed, QueryClientProvider-wrapped tree, so it safely reuses
  // the existing useHealth() hook (already polling /health every 60s for
  // AgentStatusBanner) — zero new fetch call.
  const demoMode = useHealth().data?.demo ?? false;

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // Return focus to the "Log out" control when the dialog closes (D-03).
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  function closeDialog() {
    setConfirmingLogout(false);
    logoutButtonRef.current?.focus();
  }

  function confirmLogout() {
    // Clears the token -> App falls back to the LoginGate (D-03). No need to
    // restore focus: the whole authed tree (this component) unmounts.
    logout();
  }

  function selectDestination(next: View) {
    go(next);
    onNavigate?.();
  }

  return (
    <>
      {/* Destinations. No "Back to dashboard" control: the Dashboard item now
          serves that purpose from every view, at every width. */}
      <nav aria-label="Main" className="flex flex-col gap-2">
        {NAV_ITEMS.filter((item) => !(item.writeSurface && demoMode)).map(
          ({ view: itemView, label, Icon }) => {
            const selected = view === itemView;
            return (
              <button
                key={itemView}
                type="button"
                onClick={() => selectDestination(itemView)}
                aria-current={selected ? "page" : undefined}
                className={`${ITEM_BASE} rounded-xl ${
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-text)]"
                    : "border-[var(--color-depth)] bg-[var(--color-mist)] text-[var(--color-depth)]"
                }`}
              >
                <Icon aria-hidden="true" size={24} />
                {label}
              </button>
            );
          },
        )}
      </nav>

      {/* 24px separation plus a 2px depth rule between the two groups (§5.1). */}
      <hr className="my-6 border-t-2 border-[var(--color-depth)]" />

      <div className="flex flex-col gap-2">
        {/* Theme toggle (D-15). */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={isDark}
          className={UTILITY_ITEM}
        >
          {isDark ? (
            <Moon aria-hidden="true" size={24} />
          ) : (
            <Sun aria-hidden="true" size={24} />
          )}
          {isDark ? "Dark" : "Light"}
        </button>

        {/* Voice Replies toggle (D-02, TTS-02) — mute/quiet control for the
            spoken-confirmation feature. */}
        <button
          type="button"
          onClick={toggleSpeech}
          aria-pressed={speechEnabled}
          className={UTILITY_ITEM}
        >
          {speechEnabled ? (
            <Volume2 aria-hidden="true" size={24} />
          ) : (
            <VolumeX aria-hidden="true" size={24} />
          )}
          {speechEnabled ? "Voice Replies: On" : "Voice Replies: Off"}
        </button>

        {/* Guide toggle (D-02, GUIDE-01/02/04) — rendered only for the rail;
            see the includeGuide prop comment for why the nav panel omits it.
            Label stays "Guide" in both states — the dedicated Close control
            inside the overlay already owns that verb (Copywriting Contract).
            The id is GuideOverlay's focus-restoration target and MUST survive
            this move: the shell makes the rail `inert` the instant guideOpen
            flips true, which synchronously blurs this button before any effect
            runs, so GuideOverlay cannot capture "what was focused before" and
            restores to this fixed id instead. */}
        {includeGuide && (
          <button
            id="guide-toggle-button"
            type="button"
            onClick={toggleGuide}
            aria-pressed={guideOpen}
            className={UTILITY_ITEM}
          >
            <BookOpen aria-hidden="true" size={24} />
            Guide
          </button>
        )}

        {/* Log out (D-03): opens the confirm dialog rather than logging out
            immediately (the no-expiry token means only a caregiver can
            re-enter the password). */}
        <button
          ref={logoutButtonRef}
          type="button"
          onClick={() => setConfirmingLogout(true)}
          className={UTILITY_ITEM}
        >
          <LogOut aria-hidden="true" size={24} />
          Log out
        </button>
      </div>

      {confirmingLogout && (
        <LogoutConfirmDialog onCancel={closeDialog} onConfirm={confirmLogout} />
      )}
    </>
  );
}
