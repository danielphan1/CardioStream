"""Tests for the file-facing ETL: parse_omron (and later transform).

All frames are synthetic — no real health readings (log hygiene, T-1-04).
"""

from datetime import date, datetime, time

import pandas as pd
import pytest

from app.etl import parse_omron


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
