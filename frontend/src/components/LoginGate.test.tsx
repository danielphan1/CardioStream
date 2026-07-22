// Behavior tests for the auth gate (SEC-01, D-01/D-04, plan 05-04).
// Locks: the whole app is gated — nothing renders and NO data fetch fires until
// a token exists (D-01, T-05-10); the caregiver keyboard ritual (empty field
// disables Enter, Enter submits); a rejected login shows friendly copy, never a
// status code (D-10); a successful login persists the token via useAuth.login.
//
// postAuth is the only mock (the real useAuth store + real ApiError run). fetch
// is stubbed so the gating test can PROVE no data request fires pre-auth.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import App from "../App";
import { ApiError, postAuth } from "../api/client";
import { useAuth } from "../store/auth";
import { LoginGate } from "./LoginGate";

// Keep the real module (ApiError, getJson, useAuth seam) — replace only postAuth.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, postAuth: vi.fn() };
});

const mockPostAuth = postAuth as unknown as Mock;

let fetchMock: Mock;

beforeEach(() => {
  mockPostAuth.mockReset();
  fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    localStorage.removeItem("hv-token");
  } catch {
    /* ignore */
  }
  useAuth.setState({ token: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function passwordInput(): HTMLInputElement {
  return screen.getByLabelText("Password") as HTMLInputElement;
}

describe("App auth gate (D-01, T-05-10)", () => {
  function renderApp() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
  }

  it("renders ONLY the LoginGate and fires NO data fetch when no token exists", () => {
    renderApp();

    // The password field proves the gate is up.
    expect(passwordInput()).toBeInTheDocument();
    // Dashboard chrome is absent: the CommandBar textbox never mounts.
    expect(
      screen.queryByRole("textbox", { name: "Type a dashboard command" }),
    ).not.toBeInTheDocument();
    // The hard D-01 guarantee: no data hook mounted → fetch never called.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the dashboard (not the gate) once a token is present", async () => {
    useAuth.setState({ token: "valid-token" });
    renderApp();

    // Dashboard chrome mounts; the password field is gone.
    expect(
      await screen.findByRole("textbox", { name: "Type a dashboard command" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
});

describe("LoginGate keyboard ritual (D-04, SEC-01)", () => {
  it("uses a native password input (not voice-operable)", () => {
    render(<LoginGate />);
    expect(passwordInput().type).toBe("password");
  });

  it("disables the Enter button until the field is non-empty", () => {
    render(<LoginGate />);
    const enter = screen.getByRole("button", { name: "Enter" });
    expect(enter).toBeDisabled();

    fireEvent.change(passwordInput(), { target: { value: "hunter2" } });
    expect(enter).not.toBeDisabled();
  });

  it("calls postAuth then useAuth.login on a successful submit", async () => {
    mockPostAuth.mockResolvedValue({ token: "issued-token" });
    render(<LoginGate />);

    fireEvent.change(passwordInput(), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));

    await waitFor(() =>
      expect(useAuth.getState().token).toBe("issued-token"),
    );
    expect(mockPostAuth).toHaveBeenCalledWith("hunter2");
  });

  it("submits on the Enter key (form submit === clicking Enter)", async () => {
    mockPostAuth.mockResolvedValue({ token: "issued-token" });
    render(<LoginGate />);

    const input = passwordInput();
    fireEvent.change(input, { target: { value: "hunter2" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(mockPostAuth).toHaveBeenCalledWith("hunter2"));
  });

  it("shows friendly wrong-password copy (never a status code) and refocuses", async () => {
    mockPostAuth.mockRejectedValue(new ApiError(401, "/auth"));
    render(<LoginGate />);

    const input = passwordInput();
    fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));

    expect(
      await screen.findByText("That password didn't work. Please try again."),
    ).toBeInTheDocument();
    // No status code / raw error text ever surfaces (D-10).
    expect(screen.queryByText(/401/)).not.toBeInTheDocument();
    expect(screen.queryByText(/API request failed/)).not.toBeInTheDocument();
    // Token stays null; focus returns to the input for a retry.
    expect(useAuth.getState().token).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(input));
  });
});
