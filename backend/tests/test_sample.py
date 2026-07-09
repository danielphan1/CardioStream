"""Character regression tests for the committed synthetic OMRON sample.

Pins the D-10 statistical character of backend/sample_data/omron_sample.xlsx
(the DATA-08 development dataset and Phase 5 upload demo file). Reads the
committed file directly with pandas + openpyxl — deliberately no dependency
on app.etl (plan 01-04 runs in parallel).

Category assertions go through app.derivations (classify_bp / classify_pulse),
the single source of truth (DATA-01) — no threshold is duplicated here.
"""

from pathlib import Path

import pandas as pd
import pytest

from app.derivations import classify_bp, classify_pulse

SAMPLE_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "omron_sample.xlsx"

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

CANONICAL_BP_CATEGORIES = {
    "Hypotension",
    "Normal",
    "Elevated",
    "Stage 1",
    "Stage 2",
    "Hypertensive Crisis",
}


@pytest.fixture(scope="module")
def sample_df() -> pd.DataFrame:
    assert SAMPLE_PATH.is_file(), f"committed sample missing: {SAMPLE_PATH}"
    return pd.read_excel(SAMPLE_PATH, engine="openpyxl")


def test_columns_match_omron_export_shape(sample_df):
    assert list(sample_df.columns) == OMRON_COLUMNS


def test_row_count_mirrors_real_dataset(sample_df):
    assert 120 <= len(sample_df) <= 140


def test_dates_within_real_span(sample_df):
    dates = pd.to_datetime(sample_df["Date"])
    assert dates.min() >= pd.Timestamp("2025-02-22")
    assert dates.max() <= pd.Timestamp("2025-06-13")


def test_bradycardia_share_matches_character(sample_df):
    pulse_categories = [classify_pulse(int(p)) for p in sample_df["Pulse"]]
    brady_share = pulse_categories.count("Bradycardia") / len(sample_df)
    assert 0.80 <= brady_share <= 0.95


def test_all_six_bp_categories_represented(sample_df):
    observed = {
        classify_bp(int(s), int(d))
        for s, d in zip(sample_df["Systolic"], sample_df["Diastolic"])
    }
    assert observed == CANONICAL_BP_CATEGORIES
    # Spelled out so a rename of any canonical label fails loudly here:
    assert "Hypotension" in observed
    assert "Normal" in observed
    assert "Elevated" in observed
    assert "Stage 1" in observed
    assert "Stage 2" in observed
    assert "Hypertensive Crisis" in observed


def test_free_text_columns_entirely_empty(sample_df):
    """No synthetic symptoms/notes — matches the real export (D-11 / T-1-01)."""
    for column in ("Symptoms", "Consumed", "Notes"):
        assert sample_df[column].isna().all(), f"{column} must be entirely empty"


def test_both_am_and_pm_readings_present(sample_df):
    hours = pd.to_datetime(sample_df["Time"].astype(str), format="%H:%M:%S").dt.hour
    assert (hours < 12).any(), "no AM readings in sample"
    assert (hours >= 12).any(), "no PM readings in sample"
