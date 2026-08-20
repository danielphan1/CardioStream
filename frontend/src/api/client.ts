// Typed fetch wrapper for the read API (API-01/API-02).
// Failures throw ApiError — the UI renders UI-SPEC error copy ("Couldn't load
// the readings") and NEVER surfaces raw status text, codes, or stack traces.
import { useAuth } from "../store/auth";
import type {
  AgentReply,
  AgentRequest,
  HealthStatus,
  Reading,
  ResolvedFilters,
  StatsSummary,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, path: string) {
    super(`API request failed (${status}) for ${path}`);
    this.name = "ApiError";
    this.status = status;
  }
}

// Attach the shared-password Bearer token (SEC-01) when one is present; omit the
// header entirely when logged out. Read out-of-tree via getState() (mirrors
// main.tsx's useTheme.getState()) so every request carries the token without
// threading it through React props.
function authHeaders(): Record<string, string> {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A 401 means the token is missing/forged/stale (T-05-11) — clear it so the app
// returns to the LoginGate. Raw text still NEVER renders: callers only ever see
// ApiError. Centralized here so every request path (getJson/postJson/postFile)
// shares the one auto-logout seam.
function handleUnauthorized(status: number): void {
  if (status === 401) useAuth.getState().logout();
}

export async function getJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  const qs = search.toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
      headers: { ...authHeaders() },
    });
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new ApiError(res.status, path);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}

/**
 * Typed POST mirror of getJson (API-04/VOICE-08). Same three-branch ApiError
 * discipline: ApiError(0) on fetch throw (network/CORS), ApiError(status) on
 * !res.ok, ApiError(status) on unparseable 2xx body. Raw errors NEVER render.
 */
export async function postJson<TBody, TRes>(
  path: string,
  body: TBody,
): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new ApiError(res.status, path);
  }
  try {
    return (await res.json()) as TRes;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}

/**
 * Multipart upload helper (DASH-10 caregiver upload). Sends the file as
 * FormData with the Bearer header but WITHOUT a Content-Type — the browser
 * MUST set the multipart boundary itself (Pitfall 6: setting Content-Type here
 * strips the boundary and the backend cannot parse the part). Same three-branch
 * ApiError discipline + 401→logout as the JSON helpers.
 */
export async function postFile<TRes>(path: string, file: File): Promise<TRes> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { ...authHeaders() }, // NO Content-Type — browser sets boundary
      body: form,
    });
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new ApiError(res.status, path);
  }
  try {
    return (await res.json()) as TRes;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}

// The identical call voice will drive in Phase 4 (VOICE-08) — one code path.
export function postAgent(body: AgentRequest): Promise<AgentReply> {
  return postJson<AgentRequest, AgentReply>("/agent", body);
}

// Exchange the shared password for a signed Bearer token (SEC-01). Mirrors
// postAgent — one typed wrapper over the generic postJson path.
export function postAuth(password: string): Promise<{ token: string }> {
  return postJson<{ password: string }, { token: string }>("/auth", {
    password,
  });
}

export function getReadings(filters: ResolvedFilters): Promise<Reading[]> {
  return getJson<Reading[]>("/readings", filters);
}

export function getStatsSummary(
  filters: ResolvedFilters,
): Promise<StatsSummary> {
  return getJson<StatsSummary>("/stats/summary", filters);
}

// Liveness poll (Phase 6, LIVE-03) — ungated route; getJson's Authorization
// header attach is harmless here since /health ignores it either way.
export function getHealth(): Promise<HealthStatus> {
  return getJson<HealthStatus>("/health");
}
