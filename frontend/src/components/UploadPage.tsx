// UploadPage (DASH-10, D-07/D-08/D-09/D-10) — the caregiver-only surface that
// ingests an OMRON .xlsx export and reports the result in plain language.
//
// Accessibility scope (05-UI-SPEC "Accessibility Scope"): this screen is
// occasional caregiver admin, never operated by Chris — deliberately EXEMPT from
// the voice-operable / mandatory-48px rules (a standard OS file-picker button is
// allowed, D-07) but still REQUIRED to be ≥18px, high-contrast, and fully
// keyboard-operable with the inherited 3px focus ring.
//
// Error discipline (D-10, T-05-13): a 400 maps to the non-OMRON copy, any other
// failure to the generic copy — NEVER a status code, traceback, or health value
// (reject reasons come value-free from the backend). Mirrors App.tsx's
// centralized "only UI-SPEC copy renders" rule.
import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileUp,
  TriangleAlert,
} from "lucide-react";

import { ApiError, postFile } from "../api/client";
import type { IngestSummary } from "../api/types";
import { fmtLongDate } from "../lib/dates";

// D-09 result-sentence assembly (the 5 UI-SPEC rules). Sentences, not tiles.
function assembleSentences(summary: IngestSummary): string[] {
  const { added, updated, unchanged, rejected, total, latest } = summary;
  const sentences: string[] = [];

  // 1. Always shown.
  sentences.push(`Added ${added} new ${added === 1 ? "reading" : "readings"}.`);
  // 2. Only when something actually changed (keeps the common case verbatim).
  if (updated > 0) {
    sentences.push(
      `Updated ${updated} ${updated === 1 ? "reading" : "readings"} that changed.`,
    );
  }
  // 3. Always shown ("1 was" / "N were") — zero shows for reassurance.
  sentences.push(
    `${unchanged} ${unchanged === 1 ? "was" : "were"} already on file.`,
  );
  // 4. Always shown (matches the endorsed "0 skipped.").
  sentences.push(`${rejected.length} skipped.`);
  // 5. Only when the DB has data after the merge.
  if (total > 0 && latest !== null) {
    sentences.push(`Your data now goes through ${fmtLongDate(latest)}.`);
  }

  return sentences;
}

type UploadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: IngestSummary }
  // "not-omron" = a 400 (bad/unparseable file); "generic" = any other failure.
  | { status: "error"; kind: "not-omron" | "generic" };

export function UploadPage() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [filename, setFilename] = useState<string | null>(null);
  // Optional per-row reject disclosure (D-10) — collapsed by default.
  const [showRejects, setShowRejects] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setShowRejects(false);
    setState({ status: "loading" });
    try {
      // D-08: ingest immediately on select — no preview/confirm step.
      const summary = await postFile<IngestSummary>("/upload", file);
      setState({ status: "success", summary });
    } catch (err) {
      // Only UI-SPEC copy renders (T-05-13). A 400 is the never-500 backstop's
      // "not-omron" signal; everything else collapses to the generic notice.
      const kind =
        err instanceof ApiError && err.status === 400 ? "not-omron" : "generic";
      setState({ status: "error", kind });
    }
  }

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-8 bg-[var(--color-foam)] px-4 py-8 md:px-8 xl:px-16">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold leading-tight text-[var(--color-ink)]">
          Add new readings
        </h2>
        <p className="text-lg text-[var(--color-ink)]">
          Choose the .xlsx file you exported from the OMRON app. New readings are
          added automatically — uploading the same file twice is safe.
        </p>
      </div>

      {/* Styled label wraps a visually-hidden native file input (D-07). The
          label is the large accent affordance (≥48px); the native OS button it
          triggers is browser-sized and exempt from the 48px floor. */}
      <div className="flex flex-col gap-2">
        <label className="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 text-[20px] font-bold text-[var(--color-accent-text)]">
          <FileUp aria-hidden="true" size={24} />
          Choose a file
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
        {filename !== null && (
          <p className="text-lg text-[var(--color-ink)]">Selected: {filename}</p>
        )}
      </div>

      {state.status === "loading" && (
        <p aria-busy="true" className="text-lg text-[var(--color-ink)]">
          Reading your file…
        </p>
      )}

      {state.status === "success" && (
        <section
          role="status"
          aria-label="Upload result"
          className="flex flex-col gap-4 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-[var(--color-ink)]"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-2">
              {assembleSentences(state.summary).map((sentence) => (
                <p key={sentence} className="text-lg text-[var(--color-ink)]">
                  {sentence}
                </p>
              ))}
            </div>
          </div>

          {state.summary.rejected.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={showRejects}
                onClick={() => setShowRejects((v) => !v)}
                className="flex w-fit items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]"
              >
                <ChevronDown
                  aria-hidden="true"
                  size={24}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${
                    showRejects ? "rotate-180" : ""
                  }`}
                />
                {showRejects ? "Hide details" : "Show which rows"}
              </button>
              {showRejects && (
                <ul className="flex flex-col gap-1 pl-1">
                  {state.summary.rejected.map((row) => (
                    <li key={row.row_index} className="text-lg text-[var(--color-ink)]">
                      Row {row.row_index}: {row.reason}.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {state.status === "error" && (
        <section
          role="alert"
          aria-label="Upload notice"
          className="flex items-start gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-lg text-[var(--color-ink)]"
        >
          <TriangleAlert aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
          {state.kind === "not-omron" ? (
            <p>
              <span className="font-bold">
                This doesn't look like an OMRON export.
              </span>{" "}
              Nothing was added. Please choose the .xlsx file you exported from
              your OMRON app.
            </p>
          ) : (
            <p>
              <span className="font-bold">
                Something went wrong reading that file.
              </span>{" "}
              Nothing was added — please try again.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
