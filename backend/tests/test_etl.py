"""Tests for the file-facing ETL: parse_omron (and later transform).

All frames are synthetic — no real health readings (log hygiene, T-1-04).
"""

from datetime import date, datetime, time

import pandas as pd
import pytest

from app.etl import RejectedRow, parse_omron, transform


def _raw_df(rows: list[dict]) -> pd.DataFrame:
    """Build a frame shaped like parse_omron output from row dicts."""
    cols = ["datetime", "systolic", "diastolic", "pulse", "notes"]
    filled = [{c: row.get(c) for c in cols} for row in rows]
    df = pd.DataFrame(filled, columns=cols)
    df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
    return df


class TestParseOmron:
    def test_parse_native_datetime_cells(self, omron_xlsx):
        """Native date/time cells combine into one naive datetime column."""
        path = omron_xlsx(
            [
                {
                    "Date": date(2025, 3, 1),
                    "Time": time(8, 5),
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                    "Notes": "morning reading",
                },
                {
                    "Date": date(2025, 3, 1),
                    "Time": time(20, 30),
                    "Systolic": 118,
                    "Diastolic": 76,
                    "Pulse": 62,
                },
            ]
        )
        df = parse_omron(path)
        assert list(df.columns) == ["datetime", "systolic", "diastolic", "pulse", "notes"]
        assert str(df["datetime"].dtype).startswith("datetime64[ns")
        assert df["datetime"].dt.tz is None  # DATA-05: naive end-to-end
        assert df.loc[0, "datetime"] == pd.Timestamp("2025-03-01 08:05:00")
        assert df.loc[1, "datetime"] == pd.Timestamp("2025-03-01 20:30:00")
        assert df.loc[0, "notes"] == "morning reading"

    def test_parse_text_date_time_fallback(self, omron_xlsx):
        """Text Date/Time values still parse via the coerce fallback branch (A2)."""
        path = omron_xlsx(
            [
                {
                    "Date": "2025-03-01",
                    "Time": "8:05 AM",
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                },
                {
                    "Date": "2025-03-02",
                    "Time": "9:15 PM",
                    "Systolic": 130,
                    "Diastolic": 85,
                    "Pulse": 70,
                },
            ]
        )
        df = parse_omron(path)
        assert df.loc[0, "datetime"] == pd.Timestamp("2025-03-01 08:05:00")
        assert df.loc[1, "datetime"] == pd.Timestamp("2025-03-02 21:15:00")
        assert df["datetime"].dt.tz is None

    def test_parse_unparseable_datetime_coerces_to_nat(self, omron_xlsx):
        """Garbage Date/Time becomes NaT — rejection is transform's job, not parse's."""
        path = omron_xlsx(
            [
                {
                    "Date": "not-a-date",
                    "Time": "whenever",
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                },
                {
                    "Date": "2025-03-01",
                    "Time": "8:05 AM",
                    "Systolic": 118,
                    "Diastolic": 76,
                    "Pulse": 62,
                },
            ]
        )
        df = parse_omron(path)
        assert len(df) == 2  # bad row NOT dropped here
        assert pd.isna(df.loc[0, "datetime"])
        assert df.loc[1, "datetime"] == pd.Timestamp("2025-03-01 08:05:00")

    def test_parse_drops_blank_trailing_rows(self, omron_xlsx):
        path = omron_xlsx(
            [
                {
                    "Date": date(2025, 3, 1),
                    "Time": time(8, 5),
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                },
                {},  # fully blank row
                {},  # fully blank row
            ]
        )
        df = parse_omron(path)
        assert len(df) == 1

    def test_parse_accepts_file_like_buffer(self, omron_xlsx):
        """Phase 5 upload route passes UploadFile.file — a buffer, not a path."""
        path = omron_xlsx(
            [
                {
                    "Date": date(2025, 3, 1),
                    "Time": time(8, 5),
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                }
            ]
        )
        with open(path, "rb") as fh:
            df = parse_omron(fh)
        assert len(df) == 1
        assert df.loc[0, "systolic"] == 120

    def test_parse_max_rows_guard(self, omron_xlsx):
        """More than max_rows data rows raises ValueError naming the limit (DoS guard)."""
        rows = [
            {
                "Date": date(2025, 3, 1),
                "Time": time(8, 5),
                "Systolic": 120,
                "Diastolic": 80,
                "Pulse": 55,
            }
            for _ in range(6)
        ]
        path = omron_xlsx(rows)
        with pytest.raises(ValueError, match="5"):
            parse_omron(path, max_rows=5)

    def test_parse_max_rows_default_is_10000(self, omron_xlsx):
        import inspect

        from app.etl import parse_omron as fn

        sig = inspect.signature(fn)
        assert sig.parameters["max_rows"].default == 10_000

    def test_parse_notes_missing_stays_missing(self, omron_xlsx):
        path = omron_xlsx(
            [
                {
                    "Date": date(2025, 3, 1),
                    "Time": time(8, 5),
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                }
            ]
        )
        df = parse_omron(path)
        assert pd.isna(df.loc[0, "notes"])


CLEAN_COLUMNS = [
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


class TestTransform:
    def test_clean_df_columns_and_known_values(self):
        """Spot check via app.derivations: (2025-03-01 08:05, 120, 80, 55)."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 80,
                        "pulse": 55,
                        "notes": "spot check",
                    }
                ]
            )
        )
        assert list(clean.columns) == CLEAN_COLUMNS
        assert rejected == []
        row = clean.iloc[0]
        assert row["am_pm"] == "AM"
        # NOTE: plan 01-04 predicted "Elevated" for 120/80, but the pinned
        # AHA ladder (01-03, D-03 severity-max) classifies diastolic 80 as
        # Stage 1 — "Elevated" requires diastolic <80. derivations.py is the
        # single source of truth (DATA-01); the plan literal was wrong.
        assert row["bp_category"] == "Stage 1"
        assert row["pulse_category"] == "Bradycardia"
        assert row["map"] == pytest.approx(93.3, abs=0.05)
        assert row["pulse_pressure"] == 40
        assert row["notes"] == "spot check"

    def test_clean_datetime_stays_naive(self):
        clean, _ = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 80,
                        "pulse": 55,
                    }
                ]
            )
        )
        assert clean["datetime"].dt.tz is None  # DATA-05

    def test_d07_last_wins_dedupe_and_displaced_row_surfaced(self):
        """Same minute-granularity datetime: last row in file order survives."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 80,
                        "pulse": 55,
                    },
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 130,
                        "diastolic": 85,
                        "pulse": 70,
                    },
                ]
            )
        )
        assert len(clean) == 1
        assert clean.iloc[0]["systolic"] == 130  # last wins
        assert len(rejected) == 1
        assert rejected[0].row_index == 0
        assert rejected[0].reason == "intra-file duplicate datetime: superseded by later row"

    def test_d08_missing_pulse_rejected_others_survive(self):
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 80,
                        "pulse": None,
                    },
                    {
                        "datetime": datetime(2025, 3, 2, 8, 5),
                        "systolic": 118,
                        "diastolic": 76,
                        "pulse": 62,
                    },
                ]
            )
        )
        assert len(clean) == 1
        assert clean.iloc[0]["systolic"] == 118
        assert len(rejected) == 1
        assert rejected[0].row_index == 0
        assert "pulse" in rejected[0].reason

    def test_d08_nat_datetime_rejected(self):
        clean, rejected = transform(
            _raw_df(
                [
                    {"datetime": None, "systolic": 120, "diastolic": 80, "pulse": 55},
                    {
                        "datetime": datetime(2025, 3, 2, 8, 5),
                        "systolic": 118,
                        "diastolic": 76,
                        "pulse": 62,
                    },
                ]
            )
        )
        assert len(clean) == 1
        assert len(rejected) == 1
        assert rejected[0].row_index == 0
        assert "datetime" in rejected[0].reason

    def test_d08_non_numeric_systolic_rejected(self):
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": "high",
                        "diastolic": 80,
                        "pulse": 55,
                    },
                ]
            )
        )
        assert len(clean) == 0
        assert len(rejected) == 1
        assert "systolic" in rejected[0].reason

    def test_d08_non_positive_diastolic_rejected(self):
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 0,
                        "pulse": 55,
                    },
                ]
            )
        )
        assert len(clean) == 0
        assert len(rejected) == 1
        assert "diastolic" in rejected[0].reason

    def test_d08_reason_does_not_echo_other_health_values(self):
        """Log hygiene (V8/T-1-04): reasons never leak the row's readings."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 187,
                        "diastolic": 113,
                        "pulse": None,
                    },
                ]
            )
        )
        assert len(rejected) == 1
        assert "187" not in rejected[0].reason
        assert "113" not in rejected[0].reason

    def test_one_bad_row_never_aborts_the_rest(self):
        clean, rejected = transform(
            _raw_df(
                [
                    {"datetime": None, "systolic": 120, "diastolic": 80, "pulse": 55},
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": "bad",
                        "diastolic": 80,
                        "pulse": 55,
                    },
                    {
                        "datetime": datetime(2025, 3, 2, 20, 5),
                        "systolic": 118,
                        "diastolic": 76,
                        "pulse": 62,
                    },
                    {
                        "datetime": datetime(2025, 3, 3, 12, 0),
                        "systolic": 145,
                        "diastolic": 91,
                        "pulse": 105,
                    },
                ]
            )
        )
        assert len(clean) == 2
        assert len(rejected) == 2
        # noon exactly is PM; derived via app.derivations
        assert clean.iloc[1]["am_pm"] == "PM"
        assert clean.iloc[1]["bp_category"] == "Stage 2"
        assert clean.iloc[1]["pulse_category"] == "Tachycardia"

    def test_notes_nan_normalized_to_none(self):
        clean, _ = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 80,
                        "pulse": 55,
                    }
                ]
            )
        )
        assert clean.iloc[0]["notes"] is None

    def test_rejected_row_shape(self):
        _, rejected = transform(
            _raw_df(
                [{"datetime": None, "systolic": 120, "diastolic": 80, "pulse": 55}]
            )
        )
        r = rejected[0]
        assert isinstance(r, RejectedRow)
        assert isinstance(r.row_index, int)
        assert isinstance(r.reason, str)

    def test_d08_text_decimal_systolic_rejected_siblings_survive(self):
        """Gap 1 / CR-01: '118.5' becomes a RejectedRow — never a ValueError
        that aborts the whole file (D-08)."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": "118.5",
                        "diastolic": 76,
                        "pulse": 62,
                    },
                    {
                        "datetime": datetime(2025, 3, 2, 8, 5),
                        "systolic": 118,
                        "diastolic": 76,
                        "pulse": 62,
                    },
                ]
            )
        )
        assert len(clean) == 1
        assert clean.iloc[0]["systolic"] == 118
        assert len(rejected) == 1
        assert "systolic" in rejected[0].reason

    def test_d08_float_systolic_129_9_rejected_never_truncated(self):
        """Gap 1 / WR-02 boundary pin: 129.9 is rejected — never silently
        floor-truncated to 129/'Elevated' when 130 would be 'Stage 1'."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 129.9,
                        "diastolic": 76,
                        "pulse": 62,
                    },
                ]
            )
        )
        assert len(rejected) == 1
        assert "systolic" in rejected[0].reason
        assert len(clean) == 0
        assert not (clean["systolic"] == 129).any()
        assert not (clean["bp_category"] == "Elevated").any()

    def test_d08_float_diastolic_89_5_rejected(self):
        """Gap 1 / WR-02 boundary pin: diastolic 89.5 rejected, reason names
        the field."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": 120,
                        "diastolic": 89.5,
                        "pulse": 62,
                    },
                ]
            )
        )
        assert len(clean) == 0
        assert len(rejected) == 1
        assert "diastolic" in rejected[0].reason

    def test_d08_text_inf_and_nan_vitals_rejected(self):
        """Non-finite text vitals ('inf', 'nan') become RejectedRows naming
        the field — never an exception."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": "inf",
                        "diastolic": 76,
                        "pulse": 62,
                    },
                    {
                        "datetime": datetime(2025, 3, 2, 8, 5),
                        "systolic": 120,
                        "diastolic": 80,
                        "pulse": "nan",
                    },
                ]
            )
        )
        assert len(clean) == 0
        assert len(rejected) == 2
        assert "systolic" in rejected[0].reason
        assert "pulse" in rejected[1].reason

    def test_integer_valued_inputs_still_accepted(self):
        """Text '118' and native float 130.0 are integer-valued and pass;
        130.0 stores as 130 -> 'Stage 1' (never a category off-by-one)."""
        clean, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": "118",
                        "diastolic": 76,
                        "pulse": 62,
                    },
                    {
                        "datetime": datetime(2025, 3, 2, 8, 5),
                        "systolic": 130.0,
                        "diastolic": 76,
                        "pulse": 62,
                    },
                ]
            )
        )
        assert rejected == []
        assert len(clean) == 2
        assert clean.iloc[0]["systolic"] == 118
        assert clean.iloc[1]["systolic"] == 130
        assert clean.iloc[1]["bp_category"] == "Stage 1"

    def test_d08_decimal_rejection_reason_does_not_echo_values(self):
        """Log hygiene (T-1-04): the non-integer rejection reason never echoes
        the offending value or the row's other vitals."""
        _, rejected = transform(
            _raw_df(
                [
                    {
                        "datetime": datetime(2025, 3, 1, 8, 5),
                        "systolic": "118.5",
                        "diastolic": 93,
                        "pulse": 67,
                    },
                ]
            )
        )
        assert len(rejected) == 1
        assert "118.5" not in rejected[0].reason
        assert "93" not in rejected[0].reason
        assert "67" not in rejected[0].reason

    def test_transform_of_parse_output_end_to_end(self, omron_xlsx):
        """Full pipeline: file -> parse_omron -> transform."""
        path = omron_xlsx(
            [
                {
                    "Date": date(2025, 3, 1),
                    "Time": time(8, 5),
                    "Systolic": 120,
                    "Diastolic": 80,
                    "Pulse": 55,
                    "Notes": "e2e",
                },
                {
                    "Date": "not-a-date",
                    "Time": "whenever",
                    "Systolic": 118,
                    "Diastolic": 76,
                    "Pulse": 62,
                },
            ]
        )
        clean, rejected = transform(parse_omron(path))
        assert len(clean) == 1
        # 120/80 -> Stage 1 per the pinned AHA ladder (see note above)
        assert clean.iloc[0]["bp_category"] == "Stage 1"
        assert clean.iloc[0]["notes"] == "e2e"
        assert len(rejected) == 1
        assert "datetime" in rejected[0].reason
