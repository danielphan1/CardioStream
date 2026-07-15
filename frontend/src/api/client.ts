// Typed fetch wrapper for the read API (API-01/API-02).
// Failures throw ApiError — the UI renders UI-SPEC error copy ("Couldn't load
// the readings") and NEVER surfaces raw status text, codes, or stack traces.
import type { Reading, ResolvedFilters, StatsSummary } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, path: string) {
    super(`API request failed (${status}) for ${path}`);
    this.name = "ApiError";
    this.status = status;
  }
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
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`);
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) throw new ApiError(res.status, path);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}

export function getReadings(filters: ResolvedFilters): Promise<Reading[]> {
  return getJson<Reading[]>("/readings", filters);
}

export function getStatsSummary(
  filters: ResolvedFilters,
): Promise<StatsSummary> {
  return getJson<StatsSummary>("/stats/summary", filters);
}
