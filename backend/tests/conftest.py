"""Shared pytest fixtures for the ETL test suite.

OMRON export format (ASSUMED — A1/A2, blocker still open):
The real OMRON .xlsx export and bp_data_cleaned.csv were NOT provided at the
01-01 checkpoint (user chose "skip"; data/ is empty). These fixtures build the
ASSUMED format from PROJECT.md / 01-RESEARCH.md A1:

  8 columns, header on row 0:
    Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes

Because cell types are unverified (A2), tests exercise BOTH native
datetime/time cells and text values ("2025-03-01", "8:05 AM") — parse_omron
keeps a defensive `pd.to_datetime(..., errors="coerce")` branch regardless.
When the real files land in data/, re-verify this shape and update here.
"""

from __future__ import annotations

import pandas as pd
import pytest

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


@pytest.fixture
def omron_df():
    """Build an OMRON-shaped raw DataFrame from a list of row dicts.

    Missing keys are filled with None so every frame carries all 8 assumed
    columns in OMRON order.
    """

    def _build(rows: list[dict]) -> pd.DataFrame:
        filled = [{col: row.get(col) for col in OMRON_COLUMNS} for row in rows]
        return pd.DataFrame(filled, columns=OMRON_COLUMNS)

    return _build


@pytest.fixture
def omron_xlsx(tmp_path, omron_df):
    """Write an OMRON-shaped frame to a tmp .xlsx and return the path."""

    def _write(rows: list[dict], filename: str = "omron_export.xlsx"):
        df = omron_df(rows)
        path = tmp_path / filename
        df.to_excel(path, index=False)
        return path

    return _write
