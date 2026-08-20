"""GET /incidents + POST /incidents — filterable incident list and create (OVERLAY-01).

Pinned invariants (mirrors readings.py exactly, plus a create route):
  - Filters come exclusively from the shared ``IncidentFilters`` dependency
    (date-range only, D-04; ``Incident.datetime_`` is a ``DateTime`` column so
    filtering uses the same inclusive end-of-day treatment as ``ReadingFilters``).
  - Results ordered by datetime ascending; naive local datetimes end-to-end
    (DATA-05).
  - DB access via ``get_db`` only — never import ``SessionLocal`` here
    (RESEARCH Pitfall 10).
  - POST returns the full created record (D-02), never a bare ack — the row
    is refreshed after commit so the DB-assigned ``id`` is populated before
    ``response_model`` serialization.
  - ``IncidentCreate.datetime`` does NOT match the ORM attribute
    ``Incident.datetime_``, so the row is constructed explicitly field-by-field
    (NOT ``**body.model_dump()``, which would fail: ``datetime`` is not a valid
    ``Incident.__init__`` kwarg).
  - No manual try/except: FastAPI/Pydantic already 422s a malformed body
    before the handler runs.
  - Gated at ``include_router`` time in ``app.main`` — never a per-route
    ``Depends(verify_token)`` here.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import IncidentFilters, get_db
from app.models import Incident
from app.schemas import IncidentCreate, IncidentOut

router = APIRouter()


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(
    filters: Annotated[IncidentFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> list[Incident]:
    """Return incidents matching the filter set, datetime ascending."""
    stmt = filters.apply(select(Incident)).order_by(Incident.datetime_)
    return list(db.scalars(stmt).all())


@router.post("/incidents", response_model=IncidentOut)
def create_incident(
    body: IncidentCreate,
    db: Annotated[Session, Depends(get_db)],
) -> Incident:
    """Create an incident and return the full stored record, including its id."""
    row = Incident(
        datetime_=body.datetime,
        incident_type=body.incident_type,
        duration=body.duration,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
