"""Boundary matrix tests for BP and pulse classification (DATA-02, DATA-07).

Canonical labels (pinned; surface in Phase 2 charts/API):
  BP:    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
  Pulse: "Bradycardia", "Normal", "Tachycardia"

Rules under test (locked decisions D-02, D-03, D-04; verified AHA table in
01-RESEARCH.md §Verified AHA Classification):
  - D-02 hypotension gate FIRST: systolic <90 OR diastolic <60 -> "Hypotension",
    checked before the AHA ladder (precedence pin: 200/55 is Hypotension, not Crisis).
  - D-03 severity-max: classify systolic and diastolic independently, more severe wins.
  - Crisis is STRICTLY greater than 180 systolic / 120 diastolic (Pitfall 2).
  - D-04 pulse: <60 Bradycardia, 60-100 inclusive Normal, >100 Tachycardia.
"""

import pytest

from app.derivations import classify_bp, classify_pulse


@pytest.mark.parametrize(
    ("systolic", "diastolic", "expected"),
    [
        # D-02 hypotension gate FIRST
        (89, 70, "Hypotension"),
        # Precedence pin (Pitfall 3): diastolic <60 wins over Crisis-range systolic
        (200, 55, "Hypotension"),
        # Gate NOT triggered at exactly 90/60
        (90, 60, "Normal"),
        # Systolic ladder at dia=70
        (119, 70, "Normal"),
        (120, 70, "Elevated"),
        (129, 70, "Elevated"),
        (130, 70, "Stage 1"),
        (139, 70, "Stage 1"),
        (140, 70, "Stage 2"),
        # Diastolic drives via D-03 severity-max at sys=115
        (115, 80, "Stage 1"),
        (115, 89, "Stage 1"),
        (115, 90, "Stage 2"),
        # Crisis is STRICTLY greater than 180/120 (Pitfall 2)
        (180, 100, "Stage 2"),
        (181, 100, "Hypertensive Crisis"),
        (150, 120, "Stage 2"),
        (150, 121, "Hypertensive Crisis"),
        # Mixed-category severity-max
        (125, 85, "Stage 1"),
        (125, 75, "Elevated"),
    ],
)
def test_classify_bp_boundaries(systolic: int, diastolic: int, expected: str) -> None:
    assert classify_bp(systolic, diastolic) == expected


@pytest.mark.parametrize(
    ("pulse", "expected"),
    [
        # D-04: Bradycardia <60, Normal 60-100 inclusive, Tachycardia >100
        (59, "Bradycardia"),
        (60, "Normal"),
        (100, "Normal"),
        (101, "Tachycardia"),
    ],
)
def test_classify_pulse_boundaries(pulse: int, expected: str) -> None:
    assert classify_pulse(pulse) == expected
