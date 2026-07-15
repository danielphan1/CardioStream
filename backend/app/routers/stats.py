"""GET /stats/summary — filtered aggregates + category counts (API-02).

Pinned invariants:
  - Uses the SAME ``ReadingFilters`` dependency as /readings — one filter
    semantics (Phase 3's agent inherits it).
  - ``categories`` always contains ALL six canonical labels in clinical
    order, zero-filled; ``CLINICAL_ORDER`` labels are verbatim from
    ``app.derivations`` (spaces included, never snake_cased).
  - ``latest_reading`` is deliberately UNFILTERED: the D-11 empty state and
    date-preset anchoring both need "the newest reading that exists", not
    "newest in the (possibly empty) filter set".
  - avg rounded to 1 decimal; vitals are null when count == 0 (no division
    errors, no 500s); naive ISO datetimes, no Z/offset (DATA-05).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import ReadingFilters, get_db
from app.models import Reading
from app.schemas import CategoryStat, StatsSummary, VitalStats

# Verbatim canonical labels from app.derivations, least -> most severe.
CLINICAL_ORDER = [
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis",
]

router = APIRouter()


@router.get("/stats/summary", response_model=StatsSummary)
def stats_summary(
    filters: Annotated[ReadingFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> StatsSummary:
    """Return count, vital aggregates, category breakdown, and latest reading."""
    agg = filters.apply(
        select(
            func.count(Reading.id),
            func.avg(Reading.systolic), func.min(Reading.systolic), func.max(Reading.systolic),
            func.avg(Reading.diastolic), func.min(Reading.diastolic), func.max(Reading.diastolic),
            func.avg(Reading.pulse), func.min(Reading.pulse), func.max(Reading.pulse),
        )
    )
    row = db.execute(agg).one()
    count = row[0]

    def vitals(avg: float | None, lo: int | None, hi: int | None) -> VitalStats | None:
        if count == 0:
            return None
        return VitalStats(avg=round(avg, 1), min=lo, max=hi)

    cat_counts = dict(
        db.execute(
            filters.apply(
                select(Reading.bp_category, func.count(Reading.id)).group_by(Reading.bp_category)
            )
        ).all()
    )
    categories = [  # zero-fill ALL six in clinical order — chart + strip always complete
        CategoryStat(
            category=c,
            count=cat_counts.get(c, 0),
            percent=round(100 * cat_counts.get(c, 0) / count, 1) if count else 0.0,
        )
        for c in CLINICAL_ORDER
    ]

    # UNFILTERED on purpose: D-11 empty state + preset anchoring need the
    # newest reading that exists, regardless of the current filter set.
    latest = db.scalar(select(func.max(Reading.datetime_)))

    return StatsSummary(
        count=count,
        systolic=vitals(row[1], row[2], row[3]),
        diastolic=vitals(row[4], row[5], row[6]),
        pulse=vitals(row[7], row[8], row[9]),
        categories=categories,
        latest_reading=latest.isoformat() if latest is not None else None,
    )
