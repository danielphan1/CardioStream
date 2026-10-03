// Unit tests for useDismissable (16.1-03) — the app's one disclosure-dismissal
// pattern, consumed by the nav panel (16.1-05) and the Filters/Dates popovers
// (16.1-07). The focus assertions are the ones that matter: a regression here
// strands a keyboard or switch-access user, and that user is the primary user.
//
// `closeButtonRef` is a plain mutable ref object, so these tests assign a real
// <button> into it before the open transition rather than rendering a harness
// component — the hook only ever calls `.current?.focus()`.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISMISSABLE_FADE_MS, useDismissable } from "./useDismissable";

const TRIGGER_ID = "menu-trigger-button";

function appendButton(id?: string): HTMLButtonElement {
  const button = document.createElement("button");
  if (id) button.id = id;
  document.body.appendChild(button);
  return button;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useDismissable escape handling", () => {
  it("calls onClose on Escape while open", () => {
    const onClose = vi.fn();
    renderHook(() => useDismissable({ open: true, onClose, triggerId: TRIGGER_ID }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while closed, and removes the listener on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() =>
      useDismissable({ open: false, onClose, triggerId: TRIGGER_ID }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();

    unmount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("useDismissable delayed unmount", () => {
  it("keeps mounted true for the full fade and drops it at DISMISSABLE_FADE_MS", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useDismissable({ open, onClose, triggerId: TRIGGER_ID }),
      { initialProps: { open: true } },
    );

    expect(result.current.mounted).toBe(true);

    rerender({ open: false });
    act(() => {
      vi.advanceTimersByTime(DISMISSABLE_FADE_MS - 1);
    });
    expect(result.current.mounted).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.mounted).toBe(false);
  });

  it("flips shown true only after the double requestAnimationFrame", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useDismissable({ open: true, onClose, triggerId: TRIGGER_ID }),
    );

    // Still opacity-0 on the mounting frame — that initial paint is what makes
    // the CSS transition actually animate instead of snapping.
    expect(result.current.shown).toBe(false);

    act(() => {
      vi.advanceTimersByTime(64);
    });
    expect(result.current.shown).toBe(true);
  });
});

describe("useDismissable focus management", () => {
  it("focuses the close button on open", () => {
    const closeButton = appendButton();
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useDismissable({ open, onClose, triggerId: TRIGGER_ID }),
      { initialProps: { open: false } },
    );

    result.current.closeButtonRef.current = closeButton;
    rerender({ open: true });

    expect(document.activeElement).toBe(closeButton);
  });

  it("returns focus to the trigger by id on a real open-to-close transition", () => {
    const trigger = appendButton(TRIGGER_ID);
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useDismissable({ open, onClose, triggerId: TRIGGER_ID }),
      { initialProps: { open: true } },
    );

    expect(document.activeElement).not.toBe(trigger);

    rerender({ open: false });

    expect(document.activeElement).toBe(trigger);
  });

  it("does not move focus on first mount with open: false (the wasOpenRef guard)", () => {
    const trigger = appendButton(TRIGGER_ID);
    const unrelated = appendButton("unrelated");
    unrelated.focus();
    const onClose = vi.fn();

    renderHook(() => useDismissable({ open: false, onClose, triggerId: TRIGGER_ID }));

    // Without the wasOpenRef seed this would steal focus to the trigger on
    // every view switch and on initial login.
    expect(document.activeElement).toBe(unrelated);
    expect(document.activeElement).not.toBe(trigger);
  });

  it("does not move focus on first mount with open: true (quick 261002-kem)", () => {
    const unrelated = appendButton("unrelated");
    unrelated.focus();
    const onClose = vi.fn();
    const closeButton = appendButton();

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useDismissable({ open, onClose, triggerId: TRIGGER_ID }),
      { initialProps: { open: true } },
    );
    result.current.closeButtonRef.current = closeButton;
    // A re-render while still open must not re-run the focus move either —
    // this is the half the ref assignment above can actually observe.
    rerender({ open: true });

    // AssistantPopup can mount already open (its dismissal is persisted), and
    // focusing Close there would steal focus on page load.
    expect(document.activeElement).toBe(unrelated);
    expect(document.activeElement).not.toBe(closeButton);
  });

  it("tolerates a triggerId that is not in the DOM", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useDismissable({ open, onClose, triggerId: "nonexistent-trigger" }),
      { initialProps: { open: true } },
    );

    expect(() => rerender({ open: false })).not.toThrow();
  });
});
