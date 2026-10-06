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
  const hasCount = !isLoading && data !== undefined;

  // Greeting and subtitle are steps 1 and 2 of ONE rise that passes through
  // the page — the rail crested first (LeftRail), the KPI cards continue the
  // same ladder from step 3 (StatsStrip). The offsets are cumulative across
  // groups on purpose: a per-group reset would start the first KPI card at the
  // same instant as the rail, and the whole point is a single wave with a
  // stated direction. Do not re-derive these multipliers.
  return (
    <div>
      <h2
        className="text-display leading-tight text-[var(--color-depth)] motion-safe:animate-[swell-rise_var(--dur-crest)_var(--ease-swell)_both]"
        style={{ animationDelay: "calc(var(--stagger-step) * 1)" }}
      >
        {greeting}
      </h2>
      <p
        className="mt-1 text-base font-normal text-[var(--color-muted)] motion-safe:animate-[swell-rise_var(--dur-crest)_var(--ease-swell)_both]"
        style={{ animationDelay: "calc(var(--stagger-step) * 2)" }}
      >
        {hasCount ? (
          <>
            {/* The number is the only FACT on this line, and it was the
                quietest thing on it. Full ink at 700 against the muted 400
                remainder — a typographic promotion, not a copy change: the
                sentence is byte-identical, only its markup is split. The
                count stays a single text node of its own element so a test
                can still assert the interpolated VALUE, not just the copy. */}
            <span className="font-bold text-[var(--color-depth)]">
              {data.count}
            </span>
            {data.count === 1
              ? " reading matches the filters below."
              : " readings match the filters below."}
          </>
        ) : (
          "Your blood pressure and pulse, at a glance."
        )}
      </p>
    </div>
  );
}
