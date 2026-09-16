"""POST /auth — ungated, rate-limited password check that issues the token (SEC-01).

Pinned invariants:
  - UNGATED: wired in ``app.main`` WITHOUT ``Depends(verify_token)`` — it must
    be reachable to issue the token every other route requires (chicken-and-egg).
  - Reuses the SINGLE ``limiter`` instance from the agent router so
    ``app.state.limiter`` stays one object (never a second Limiter).
  - slowapi ordering (RESEARCH Pitfall 5): ``@router.post`` sits ABOVE
    ``@limiter.limit`` and the signature declares ``request: Request`` first —
    miss either and rate limiting silently no-ops.
  - Constant-time password compare via ``hmac.compare_digest`` (never ``==``,
    threat T-05-03) and NOTHING about the candidate password is ever logged
    (RESEARCH Pitfall 8 / D-14).
  - FAILS CLOSED on misconfiguration (T-GCV-01): if ``site_password`` is empty
    — a deploy that forgot to set SITE_PASSWORD — NO token is ever issued.
    Previously the empty default matched an empty candidate and handed a valid
    token to any anonymous caller.
  - Compares utf-8 BYTES, never ``str`` (T-GCV-02): ``hmac.compare_digest``
    raises TypeError on non-ASCII ``str`` input, which escaped the route as an
    uncaught 500. Bytes keep the compare constant-time and make a unicode
    password just another wrong password.
  - Both failure modes raise the SAME opaque 401 already used for a wrong
    password — never a distinct message, never a hint about which one tripped.
"""

import hmac

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.auth import _serializer
from app.config import get_settings
from app.routers.agent import limiter  # reuse the single limiter instance

router = APIRouter()


class AuthRequest(BaseModel):
    password: str
    username: str | None = None


class AuthResponse(BaseModel):
    token: str


@router.post("/auth", response_model=AuthResponse)
@limiter.limit("5/minute")  # brute-force guard (Pitfall 5 order rules apply)
def auth(request: Request, body: AuthRequest) -> AuthResponse:  # noqa: ARG001
    """Check the shared password (and, on a demo deployment, username) in constant
    time; issue a signed token on match.

    Guest-demo deployments (Phase 19, D-03/D-10) additionally require a matching
    ``site_username``. ``user_ok`` is trivially true when ``site_username`` is
    unconfigured (today's real deployment) so a stray ``username`` field a
    misdirected caller sends is silently ignored — byte-for-byte backward
    compatible. Both checks fold into ONE gate so wrong-username, wrong-password,
    and missing-username all collapse into the identical opaque 401 (D-10) —
    never a field-specific hint.
    """
    configured_user = get_settings().site_username
    configured_pass = get_settings().site_password
    user_ok = not configured_user or hmac.compare_digest(
        (body.username or "").encode("utf-8"), configured_user.encode("utf-8")
    )
    pass_ok = bool(configured_pass) and hmac.compare_digest(
        body.password.encode("utf-8"), configured_pass.encode("utf-8")
    )
    if not (user_ok and pass_ok):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return AuthResponse(token=_serializer().dumps("authorized"))
