// Header (DASH-11) — standalone nautical design per D-01; the old Tableau
// prototype is explicitly NOT a visual reference. Sailboat mark + Display
// title + labeled theme toggle (D-15) + decorative wave divider (D-16).
//
// Phase 5 (D-06) adds the discreet caregiver-controls zone in the header-right
// flex row: a view toggle ("Upload" / "Back to dashboard") and a "Log out"
// control that opens a confirm dialog. Both are styled like the theme toggle
// (2px ink border, sky surface, icon + text label) and are NEVER accent-filled
// — the accent fill is reserved for the UI-SPEC list, which excludes these.
// They are exempt from the 48px floor (D-06, Accessibility Scope) so Chris's
// large voice/chart UI stays visually dominant, but keep the inherited 3px
// focus ring and full keyboard operability.
// All colors are index.css tokens — no hex values here.
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ClipboardPlus,
  LogOut,
  Moon,
  Sailboat,
  Sun,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useAuth } from "../store/auth";
import { useGuide } from "../store/guide";
import { useSpeech } from "../store/speech";
import { useTheme } from "../store/theme";
import { useView } from "../store/view";

/** Logout confirm dialog (D-03) — a lightweight centered modal justified by the
 *  no-expiry token: Chris cannot re-enter the password himself (D-02), so an
 *  accidental logout ends his hands-free session. Escape and backdrop-click both
 *  cancel; focus is trapped inside and returns to the "Log out" control on close
 *  (handled by the caller). Transition is a ≤250ms opacity fade, disabled under
 *  prefers-reduced-motion. */
function LogoutConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the least-destructive control (Cancel) when the dialog opens.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape cancels; Tab is trapped within the dialog's focusable controls.
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      // Dimmed backdrop; backdrop-click cancels (guarded to the backdrop itself
      // so a click inside the card does not close it).
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 motion-reduce:transition-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-body"
        onKeyDown={handleKeyDown}
        className="flex w-full max-w-[28rem] flex-col gap-4 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-[var(--color-ink)]"
      >
        <h2
          id="logout-title"
          className="text-2xl font-bold leading-tight text-[var(--color-ink)]"
        >
          Log out?
        </h2>
        <p id="logout-body" className="text-lg text-[var(--color-ink)]">
          You'll need the password to unlock the dashboard again.
        </p>
        <div className="flex justify-end gap-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-[20px] font-bold text-[var(--color-ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-[20px] font-bold text-[var(--color-accent-text)]"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);
  const isDark = theme === "dark";
  const speechEnabled = useSpeech((s) => s.enabled);
  const toggleSpeech = useSpeech((s) => s.toggleEnabled);
  const guideOpen = useGuide((s) => s.open);
  const toggleGuide = useGuide((s) => s.toggleOpen);

  const view = useView((s) => s.view);
  const go = useView((s) => s.go);
  const logout = useAuth((s) => s.logout);

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // Return focus to the "Log out" control when the dialog closes (D-03).
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  const onDashboard = view === "dashboard";

  function closeDialog() {
    setConfirmingLogout(false);
    logoutButtonRef.current?.focus();
  }

  function confirmLogout() {
    // Clears the token → App falls back to the LoginGate (D-03). No need to
    // restore focus: the whole authed tree (this Header) unmounts.
    logout();
  }

  return (
    <header className="bg-[var(--color-foam)]">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-2">
          <Sailboat
            aria-hidden="true"
            size={32}
            className="shrink-0 text-[var(--color-ink)]"
          />
          <h1 className="text-[32px] font-bold leading-tight text-[var(--color-ink)]">
            Chris's Health Dashboard
          </h1>
        </div>

        {/* Header-right controls: theme toggle + the D-06 caregiver zone. Every
            control is icon + text (never icon-only) and styled as an inactive
            control (border, not accent fill) — the navy accent fill is reserved
            for the UI-SPEC list, which excludes all of these. */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Theme toggle (D-15). */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={isDark}
            className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
          >
            {isDark ? (
              <Moon aria-hidden="true" size={24} />
            ) : (
              <Sun aria-hidden="true" size={24} />
            )}
            {isDark ? "Dark" : "Light"}
          </button>

          {/* Voice Replies toggle (D-02, TTS-02) — mute/quiet control for the
              spoken-confirmation feature; styled identically to the Theme
              toggle above (icon + text, aria-pressed, >=48px, bordered sky
              surface, never accent-filled). */}
          <button
            type="button"
            onClick={toggleSpeech}
            aria-pressed={speechEnabled}
            className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
          >
            {speechEnabled ? (
              <Volume2 aria-hidden="true" size={24} />
            ) : (
              <VolumeX aria-hidden="true" size={24} />
            )}
            {speechEnabled ? "Voice Replies: On" : "Voice Replies: Off"}
          </button>

          {/* Guide toggle (D-02, GUIDE-01/02/04) — opens/closes the full-site
              guide overlay; styled identically to the Theme/Voice Replies
              toggles above (icon + text, aria-pressed, >=48px, bordered sky
              surface, never accent-filled). Label stays "Guide" in both
              states — the dedicated Close (X) control inside the overlay
              already owns that verb (11-UI-SPEC.md Copywriting Contract). */}
          <button
            type="button"
            onClick={toggleGuide}
            aria-pressed={guideOpen}
            className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
          >
            <BookOpen aria-hidden="true" size={24} />Guide</button>

          {/* View toggle (D-06, widened to three states by Phase 8 D-01):
              "Upload" + "Add Record" show together on the dashboard; either
              non-dashboard view shows exactly one "Back to dashboard" button.
              Discreet — exempt from the 48px floor. */}
          {onDashboard ? (
            <>
              <button
                type="button"
                onClick={() => go("upload")}
                className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]"
              >
                <Upload aria-hidden="true" size={24} />
                Upload
              </button>
              <button
                type="button"
                onClick={() => go("records")}
                className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]"
              >
                <ClipboardPlus aria-hidden="true" size={24} />
                Add Record
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => go("dashboard")}
              className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]"
            >
              <Upload aria-hidden="true" size={24} />
              Back to dashboard
            </button>
          )}

          {/* Log out (D-03): opens the confirm dialog rather than logging out
              immediately (the no-expiry token means only a caregiver can
              re-enter the password). */}
          <button
            ref={logoutButtonRef}
            type="button"
            onClick={() => setConfirmingLogout(true)}
            className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]"
          >
            <LogOut aria-hidden="true" size={24} />
            Log out
          </button>
        </div>
      </div>

      {/* Wave-curve divider (D-16) — decorative only, flips to deep sea in
          dark theme via the --color-sky token. No imagery behind data. */}
      <svg
        aria-hidden="true"
        className="block h-6 w-full"
        viewBox="0 0 1440 24"
        preserveAspectRatio="none"
      >
        <path
          d="M0 12 C 120 0, 240 24, 360 12 C 480 0, 600 24, 720 12 C 840 0, 960 24, 1080 12 C 1200 0, 1320 24, 1440 12 L 1440 24 L 0 24 Z"
          fill="var(--color-sky)"
        />
      </svg>

      {confirmingLogout && (
        <LogoutConfirmDialog onCancel={closeDialog} onConfirm={confirmLogout} />
      )}
    </header>
  );
}
