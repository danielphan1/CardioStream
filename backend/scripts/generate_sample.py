"""Generate the committed SYNTHETIC OMRON-format sample workbook.

THIS FILE PRODUCES SYNTHETIC DEMO DATA ONLY (T-1-08). Every value is drawn
from a seeded pseudo-random generator or is a hand-picked textbook AHA
boundary value. The script never reads Chris's real readings — it has no
dependency on the gitignored raw-data directory at the repo root (T-1-01).

Design decisions (01-CONTEXT.md):
  - D-09: seeded-random generator; script AND output are committed. Running
    twice produces a byte-identical .xlsx (fixed SEED, pinned workbook
    timestamps, normalized zip entry metadata).
  - D-10: output mirrors the real dataset's statistical character — 132 rows
    over 2025-02-22..2025-06-13, ~88% bradycardic pulse, systolic spanning
    60-211, every BP category represented, mixed AM/PM.
  - D-11: OMRON export shape — columns Date, Time, Systolic, Diastolic,
    Pulse, Symptoms, Consumed, Notes (last three empty) — so the sample
    exercises the same openpyxl ingest path as a real export and doubles as
    the Phase 5 upload demo file.

Category coverage is asserted by mapping every generated row through
app.derivations.classify_bp / classify_pulse — the single source of truth
(DATA-01). No BP or pulse threshold is duplicated here.

Run from backend/:  python scripts/generate_sample.py
"""

from __future__ import annotations

import random
import zipfile
from collections import Counter
from datetime import date, datetime, time, timedelta
from pathlib import Path

import pandas as pd

from app.derivations import classify_bp, classify_pulse

# --- Determinism knobs (D-09) -------------------------------------------------

SEED = 20250222
# Pinned into the workbook's core properties and every zip entry so repeated
# runs are byte-identical (openpyxl otherwise stamps wall-clock time).
FIXED_TIMESTAMP = datetime(2025, 6, 13, 12, 0, 0)

# --- Character targets (D-10) -------------------------------------------------

START_DATE = date(2025, 2, 22)
END_DATE = date(2025, 6, 13)  # inclusive; 112 calendar days
N_SECOND_READINGS = 20  # days that get a second reading -> 112 + 20 = 132 rows

# Pulse category counts out of 132 rows: 116/132 = 87.9% bradycardic.
N_BRADY, N_NORMAL_PULSE, N_TACHY = 116, 12, 4

# Hand-picked textbook edge rows guaranteeing category coverage and the
# systolic 60-211 span. (200, 55) is the D-02 wide-pulse-pressure row: the
# hypotension gate must win over the crisis ladder.
EDGE_BP_ROWS = [
    (85, 55),  # Hypotension
    (110, 70),  # Normal
    (125, 75),  # Elevated
    (132, 84),  # Stage 1
    (150, 95),  # Stage 2
    (195, 125),  # Hypertensive Crisis
    (200, 55),  # Hypotension via D-02 gate despite crisis-range systolic
    (60, 40),  # systolic floor of the real span
    (211, 118),  # systolic ceiling of the real span
]

# Mixture over BP regimes reflecting the real data's "hypotension to
# hypertensive crisis" variability. Values are (weight, sys_range, dia_range);
# the resulting category is decided by classify_bp, never assumed here.
BP_MIXTURE = [
    (22, (62, 89), (42, 59)),
    (28, (95, 119), (62, 78)),
    (12, (120, 129), (62, 78)),
    (14, (130, 139), (80, 88)),
    (16, (140, 178), (90, 112)),
    (8, (182, 211), (95, 128)),
]

OMRON_COLUMNS = [
    "Date",
    "Time",
    "Systolic",
    "Diastolic",
    "Pulse",
    "Symptoms",
    "Consumed",
    "Notes",
]

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "omron_sample.xlsx"


def _build_slots(rng: random.Random) -> list[tuple[date, time]]:
    """One reading per day plus a second reading on N_SECOND_READINGS days."""
    all_days = [
        START_DATE + timedelta(days=i) for i in range((END_DATE - START_DATE).days + 1)
    ]
    double_days = set(rng.sample(all_days, N_SECOND_READINGS))

    slots: list[tuple[date, time]] = []
    for day in all_days:
        first_is_am = rng.random() < 0.7
        morning = time(rng.randint(6, 10), rng.randint(0, 59))
        evening = time(rng.randint(17, 21), rng.randint(0, 59))
        slots.append((day, morning if first_is_am else evening))
        if day in double_days:
            # Second reading falls in the opposite half of the day -> the
            # sample is guaranteed to contain both AM and PM times.
            slots.append((day, evening if first_is_am else morning))
    slots.sort()
    return slots


def _draw_bp(rng: random.Random) -> tuple[int, int]:
    (sys_lo, sys_hi), (dia_lo, dia_hi) = rng.choices(
        [(m[1], m[2]) for m in BP_MIXTURE], weights=[m[0] for m in BP_MIXTURE]
    )[0]
    return rng.randint(sys_lo, sys_hi), rng.randint(dia_lo, dia_hi)


def _draw_pulses(rng: random.Random, n_rows: int) -> list[int]:
    assert N_BRADY + N_NORMAL_PULSE + N_TACHY == n_rows
    pulses = (
        [rng.randint(42, 59) for _ in range(N_BRADY)]
        + [rng.randint(60, 100) for _ in range(N_NORMAL_PULSE)]
        + [rng.randint(101, 115) for _ in range(N_TACHY)]
    )
    rng.shuffle(pulses)
    return pulses


def generate_rows() -> pd.DataFrame:
    rng = random.Random(SEED)  # NEVER the global random state (D-09)
    slots = _build_slots(rng)
    n_rows = len(slots)

    bp = [_draw_bp(rng) for _ in range(n_rows)]
    for idx, edge in zip(rng.sample(range(n_rows), len(EDGE_BP_ROWS)), EDGE_BP_ROWS):
        bp[idx] = edge
    pulses = _draw_pulses(rng, n_rows)

    return pd.DataFrame(
        {
            "Date": [d for d, _ in slots],
            "Time": [t for _, t in slots],
            "Systolic": [s for s, _ in bp],
            "Diastolic": [d for _, d in bp],
            "Pulse": pulses,
            "Symptoms": [None] * n_rows,
            "Consumed": [None] * n_rows,
            "Notes": [None] * n_rows,
        },
        columns=OMRON_COLUMNS,
    )


def assert_character(df: pd.DataFrame) -> Counter:
    """Fail loudly if the generated sample misses the D-10 character."""
    bp_hist = Counter(
        classify_bp(int(s), int(d)) for s, d in zip(df["Systolic"], df["Diastolic"])
    )
    required_bp = {
        "Hypotension",
        "Normal",
        "Elevated",
        "Stage 1",
        "Stage 2",
        "Hypertensive Crisis",
    }
    missing = required_bp - set(bp_hist)
    assert not missing, f"BP categories missing from sample: {sorted(missing)}"

    pulse_hist = Counter(classify_pulse(int(p)) for p in df["Pulse"])
    missing_pulse = {"Bradycardia", "Normal", "Tachycardia"} - set(pulse_hist)
    assert not missing_pulse, f"Pulse categories missing: {sorted(missing_pulse)}"

    brady_share = pulse_hist["Bradycardia"] / len(df)
    assert 0.80 <= brady_share <= 0.95, f"bradycardia share {brady_share:.3f} off-character"
    assert df["Systolic"].min() <= 70 and df["Systolic"].max() >= 200, "systolic span too narrow"
    assert classify_bp(200, 55) == "Hypotension", "D-02 gate regression"
    return bp_hist


def _write_deterministic_xlsx(df: pd.DataFrame, path: Path) -> None:
    """df.to_excel with pinned timestamps so output bytes never vary (D-09)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
        writer.book.properties.created = FIXED_TIMESTAMP
        writer.book.properties.modified = FIXED_TIMESTAMP
    # openpyxl stamps zip entries with wall-clock mtimes; rewrite them fixed.
    with zipfile.ZipFile(path) as zin:
        entries = [(name, zin.read(name)) for name in sorted(zin.namelist())]
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, payload in entries:
            info = zipfile.ZipInfo(name, date_time=FIXED_TIMESTAMP.timetuple()[:6])
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zout.writestr(info, payload)


def main() -> None:
    df = generate_rows()
    bp_hist = assert_character(df)
    _write_deterministic_xlsx(df, OUTPUT_PATH)

    brady = sum(classify_pulse(int(p)) == "Bradycardia" for p in df["Pulse"])
    print(f"wrote {OUTPUT_PATH.relative_to(Path.cwd()) if OUTPUT_PATH.is_relative_to(Path.cwd()) else OUTPUT_PATH}")
    print(f"rows: {len(df)}")
    print(f"bradycardia share: {brady / len(df):.1%}")
    print("BP category histogram:")
    for label, count in sorted(bp_hist.items(), key=lambda kv: -kv[1]):
        print(f"  {label:<20} {count}")


if __name__ == "__main__":
    main()
