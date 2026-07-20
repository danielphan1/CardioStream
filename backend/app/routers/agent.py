"""POST /agent — rate-limited, authenticated text->validated-command endpoint (API-04/API-05).

Pinned invariants:
  - The interpreter is injected via ``get_interpreter`` (mirrors ``get_db``, so
    tests swap a fake with ``app.dependency_overrides`` — RESEARCH Pattern 3);
    the route itself does no interpretation.
  - Route-level never-500 backstop: the whole body is wrapped so ANY unexpected
    error (including from a misbehaving interpreter) collapses to a friendly 200
    ``unclear`` reply — the frontend never sees a raw error or 500 (VOICE-07,
    Pitfall 5).
  - Date anchors are queried HERE, unfiltered, and handed to the interpreter;
    Claude never computes dates (API-05, Pitfall 4). The anchor query mirrors
    stats.py exactly — ``func.max/min(Reading.datetime_)`` (trailing underscore
    on the ORM attribute; the DB column is ``datetime``).
  - DB access flows through ``get_db`` only (never a direct SessionLocal import).
  - slowapi: the ``@router.post`` decorator sits ABOVE ``@limiter.limit`` and the
    signature declares ``request: Request`` — slowapi silently no-ops without
    both (Pitfall 6). 20/minute per-IP caps Claude cost/DoS (T-03-13, SEC-02).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent.copy import UNCLEAR_MESSAGE
from app.agent.schemas import AgentReply, AgentRequest
from app.agent.service import Interpreter, interpret
from app.deps import get_db
from app.models import Reading

# Per-IP limiter; app.main wires app.state.limiter + the 429 exception handler.
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


def get_interpreter() -> Interpreter:
    """Return the interpretation callable; override-able in tests (Pattern 3)."""
    return interpret


@router.post("/agent", response_model=AgentReply)
@limiter.limit("20/minute")
def agent(
    request: Request,  # REQUIRED by slowapi — do not remove (Pitfall 6)
    body: AgentRequest,
    db: Annotated[Session, Depends(get_db)],
    interpreter: Annotated[Interpreter, Depends(get_interpreter)],
) -> AgentReply:
    """Interpret a text/transcript command into a server-composed dashboard reply."""
    try:
        # Unfiltered anchors — the newest/oldest readings that exist, for
        # symbolic date resolution (API-05, Pitfall 4). None on an empty DB.
        latest = db.scalar(select(func.max(Reading.datetime_)))
        earliest = db.scalar(select(func.min(Reading.datetime_)))
        earliest_date = earliest.date() if earliest is not None else None
        latest_date = latest.date() if latest is not None else None
        return interpreter(body.text, body.context, earliest_date, latest_date)
    except Exception:  # noqa: BLE001 — route-level never-500 backstop (VOICE-07)
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
