"""File-facing ETL: OMRON .xlsx export -> normalized raw DataFrame -> clean frame.

Pure functions shared by the CLI seeder (plan 01-07) and the Phase 5 upload
route (CLAUDE.md pattern: "pure function raw_df -> clean_df imported by both").
No DB access, no side effects.

FORMAT NOTE — ASSUMED, NOT INSPECTED (blocker A1/A2 still open):
The real OMRON export and bp_data_cleaned.csv were not provided at the 01-01
checkpoint (user chose "skip"; data/ is empty as of 2026-07-09). parse_omron
targets the ASSUMED format from PROJECT.md / 01-RESEARCH.md A1:

    header row 0, columns: Date, Time, Systolic, Diastolic, Pulse,
                           Symptoms, Consumed, Notes

Because cell types are unverified (A2), BOTH branches are implemented:
native datetime/date/time cells AND text values via
``pd.to_datetime(..., errors="coerce")``. Unparseable values become NaT and
are rejected later by ``transform`` (D-08) — never silently dropped here.
Re-verify this section against the real file when it lands in data/.

Datetimes are naive local time end-to-end (DATA-05) — no tz anywhere.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time

import pandas as pd

from app.derivations import (
    classify_bp,
    classify_pulse,
    compute_map,
    compute_pulse_pressure,
    derive_am_pm,
)

# Assumed OMRON export columns (A1), normalized to snake_case on read.
_EXPECTED_RAW_COLUMNS = [
    "date",
    "time",
    "systolic",
    "diastolic",
    "pulse",
    "symptoms",
    "consumed",
    "notes",
]

_OUTPUT_COLUMNS = ["datetime", "systolic", "diastolic", "pulse", "notes"]


def _coerce_date(val) -> pd.Timestamp:
    """Normalize a Date cell (native date/datetime cell OR text) to midnight.

    Never manual Excel-serial math (openpyxl decodes cells); text falls back
    to ``pd.to_datetime(..., errors="coerce")`` -> NaT on garbage.
    """
    if val is None or (isinstance(val, float) and pd.isna(val)) or val is pd.NaT:
        return pd.NaT
    if isinstance(val, (pd.Timestamp, datetime)):
        return pd.Timestamp(val).normalize()
    if isinstance(val, date):
        return pd.Timestamp(val)
    parsed = pd.to_datetime(str(val), errors="coerce")
    return parsed.normalize() if not pd.isna(parsed) else pd.NaT


def _coerce_time(val) -> pd.Timedelta:
    """Normalize a Time cell (native time cell OR text like '8:05 AM') to a
    Timedelta offset from midnight; NaT on garbage."""
    if val is None or (isinstance(val, float) and pd.isna(val)) or val is pd.NaT:
        return pd.NaT
    if isinstance(val, time):
        return pd.Timedelta(hours=val.hour, minutes=val.minute, seconds=val.second)
    if isinstance(val, (pd.Timestamp, datetime)):
        t = pd.Timestamp(val).time()
        return pd.Timedelta(hours=t.hour, minutes=t.minute, seconds=t.second)
    parsed = pd.to_datetime(str(val), errors="coerce")
    if pd.isna(parsed):
        return pd.NaT
    t = parsed.time()
    return pd.Timedelta(hours=t.hour, minutes=t.minute, seconds=t.second)


def parse_omron(path_or_buffer, max_rows: int = 10_000) -> pd.DataFrame:
    """Read an OMRON .xlsx export into a normalized raw DataFrame.

    Accepts a filesystem path or a file-like buffer (Phase 5 passes
    ``UploadFile.file`` unchanged).

    Returns columns ``datetime`` (datetime64[ns], naive — DATA-05),
    ``systolic``, ``diastolic``, ``pulse``, ``notes``. Date + Time are combined
    into one naive datetime; unparseable values become NaT (rejection is
    ``transform``'s job). Blank rows are dropped. Symptoms/Consumed are
    dropped (empty in the assumed export).

    Raises ValueError if the file contains more than ``max_rows`` data rows
    (DoS guard for the Phase 5 upload boundary, T-1-06).
    """
    df = pd.read_excel(path_or_buffer, engine="openpyxl")

    # Normalize headers to lowercase snake_case.
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    # Drop fully blank rows (trailing noise in device exports).
    df = df.dropna(how="all").reset_index(drop=True)

    if len(df) > max_rows:
        raise ValueError(
            f"file contains {len(df)} data rows, exceeding the max_rows limit of {max_rows}"
        )

    # Ensure expected columns exist even if the export omits some.
    for col in _EXPECTED_RAW_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA

    # Combine Date + Time into one naive datetime (both native-cell and text
    # branches — A2 unverified). NaT propagates if either part is unparseable.
    dates = df["date"].map(_coerce_date)
    times = df["time"].map(_coerce_time)
    combined = pd.Series(
        [d + t if not (pd.isna(d) or pd.isna(t)) else pd.NaT for d, t in zip(dates, times)],
        index=df.index,
        dtype="datetime64[ns]",
    )

    out = pd.DataFrame(
        {
            "datetime": combined,
            "systolic": df["systolic"],
            "diastolic": df["diastolic"],
            "pulse": df["pulse"],
            "notes": df["notes"].astype("str"),  # pandas 3.0 str dtype, NaN preserved
        }
    )
    return out[_OUTPUT_COLUMNS]


# --- transform: derive, dedupe (D-07), reject (D-08) -------------------------

_CLEAN_COLUMNS = [
    "datetime",
    "systolic",
    "diastolic",
    "pulse",
    "am_pm",
    "bp_category",
    "pulse_category",
    "map",
    "pulse_pressure",
    "notes",
]

_DUPLICATE_REASON = "intra-file duplicate datetime: superseded by later row"


@dataclass(frozen=True)
class RejectedRow:
    """A row excluded from clean_df, with a hygiene-safe reason (D-08, T-1-04).

    ``reason`` names the offending field and problem only — it never echoes
    other health values from the row (log hygiene, V8).
    """

    row_index: int
    reason: str


def _validate_row(row: pd.Series) -> str | None:
    """Return a rejection reason for a raw row, or None if the row is valid."""
    if pd.isna(row["datetime"]):
        return "datetime: missing or unparseable"
    for field in ("systolic", "diastolic", "pulse"):
        val = row[field]
        if val is None or pd.isna(val):
            return f"{field}: missing"
        try:
            num = float(val)
        except (TypeError, ValueError):
            return f"{field}: not a number"
        if num <= 0:
            return f"{field}: not a positive number"
    return None


def transform(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, list[RejectedRow]]:
    """Derive the five computed columns and produce a DB-ready clean frame.

    Returns ``(clean_df, rejected)``:

    - clean_df columns: datetime, systolic, diastolic, pulse, am_pm,
      bp_category, pulse_category, map, pulse_pressure, notes — all derived
      values computed EXCLUSIVELY via :mod:`app.derivations` (DATA-01).
    - D-08: rows with NaT datetime or missing/non-numeric/non-positive vitals
      are excluded and reported as :class:`RejectedRow`; one bad row never
      aborts the file.
    - D-07: intra-file duplicate datetimes (minute granularity) resolve
      last-in-file-order wins; displaced rows are surfaced in ``rejected``,
      never silently dropped.
    - notes NaN is normalized to None (DB-ready); datetimes stay naive
      (DATA-05).
    """
    rejected: list[RejectedRow] = []

    # D-08: per-row validation first.
    keep: list[int] = []
    for idx, row in raw_df.iterrows():
        reason = _validate_row(row)
        if reason is not None:
            rejected.append(RejectedRow(int(idx), reason))
        else:
            keep.append(idx)
    valid = raw_df.loc[keep]

    # D-07: last-wins dedupe at minute granularity; record displaced indices
    # BEFORE dropping (surfaced, never silent).
    if len(valid) > 0:
        minute = valid["datetime"].dt.floor("min")
        displaced_mask = minute.duplicated(keep="last")
        for idx in valid.index[displaced_mask]:
            rejected.append(RejectedRow(int(idx), _DUPLICATE_REASON))
        valid = valid.loc[~displaced_mask]

    # Derive via app.derivations only — never re-implement thresholds here.
    records = []
    notes_values: list[str | None] = []
    for _, row in valid.iterrows():
        sbp = int(row["systolic"])
        dbp = int(row["diastolic"])
        pulse = int(row["pulse"])
        dt = row["datetime"].to_pydatetime()
        records.append(
            {
                "datetime": row["datetime"],
                "systolic": sbp,
                "diastolic": dbp,
                "pulse": pulse,
                "am_pm": derive_am_pm(dt),
                "bp_category": classify_bp(sbp, dbp),
                "pulse_category": classify_pulse(pulse),
                "map": compute_map(sbp, dbp),
                "pulse_pressure": compute_pulse_pressure(sbp, dbp),
                "notes": None,  # placeholder; object-dtype column set below
            }
        )
        notes_values.append(None if pd.isna(row["notes"]) else str(row["notes"]))

    clean = pd.DataFrame(records, columns=_CLEAN_COLUMNS)
    if clean.empty:
        clean["datetime"] = pd.to_datetime(clean["datetime"])
    # NaN -> None normalization, object dtype so None survives (DB-ready).
    clean["notes"] = pd.Series(notes_values, index=clean.index, dtype="object")

    rejected.sort(key=lambda r: r.row_index)
    return clean, rejected
