// Header (DASH-11) — standalone nautical design per D-01; the old Tableau
// prototype is explicitly NOT a visual reference. Sailboat mark + Display
// title + labeled theme toggle (D-15) + decorative wave divider (D-16).
// All colors are index.css tokens — no hex values here.
import { Moon, Sailboat, Sun } from "lucide-react";

import { useTheme } from "../store/theme";

export function Header() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <header className="bg-[var(--color-foam)]">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-2">
          <Sailboat
            aria-hidden="true"
            size={32}
            className="shrink-0 text-[var(--color-ink)]"
          />
          <h1 className="text-[32px] font-bold leading-tight text-[var(--color-ink)]">
            Chris's Health Dashboard
          </h1>
        </div>

        {/* Theme toggle (D-15): ALWAYS icon + text label, never icon-only.
            Styled as an inactive control — the navy accent fill is reserved
            for the UI-SPEC list, which excludes this toggle. */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={isDark}
          className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
        >
          {isDark ? (
            <Moon aria-hidden="true" size={24} />
          ) : (
            <Sun aria-hidden="true" size={24} />
          )}
          {isDark ? "Dark" : "Light"}
        </button>
      </div>

      {/* Wave-curve divider (D-16) — decorative only, flips to deep sea in
          dark theme via the --color-sky token. No imagery behind data. */}
      <svg
        aria-hidden="true"
        className="block h-6 w-full"
        viewBox="0 0 1440 24"
        preserveAspectRatio="none"
      >
        <path
          d="M0 12 C 120 0, 240 24, 360 12 C 480 0, 600 24, 720 12 C 840 0, 960 24, 1080 12 C 1200 0, 1320 24, 1440 12 L 1440 24 L 0 24 Z"
          fill="var(--color-sky)"
        />
      </svg>
    </header>
  );
}
