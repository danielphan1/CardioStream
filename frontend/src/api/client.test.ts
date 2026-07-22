// Behavior tests for the auth-aware client layer (SEC-01, plan 05-04).
// Locks the Bearer-attachment contract, the 401→auto-logout seam (T-05-11),
// and the multipart postFile helper that MUST NOT set Content-Type (Pitfall 6).
//
// `fetch` is the only mock — the real ApiError, the real authHeaders, and the
// real zustand `useAuth` store run so the out-of-tree getState() seam is
// exercised end to end. localStorage is jsdom-backed (setup.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { useAuth } from "../store/auth";
import { ApiError, getJson, postFile, postJson, postAuth } from "./client";

const STORAGE_KEY = "hv-token";

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function statusResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Reset the store + persisted token before every test.
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  useAuth.setState({ token: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Extract the headers object fetch was called with on call index `i`. */
function headersOf(i: number): Record<string, string> {
  const init = fetchMock.mock.calls[i][1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

describe("useAuth store", () => {
  it("starts with a null token on empty localStorage", () => {
    expect(useAuth.getState().token).toBeNull();
  });

  it("login sets the token and persists it to localStorage", () => {
    useAuth.getState().login("tok-123");
    expect(useAuth.getState().token).toBe("tok-123");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("tok-123");
  });

  it("logout clears the token and removes it from localStorage (D-03)", () => {
    useAuth.getState().login("tok-123");
    useAuth.getState().logout();
    expect(useAuth.getState().token).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("client Bearer attachment (SEC-01)", () => {
  it("attaches Authorization: Bearer <token> on getJson when a token is present", async () => {
    useAuth.getState().login("tok-abc");
    fetchMock.mockResolvedValue(okResponse([]));

    await getJson("/readings");

    expect(headersOf(0).Authorization).toBe("Bearer tok-abc");
  });

  it("omits Authorization on getJson when no token is present", async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    await getJson("/readings");

    expect(headersOf(0).Authorization).toBeUndefined();
  });

  it("attaches the Bearer header on postJson too", async () => {
    useAuth.getState().login("tok-post");
    fetchMock.mockResolvedValue(okResponse({}));

    await postJson("/agent", { text: "hi" });

    expect(headersOf(0).Authorization).toBe("Bearer tok-post");
  });
});

describe("401 auto-logout (T-05-11)", () => {
  it("clears the token on a 401 and still throws ApiError (raw text never returned)", async () => {
    useAuth.getState().login("stale-token");
    fetchMock.mockResolvedValue(statusResponse(401));

    await expect(getJson("/readings")).rejects.toBeInstanceOf(ApiError);
    expect(useAuth.getState().token).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does NOT log out on a non-401 error", async () => {
    useAuth.getState().login("good-token");
    fetchMock.mockResolvedValue(statusResponse(500));

    await expect(getJson("/readings")).rejects.toBeInstanceOf(ApiError);
    expect(useAuth.getState().token).toBe("good-token");
  });

  it("logs out on a 401 from postFile", async () => {
    useAuth.getState().login("stale-token");
    fetchMock.mockResolvedValue(statusResponse(401));
    const file = new File(["x"], "omron.xlsx");

    await expect(postFile("/upload", file)).rejects.toBeInstanceOf(ApiError);
    expect(useAuth.getState().token).toBeNull();
  });
});

describe("postFile multipart (Pitfall 6)", () => {
  it("sends a FormData body and never sets a Content-Type header", async () => {
    useAuth.getState().login("tok-file");
    fetchMock.mockResolvedValue(okResponse({ added: 1 }));
    const file = new File(["data"], "omron.xlsx");

    await postFile("/upload", file);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    // The browser MUST set the multipart boundary — we never set Content-Type.
    const headers = headersOf(0);
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer tok-file");
  });

  it("throws ApiError on a network failure (status 0), never raw text", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    const file = new File(["data"], "omron.xlsx");

    await expect(postFile("/upload", file)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("postAuth wrapper", () => {
  it("POSTs { password } to /auth and returns the token", async () => {
    fetchMock.mockResolvedValue(okResponse({ token: "issued-token" }));

    const result = await postAuth("hunter2");

    expect(result).toEqual({ token: "issued-token" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ password: "hunter2" });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth");
  });
});
