#!/usr/bin/env bash
#
# Live smoke test for the deployed Health Dashboard backend (DEPL-02 / SC2).
#
# Proves, against the LIVE Railway URL:
#   1. Every gated route returns 401 without a valid Bearer token, curled with
#      its REAL HTTP method. verify_token is a router-level dependency, not
#      middleware: Starlette returns 405 on a method mismatch BEFORE the gate
#      runs, so only each route's real method exercises the auth gate.
#   2. Wrong password -> 401.
#   3. Correct password -> signed token -> GET /readings with the token -> 200.
#
# Secrets are read from the environment and never echoed (no password/token in output).
#
# Usage:
#   BASE=https://<app>.up.railway.app SITE_PASSWORD='...' bash scripts/smoke.sh
#
set -euo pipefail

: "${BASE:?set BASE to the live Railway URL, e.g. https://<app>.up.railway.app}"
: "${SITE_PASSWORD:?set SITE_PASSWORD (never hardcode it)}"
BASE="${BASE%/}"  # strip any trailing slash

fail() { echo "FAIL: $*" >&2; exit 1; }

# code METHOD PATH [curl-args...]  -> prints the HTTP status code
code() {
  local method="$1" path="$2"; shift 2
  curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" "$@"
}

echo "Smoke test against $BASE"

# 1. Every gated route -> 401 without a token, using each route's REAL method.
assert_401() {
  local method="$1" path="$2"; shift 2
  local got
  got="$(code "$method" "$path" "$@")"
  [ "$got" = "401" ] || fail "$method $path expected 401 without token, got $got"
  echo "  OK  $method $path -> 401 (gated)"
}
assert_401 GET  /readings
assert_401 GET  /stats/summary
assert_401 POST /agent        -H 'Content-Type: application/json' -d '{}'
assert_401 POST /upload

# 2. Wrong password -> 401.
got="$(code POST /auth -H 'Content-Type: application/json' -d '{"password":"__definitely-wrong__"}')"
[ "$got" = "401" ] || fail "POST /auth wrong password expected 401, got $got"
echo "  OK  POST /auth (wrong password) -> 401"

# 3. Correct password -> token -> GET /readings with Bearer -> 200.
#    The password is piped via a request-body file so it never appears in argv/logs.
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
python3 - "$SITE_PASSWORD" >"$body_file" <<'PY'
import json, sys
print(json.dumps({"password": sys.argv[1]}))
PY

token="$(curl -s -X POST "$BASE/auth" -H 'Content-Type: application/json' --data-binary @"$body_file" \
         | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')"
[ -n "$token" ] || fail "POST /auth with SITE_PASSWORD did not return a token"
echo "  OK  POST /auth (correct password) -> token issued"

got="$(code GET /readings -H "Authorization: Bearer $token")"
[ "$got" = "200" ] || fail "GET /readings with valid token expected 200, got $got"
echo "  OK  GET /readings (Bearer token) -> 200"

echo "PASS"
