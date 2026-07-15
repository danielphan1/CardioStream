"""Auth dependency stub for the read API (API-01/API-02).

Phase 2 design stub: ``verify_token`` is a deliberate no-op dependency that is
attached at ROUTER level in ``app.main`` (never per-route). Phase 5 replaces
the body with itsdangerous signed-token verification behind the shared
password gate — the routes themselves never change (roadmap decision: auth
designed in Phase 2, enforced in Phase 5, never a retrofit; threat T-02-03
accepted for local/dev exposure this phase).
"""


def verify_token() -> None:
    """No-op auth dependency (Phase 2 design stub).

    Phase 5 replaces this body with itsdangerous token verification —
    routes never change because the dependency is attached at router level.
    """
    return None
