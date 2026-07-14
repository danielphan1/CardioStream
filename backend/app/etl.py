"""File-facing ETL: OMRON .xlsx export -> raw DataFrame -> clean frame -> DB merge.

``parse_omron`` and ``transform`` are pure functions shared by the CLI seeder
(plan 01-07) and the Phase 5 upload route (CLAUDE.md pattern: "pure function
raw_df -> clean_df imported by both") — no DB access, no side effects.
``merge_readings`` is the DB half (plan 01-06): the idempotent merge of a
clean frame into the readings table, returning the D-06 IngestSummary.

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

import math
from dataclasses import dataclass
from datetime import date, datetime, time

import pandas as pd
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.derivations import (
    classify_bp,
    classify_pulse,
    compute_map,
    compute_pulse_pressure,
    derive_am_pm,
)
from app.models import Reading

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
        # isfinite BEFORE the <= 0 comparison: NaN fails all comparisons and
        # would otherwise slip through the positivity check.
        if not math.isfinite(num):
            return f"{field}: not a finite number"
        if not num.is_integer():
            return f"{field}: not a whole number"
        if num <= 0:
            return f"{field}: not a positive number"
    return None


def transform(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, list[RejectedRow]]:
    """Derive the five computed columns and produce a DB-ready clean frame.

    Returns ``(clean_df, rejected)``:

    - clean_df columns: datetime, systolic, diastolic, pulse, am_pm,
      bp_category, pulse_category, map, pulse_pressure, notes — all derived
      values computed EXCLUSIVELY via :mod:`app.derivations` (DATA-01).
    - D-08: rows with NaT datetime or missing/non-numeric/non-finite/
      non-integer/non-positive vitals are excluded and reported as
      :class:`RejectedRow`; one bad row never aborts the file.
      Non-integer vitals are REJECTED, never rounded or truncated: OMRON
      exports carry integer vitals, so a fractional value is format drift or
      a re-typed cell — and rounding/truncating can silently move a reading
      across an AHA category boundary (129.9: truncation gives 'Elevated',
      rounding gives 'Stage 1' — neither guess is acceptable for medical
      data).
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
        # Coerce through the validated float so the loop is structurally
        # unable to raise on any value the gate passed (text "118" ->
        # float 118.0 -> int 118) — gate and coercion agree by construction.
        sbp = int(float(row["systolic"]))
        dbp = int(float(row["diastolic"]))
        pulse = int(float(row["pulse"]))
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


# --- merge_readings: idempotent DB merge (DATA-03, D-05, D-06) ----------------

# Input fields compared for the update/unchanged branch; derived columns follow
# these deterministically, so comparing inputs is sufficient (D-05).
_COMPARED_FIELDS = ("systolic", "diastolic", "pulse", "notes")


class IngestSummary(BaseModel):
    """D-06 ingest summary — this exact shape becomes the Phase 5 API-03
    ``POST /upload`` response. Do not deviate.

    Counts, reasons, and dates only — never blood-pressure values (T-1-04).
    ``latest`` is the max reading datetime in the DB after the merge, naive
    local time (DATA-05).
    """

    added: int
    updated: int
    unchanged: int
    rejected: list[RejectedRow]
    total: int
    latest: datetime | None


def merge_readings(
    session: Session, clean_df: pd.DataFrame, rejected: list[RejectedRow]
) -> IngestSummary:
    """Idempotently merge a clean frame into the readings table (DATA-03).

    Python-level merge (RESEARCH Pattern 2) — NOT ``ON CONFLICT``, which cannot
    report added-vs-updated-vs-unchanged, and explicitly NOT ``Session.merge()``
    (anti-pattern: it keys on the ``id`` primary key, not the ``datetime``
    natural key). The ``uq_readings_datetime`` constraint remains the safety
    net if this logic ever regresses.

    Branching per row (keyed by the reading datetime):

    - new datetime            -> INSERT, counted ``added``
    - existing, inputs differ -> UPDATE in place (incoming file is truth,
      D-05), derived values from clean_df applied too, counted ``updated``
    - existing, inputs equal  -> untouched, counted ``unchanged``

    All writes happen in ONE transaction (single commit at the end).
    """
    # Load existing rows once into a dict keyed by the natural key.
    existing: dict[datetime, Reading] = {
        r.datetime_: r for r in session.scalars(select(Reading))
    }

    added = updated = unchanged = 0
    for row in clean_df.itertuples(index=False):
        dt = row.datetime.to_pydatetime()  # naive — DATA-05 round-trip
        incoming_notes = row.notes if row.notes is not None else None
        current = existing.get(dt)
        if current is None:
            session.add(
                Reading(
                    datetime_=dt,
                    systolic=int(row.systolic),
                    diastolic=int(row.diastolic),
                    pulse=int(row.pulse),
                    am_pm=row.am_pm,
                    bp_category=row.bp_category,
                    pulse_category=row.pulse_category,
                    map_value=float(row.map),
                    pulse_pressure=int(row.pulse_pressure),
                    notes=incoming_notes,
                )
            )
            added += 1
        elif (
            current.systolic == int(row.systolic)
            and current.diastolic == int(row.diastolic)
            and current.pulse == int(row.pulse)
            and current.notes == incoming_notes
        ):
            unchanged += 1
        else:
            # D-05: the incoming file is truth — inputs AND derived columns.
            current.systolic = int(row.systolic)
            current.diastolic = int(row.diastolic)
            current.pulse = int(row.pulse)
            current.am_pm = row.am_pm
            current.bp_category = row.bp_category
            current.pulse_category = row.pulse_category
            current.map_value = float(row.map)
            current.pulse_pressure = int(row.pulse_pressure)
            current.notes = incoming_notes
            updated += 1

    session.commit()

    total = session.scalar(select(func.count()).select_from(Reading))
    latest = session.scalar(select(func.max(Reading.datetime_)))
    return IngestSummary(
        added=added,
        updated=updated,
        unchanged=unchanged,
        rejected=rejected,
        total=total,
        latest=latest,
    )
