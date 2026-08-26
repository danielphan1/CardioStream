"""Fixed server-side safety copy (VOICE-07, VOICE-09, D-10, D-11, D-16).

All refusal / didn't-catch / data-question copy is TEMPLATE TEXT authored here,
never model prose — the model can phrase medical topics alarmingly, and every
failure must teach the vocabulary. The register matches App.tsx: friendly,
non-technical, non-alarming, large-text-screen friendly. Wording is Claude's
discretion per CONTEXT; the STRUCTURE (examples embedded in the didn't-catch
copy, a refusal paired with a useful action, care-team redirect) is locked.
"""

# Real commands the box teaches — reused in the didn't-catch copy (D-02/D-11).
EXAMPLE_COMMANDS = [
    "show my pulse",
    "last 30 days, mornings only",
    "show all data",
]

# D-11: unintelligible input never yields a raw error — a friendly nudge that
# embeds two example commands so every failure teaches the vocabulary.
UNCLEAR_MESSAGE = (
    "Sorry, I didn't catch that. Try something like "
    f"“{EXAMPLE_COMMANDS[0]}” or “{EXAMPLE_COMMANDS[1]}”."
)

# Pitfall 9: keyless boot / agent unreachable — degrade gracefully, point to the
# still-working manual controls.
UNAVAILABLE_MESSAGE = (
    "The assistant isn't connected right now. The buttons below still work — "
    "use them to change the view."
)

# Human-readable phrase per chart token, for the medical-refusal redirect (D-10).
CHART_PHRASES = {
    "bp_timeline": "blood pressure",
    "pulse_trend": "pulse",
    "bp_categories": "blood-pressure categories",
    "am_pm_comparison": "morning vs evening comparison",
}

# D-10 / VOICE-09: never interpret readings; redirect to the care team while
# still doing something useful (showing the relevant chart).
MEDICAL_REFUSAL_WITH_CHART = (
    "I can't tell you what your readings mean — that's a question for your care "
    "team. Here's your {chart_phrase} so you can see it."
)
MEDICAL_REFUSAL_PLAIN = (
    "I can't tell you what your readings mean — that's a question for your care "
    "team. I can show you your data, though."
)

# D-16: data questions stay inside the validated-command pipeline — no free-text
# numbers; point at the stats bar (verbatim from CONTEXT).
DATA_QUESTION_MESSAGE = "Your averages are in the stats bar below."

# Human-readable phrase per overlay dataset token, for the toggle-dataset
# confirmation (WR-06 — the frontend's composeConfirmation() has no awareness
# of overlay toggles, so this is the only place that action gets confirmed).
DATASET_PHRASES = {
    "labs": "labs",
    "incidents": "incidents",
    "procedures": "procedures",
}


def medical_refusal(chart: str | None) -> str:
    """Compose the D-10 refusal copy, pairing it with the relevant chart phrase."""
    if chart is not None and chart in CHART_PHRASES:
        return MEDICAL_REFUSAL_WITH_CHART.format(chart_phrase=CHART_PHRASES[chart])
    return MEDICAL_REFUSAL_PLAIN


def toggle_speech_message(state: str) -> str:
    """Compose the D-01 mute/unmute confirmation (WR-06) — composeConfirmation()
    only describes chart/date/am-pm/category state, so this is the only place
    that acknowledges the toggle a voice-only user just asked for."""
    return "Voice replies are now on." if state == "on" else "Voice replies are now off."


def toggle_guide_message(state: str) -> str:
    """Compose the D-05 open/close confirmation (WR-06), same rationale as
    toggle_speech_message above — composeConfirmation() on the frontend has no
    guide awareness, so this is the only place the open/close action itself
    gets confirmed."""
    return "Opening the guide." if state == "open" else "Closing the guide."


def toggle_dataset_message(dataset: str, state: str) -> str:
    """Compose the D-03/D-04 overlay-toggle confirmation (WR-06), same rationale
    as toggle_speech_message above."""
    phrase = DATASET_PHRASES.get(dataset, dataset)
    if state == "on":
        return f"Now showing {phrase}."
    return f"{phrase.capitalize()} hidden."
