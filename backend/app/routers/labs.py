"""GET /labs + POST /labs — filterable lab-result list and create (OVERLAY-01).

Pinned invariants (mirrors readings.py exactly, plus a create route):
  - Filters come exclusively from the shared ``LabFilters`` dependency
    (date-range only, D-04).
  - Results ordered by date ascending; naive local dates end-to-end (DATA-05).
  - DB access via ``get_db`` only — never import ``SessionLocal`` here
    (RESEARCH Pitfall 10).
  - POST returns the full created record (D-02), never a bare ack — the row
    is refreshed after commit so the DB-assigned ``id`` is populated before
    ``response_model`` serialization.
  - No manual try/except: FastAPI/Pydantic already 422s a malformed body
    before the handler runs (no analog to upload.py's file-parsing backstop).
  - Gated at ``include_router`` time in ``app.main`` — never a per-route
    ``Depends(verify_token)`` here.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import LabFilters, get_db
from app.models import LabResult
from app.schemas import LabResultCreate, LabResultOut

router = APIRouter()


@router.get("/labs", response_model=list[LabResultOut])
def list_labs(
    filters: Annotated[LabFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> list[LabResult]:
    """Return lab results matching the filter set, date ascending."""
    stmt = filters.apply(select(LabResult)).order_by(LabResult.date)
    return list(db.scalars(stmt).all())


@router.post("/labs", response_model=LabResultOut)
def create_lab(
    body: LabResultCreate,
    db: Annotated[Session, Depends(get_db)],
) -> LabResult:
    """Create a lab result and return the full stored record, including its id."""
    row = LabResult(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
