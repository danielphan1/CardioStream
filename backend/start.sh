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
  done < <(find /app /opt /root /usr/local -maxdepth 6 -type f -name 'python*' \
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

echo "start.sh: starting uvicorn on port ${PORT:-8000}..."
exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
