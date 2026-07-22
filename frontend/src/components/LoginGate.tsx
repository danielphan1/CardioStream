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
import { useRef, useState } from "react";
import { Sailboat, TriangleAlert } from "lucide-react";

import { postAuth } from "../api/client";
import { useAuth } from "../store/auth";

export function LoginGate() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // A rejected login shows friendly copy ONLY — never a status code (D-10).
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.trim() === "" || submitting) return;
    setSubmitting(true);
    setRejected(false);
    try {
      const { token } = await postAuth(password);
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-foam)] px-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Sign in"
        className="flex w-full max-w-[28rem] flex-col gap-4 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 md:p-8"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Sailboat
            aria-hidden="true"
            size={40}
            className="text-[var(--color-ink)]"
          />
          <h1 className="text-[32px] font-bold leading-tight text-[var(--color-ink)]">
            Chris's Health Dashboard
          </h1>
          <h2 className="text-2xl font-bold leading-tight text-[var(--color-ink)]">
            Enter the password to continue
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="login-password"
            className="text-[20px] font-bold text-[var(--color-ink)]"
          >
            Password
          </label>
          <input
            ref={inputRef}
            id="login-password"
            name="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-4 text-lg text-[var(--color-ink)]"
          />
        </div>

        {/* Wrong-password notice (05-UI-SPEC error treatment): calm, no red, no
            status code — Body 18 in ink inside a sky panel with a TriangleAlert
            mark. Only rendered after a rejected attempt. */}
        {rejected && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-4 text-lg text-[var(--color-ink)]"
          >
            <TriangleAlert
              aria-hidden="true"
              size={24}
              className="mt-0.5 shrink-0"
            />
            <p>
              <span className="font-bold">That password didn't work.</span>{" "}
              Please try again.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={password.trim() === "" || submitting}
          className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-[20px] font-bold text-[var(--color-accent-text)] disabled:opacity-50"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
