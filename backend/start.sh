#!/usr/bin/env bash
# Railway/Railpack start script.
#
# Railpack installs the Python dependencies into a virtualenv, but the `python`
# on PATH for a custom start command is the bare mise interpreter, which has
# none of our packages (bare `alembic`/`uvicorn` -> command not found; the mise
# `python` cannot import `alembic.config`). So we locate the interpreter that
# actually has our deps installed, then run migrations + uvicorn with it.
set -u

find_python() {
  # 1. Common venv locations + whatever is on PATH.
  for cand in \
    /app/.venv/bin/python \
    ./.venv/bin/python \
    /opt/venv/bin/python \
    "$(command -v python3 2>/dev/null || true)" \
    "$(command -v python 2>/dev/null || true)"; do
    [ -n "$cand" ] && [ -x "$cand" ] || continue
    if "$cand" -c "import alembic.config, uvicorn" >/dev/null 2>&1; then
      printf '%s\n' "$cand"; return 0
    fi
  done
  # 2. Fallback: search likely roots for an interpreter that imports our deps.
  local p
  while IFS= read -r p; do
    [ -x "$p" ] || continue
    if "$p" -c "import alembic.config, uvicorn" >/dev/null 2>&1; then
      printf '%s\n' "$p"; return 0
    fi
  done < <(find /app /opt /root /usr/local /mise /nix -maxdepth 8 -type f -name 'python*' \
             -path '*/bin/*' 2>/dev/null)
  return 1
}

PYTHON="$(find_python)"
if [ -z "${PYTHON:-}" ]; then
  echo "FATAL: no interpreter with alembic+uvicorn installed was found." >&2
  exit 1
fi
echo "start.sh: using interpreter $PYTHON"

echo "start.sh: running database migrations (alembic upgrade head)..."
"$PYTHON" -m alembic upgrade head

# Boot-time auto-seed, gated STRICTLY on SITE_USERNAME (demo deployments only).
# Never a second, independently-set flag: SITE_USERNAME already means "demo
# deployment" everywhere else (auth, /health), so gating on it here makes this
# dead code on Chris's real deployment (which never sets it) rather than a
# second flag someone could forget to unset. A fresh container's gitignored
# data/ dir is always absent, so an ungated seed would silently inject
# synthetic data into a real production DB on every restart (RESEARCH Pitfall 1).
if [ -n "${SITE_USERNAME:-}" ]; then
  echo "start.sh: SITE_USERNAME is set (demo deployment) — seeding demo data..."
  "$PYTHON" -m app.seed || echo "start.sh: WARNING seed step failed (continuing boot)"
fi

echo "start.sh: starting uvicorn on port ${PORT:-8000}..."
exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
