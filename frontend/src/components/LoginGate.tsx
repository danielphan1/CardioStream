// LoginGate (SEC-01, D-01/D-04) — the full-screen shared-password gate that
// wraps the whole app. Until useAuth holds a token, App renders ONLY this
// component: no header, no dashboard chrome, no data fetch (D-01, no pre-auth
// data leak — T-05-10).
//
// Accessibility scope (05-UI-SPEC "Accessibility Scope"): this is the caregiver
// keyboard-entry ritual — deliberately EXEMPT from the voice-operable rule (the
// secret never travels the voice path, D-04) but still REQUIRED to be ≥18px,
// high-contrast, and fully keyboard-operable with the inherited 3px focus ring.
// A normal <input type="password"> is the correct, secure control here.
//
// Nautical card + accent button styling copied from EmptyState.tsx; all colors
// are index.css design tokens — no hex values.
import { useEffect, useRef, useState } from "react";
import { Sailboat, TriangleAlert } from "lucide-react";

import { getHealth, postAuth } from "../api/client";
import { useAuth } from "../store/auth";

export function LoginGate() {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // A rejected login shows friendly copy ONLY — never a status code (D-10).
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Guest-demo detection (Phase 19, D-01/D-08): the ONLY pre-auth fetch this
  // component makes, scoped to /health (T-05-10 preserved). This is a plain
  // useEffect + the raw getHealth() client function, NOT useHealth()'s
  // TanStack Query hook — LoginGate renders standalone in unit tests with no
  // QueryClientProvider ancestor. A failed fetch is treated as "assume real
  // deployment": the form still works, worst case the username field never
  // appears.
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => {
    getHealth()
      .then((h) => setDemoMode(h.demo))
      .catch(() => {});
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if ((demoMode && username.trim() === "") || password.trim() === "" || submitting)
      return;
    setSubmitting(true);
    setRejected(false);
    try {
      const { token } = await postAuth(password, demoMode ? username : undefined);
      // Persist + flip the gate open (D-02 no-expiry via the store).
      useAuth.getState().login(token);
    } catch {
      // Any failure (wrong password → 401, network, etc.) collapses to the one
      // calm notice; the raw ApiError never renders. Focus returns to the input
      // so the caregiver can retry immediately.
      setRejected(true);
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-deck)] px-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Sign in"
        className="flex w-full max-w-[28rem] flex-col gap-4 rounded-xl bg-[var(--color-mist)] p-6 md:p-8 shadow-[var(--shadow-elevation)]"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Sailboat
            aria-hidden="true"
            size={40}
            className="text-[var(--color-depth)]"
          />
          <h1 className="text-heading leading-tight text-[var(--color-depth)]">
            Chris's Health Dashboard
          </h1>
          {/* An instruction sentence, not a section heading. It previously
              carried the h1's exact classes, so the screen rendered two
              identical "headings" and had no hierarchy at all; as an h2 it
              also announced a second section to a screen reader that does not
              exist. Body copy, with the h1 left as the screen's only heading. */}
          <p className="text-base text-[var(--color-depth)]">
            {demoMode
              ? "Enter your guest credentials to continue"
              : "Enter the password to continue"}
          </p>
        </div>

        {demoMode && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-username"
              className="text-label text-[var(--color-depth)]"
            >
              Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-[var(--color-hairline)] bg-[var(--color-deck)] px-4 text-base text-[var(--color-depth)]"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="login-password"
            className="text-label text-[var(--color-depth)]"
          >
            Password
          </label>
          <input
            ref={inputRef}
            id="login-password"
            name="password"
            type="password"
            autoFocus={!demoMode}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-[var(--color-hairline)] bg-[var(--color-deck)] px-4 text-base text-[var(--color-depth)]"
          />
        </div>

        {/* Wrong-password notice (05-UI-SPEC error treatment): calm, no red, no
            status code — Body 18 in ink inside a sky panel with a TriangleAlert
            mark. Only rendered after a rejected attempt. */}
        {rejected && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-[var(--color-mist)] p-4 text-base text-[var(--color-depth)] shadow-[var(--shadow-elevation)]"
          >
            {/* optical alignment: 2px centres the 24px icon on the 27px first
                text line (deliberately off the 4px spacing scale) */}
            <TriangleAlert
              aria-hidden="true"
              size={24}
              className="mt-0.5 shrink-0"
            />
            <p>
              <span className="font-bold">
                {demoMode
                  ? "That username or password didn't work."
                  : "That password didn't work."}
              </span>{" "}
              Please try again.
            </p>
          </div>
        )}

        {/* Disabled = DESIGN.md's Dashed-Border Rule (2px dashed Ink on a
            Sky/mist fill), never a dimmed solid: the old 50%-opacity fade
            took brass-on-deck from 5.9:1 to roughly 2.6:1, under the WCAG
            4.5:1 floor, on the app's front door in its most common state.
            depth-on-mist measures 14.1:1 (light) / 14.4:1 (dark). The base
            accent border is solid so the box does not resize when state flips. */}
        <button
          type="submit"
          disabled={
            (demoMode && username.trim() === "") ||
            password.trim() === "" ||
            submitting
          }
          className="press-swell min-h-12 rounded-xl border-2 border-[var(--color-accent)] bg-[var(--color-accent)] px-6 text-label text-[var(--color-accent-text)] disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-[var(--color-depth)] disabled:bg-[var(--color-mist)] disabled:text-[var(--color-depth)]"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
