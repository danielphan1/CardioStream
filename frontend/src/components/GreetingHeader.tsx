// GreetingHeader (quick 261003-hev, second pass) — the opening line both
// reference dashboards lead with: a large time-aware greeting over a quiet
// subtitle that says what the screen is currently showing.
//
// It is DECORATION PLUS ORIENTATION, never a control: no buttons, no inputs,
// nothing to reach by voice, so it adds no surface to the voice vocabulary and
// cannot strand the primary user. The subtitle restates the already-rendered
// reading count rather than introducing a new fact.
//
// The greeting is time-of-day derived locally — no new data, no new API call,
// and deliberately not personalised with a name the product does not store on
// the client.
import { useResolvedFilters, useStats } from "../hooks/useStats";

/** Local wall-clock buckets. Deliberately coarse: a greeting that flips at
 *  exactly 12:00 is a detail nobody benefits from being precise about. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function GreetingHeader() {
  // Reads the SAME query key the dashboard already uses, so TanStack Query
  // serves it from cache — this component adds no request. Doing it here
  // rather than taking props is what lets the greeting sit in the shell,
  // above the filter cluster, where both references put it.
  const resolved = useResolvedFilters();
  const stats = useStats(resolved);
  const greeting = greetingFor(new Date().getHours());
  const { data, isPending: isLoading } = stats;

  // One quiet line of orientation. While the count is still loading it says
  // nothing rather than guessing a number — an invented figure on a health
  // surface is worse than a blank.
  const subtitle =
    isLoading || data === undefined
      ? "Your blood pressure and pulse, at a glance."
      : data.count === 1
        ? "1 reading matches the filters below."
        : `${data.count} readings match the filters below.`;

  return (
    <div>
      <h2 className="text-display leading-tight text-[var(--color-depth)]">
        {greeting}
      </h2>
      <p className="mt-1 text-base font-normal text-[var(--color-muted)]">
        {subtitle}
      </p>
    </div>
  );
}
