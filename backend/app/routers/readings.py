"""GET /readings — filterable reading list (API-01).

Pinned invariants:
  - Filters come exclusively from the shared ``ReadingFilters`` dependency
    (one filter semantics with /stats/summary; Phase 3's agent reuses it).
  - Serves STORED derived values only — categories are never recomputed here
    (DATA-01; ``app.derivations`` is the single source of truth).
  - Results ordered by datetime ascending; naive local datetimes end-to-end
    (DATA-05).
  - DB access via ``get_db`` only — never import ``SessionLocal`` here
    (RESEARCH Pitfall 10).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import ReadingFilters, get_db
from app.models import Reading
from app.schemas import ReadingOut

router = APIRouter()


@router.get("/readings", response_model=list[ReadingOut])
def list_readings(
    filters: Annotated[ReadingFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> list[Reading]:
    """Return readings matching the filter set, datetime ascending."""
    stmt = filters.apply(select(Reading)).order_by(Reading.datetime_)
    return list(db.scalars(stmt).all())
