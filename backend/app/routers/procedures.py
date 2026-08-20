"""GET /procedures + POST /procedures — filterable procedure list and create (OVERLAY-01).

Pinned invariants (mirrors readings.py exactly, plus a create route):
  - Filters come exclusively from the shared ``ProcedureFilters`` dependency
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

from app.deps import ProcedureFilters, get_db
from app.models import Procedure
from app.schemas import ProcedureCreate, ProcedureOut

router = APIRouter()


@router.get("/procedures", response_model=list[ProcedureOut])
def list_procedures(
    filters: Annotated[ProcedureFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> list[Procedure]:
    """Return procedures matching the filter set, date ascending."""
    stmt = filters.apply(select(Procedure)).order_by(Procedure.date)
    return list(db.scalars(stmt).all())


@router.post("/procedures", response_model=ProcedureOut)
def create_procedure(
    body: ProcedureCreate,
    db: Annotated[Session, Depends(get_db)],
) -> Procedure:
    """Create a procedure and return the full stored record, including its id."""
    row = Procedure(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
