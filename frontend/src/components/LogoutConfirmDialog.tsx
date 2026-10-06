// Extracted verbatim out of Header.tsx (16.1-03) because plan 16.1-06 deletes
// that header and this dialog has to outlive it. Body, props, copy, classes
// and focus trap are unchanged — UI-SPEC §8 lists this component as not
// modified by this phase.
//
// This is the app's ONE true modal, and the one place a focus trap is correct:
// a destructive confirmation where trapping is the right behaviour. Everything
// else in the shell redesign (the nav panel, the Filters/Dates popovers, and
// GuideOverlay already) is a non-trapping disclosure via useDismissable, so
// the mic and the Command Bar stay Tab-reachable (D-03/D-04, §5.5). Do not add
// a trap anywhere else, and do not remove this one.
import { useEffect, useRef } from "react";

/** Logout confirm dialog (D-03) — a lightweight centered modal justified by the
 *  no-expiry token: Chris cannot re-enter the password himself (D-02), so an
 *  accidental logout ends his hands-free session. Escape and backdrop-click both
 *  cancel; focus is trapped inside and returns to the "Log out" control on close
 *  (handled by the caller). Transition is a ≤250ms opacity fade, disabled under
 *  prefers-reduced-motion. */
export function LogoutConfirmDialog({
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
        className="flex w-full max-w-[28rem] flex-col gap-4 rounded-xl bg-[var(--color-mist)] p-6 text-[var(--color-depth)] shadow-[var(--shadow-elevation)]"
      >
        <h2
          id="logout-title"
          className="text-heading leading-tight text-[var(--color-depth)]"
        >
          Log out?
        </h2>
        <p id="logout-body" className="text-base text-[var(--color-depth)]">
          You'll need the password to unlock the dashboard again.
        </p>
        <div className="flex justify-end gap-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="press-swell min-h-12 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-mist)] px-6 text-label text-[var(--color-depth)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="press-swell min-h-12 rounded-xl bg-[var(--color-accent)] px-6 text-label text-[var(--color-accent-text)]"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
