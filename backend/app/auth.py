"""Auth dependency stub for the read API (API-01/API-02).

Phase 2 design stub: ``verify_token`` is a deliberate no-op dependency that is
attached at ROUTER level in ``app.main`` (never per-route). Phase 5 replaces
the body with itsdangerous signed-token verification behind the shared
password gate — the routes themselves never change (roadmap decision: auth
designed in Phase 2, enforced in Phase 5, never a retrofit; threat T-02-03
accepted for local/dev exposure this phase).
"""

from fastapi import Header, HTTPException, status
from itsdangerous import BadData, URLSafeTimedSerializer

from app.config import get_settings


def _serializer() -> URLSafeTimedSerializer:
    """Return the shared signer for the Bearer token.

    The ``/auth`` route imports this same helper so issue (``dumps``) and
    verify (``loads``) share one serializer; the ``salt`` namespaces the
    signature. Reads ``token_secret`` fresh each call so tests that override
    the secret via env + ``get_settings.cache_clear()`` take effect.
    """
    return URLSafeTimedSerializer(get_settings().token_secret, salt="auth-gate")


def verify_token(authorization: str | None = Header(default=None)) -> None:
    """Enforce a valid signed Bearer token (SEC-01), returning 401 (never 403).

    Parses the ``Authorization`` header manually rather than via FastAPI's
    ``HTTPBearer`` (which returns 403 — SC2/D-13 mandate 401, RESEARCH
    Pitfall 4). Calls ``loads`` with NO ``max_age`` so the token never expires
    (D-02). Missing/malformed headers and tampered/forged tokens all raise the
    same opaque 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        _serializer().loads(token)  # NO max_age -> non-expiring (D-02)
    except BadData as exc:  # BadSignature/BadData -> tampered/forged token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized"
        ) from exc
    return None
