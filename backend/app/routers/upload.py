"""POST /upload — thin gated adapter over the shared ETL (API-03, SEC-01).

Pinned invariants:
  - No ETL logic lives here. The route buffers ``UploadFile.file`` straight
    into the already-tested, idempotent pipeline
    (``parse_omron`` -> ``transform`` -> ``merge_readings``) and returns the
    locked D-06 ``IngestSummary`` verbatim — never wrapped or renamed.
  - ``.xlsx``-only guard first: a non-xlsx filename is rejected with a friendly
    HTTP 400 ("not-omron") before any bytes are read.
  - Never a 500 on a bad file (D-10): any parse/transform failure collapses to
    HTTPException(400, "not-omron"). A deliberately-raised HTTPException (the
    extension guard) is re-raised unchanged.
  - DB access flows through ``get_db`` only — never a direct ``SessionLocal``
    import (RESEARCH Pitfall 10); ``merge_readings`` commits in one transaction.
  - Log hygiene (T-05-08): the route logs nothing about row values or the
    filename; the ETL's value-free ``RejectedRow.reason`` carries all detail.
  - The router attaches ``Depends(verify_token)`` at include time in
    ``app.main`` (T-05-07) — gated exactly like every other data route.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.deps import get_db
from app.etl import IngestSummary, merge_readings, parse_omron, transform

router = APIRouter()


@router.post("/upload", response_model=IngestSummary)
def upload(file: UploadFile, db: Annotated[Session, Depends(get_db)]) -> IngestSummary:
    """Ingest an OMRON .xlsx export via the shared ETL, returning IngestSummary.

    Sync (runs in the threadpool like the other routes). Extension guard first,
    then the full pipeline wrapped so any bad file becomes a 400, never a 500.
    """
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="not-omron")
    try:
        raw = parse_omron(file.file)
        clean, rejected = transform(raw)
        return merge_readings(db, clean, rejected)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — never-500 backstop (D-10)
        raise HTTPException(status_code=400, detail="not-omron") from exc
