#!/usr/bin/env bash
# UI tests (Maestro, apps/mobile/e2e) on web: the static web export against the local API, on a
# database made for this run and dropped after it. See docs/plans/ui-tests.md.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres scripts/e2e-web.sh [args]
#
# DATABASE_URL is only used to create and drop the run's database. Needs psql and the Maestro
# CLI (on PATH, or MAESTRO=/path/to/maestro). Args are flow files or folders (default: all).
# Results go to $E2E_OUT (default: a temp dir): junit.xml, the API and web logs, and per flow
# under maestro/ a video (startRecording/), screenshots on failure and Maestro's logs.
#
# CI splits the flows in two: E2E_SHARD=1 runs the flows tagged shard-1, E2E_SHARD=2 the rest
# (new flows land there; tag one shard-1 when shard 2 gets longer). E2E_PREBUILT=1 serves an
# existing apps/mobile/dist, exported with EXPO_PUBLIC_API_URL=http://localhost:$API_PORT and
# EXPO_PUBLIC_E2E as below, and no EXPO_PUBLIC_REALTIME_URL: there's no AppSync locally, so the
# app doesn't subscribe to live updates (src/lib/realtime.ts).
#
# E2E_BASE_PATH=/pr-123 serves the API and the web app under that path, as a PR preview does
# (docs/plans/e2e-live-environments.md): the export uses it as its base URL and the web server
# falls back to its index.html, like the preview's CloudFront Router.
#
# E2E_WEB_URL=https://<router>/pr-123/ runs the flows against a deployed PR preview instead
# (.github/workflows/preview.yml); then nothing is started locally and DATABASE_URL isn't needed.
set -euo pipefail
cd "$(dirname "$0")/.."

# Runs the Maestro flows against the web app at $1; the other args are flow files or folders.
run_flows() {
  local url=$1
  shift
  (($#)) || set -- apps/mobile/e2e
  case ${E2E_SHARD:-} in
    '') ;;
    1) set -- --include-tags shard-1 "$@" ;;
    2) set -- --exclude-tags shard-1 "$@" ;;
    *) echo "E2E_SHARD must be 1 or 2" >&2 && exit 1 ;;
  esac
  # Recording needs Chrome DevTools for a Chrome version that Maestro 2.11.0 bundles (145–147).
  # Selenium Manager downloads that Chrome for Testing once (~/.cache/selenium).
  export SE_BROWSER_VERSION=${SE_BROWSER_VERSION:-147}
  # A tall phone-width window: the phone layout, with nothing below the fold (taps don't scroll).
  MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
    "${MAESTRO:-maestro}" test -p web --headless --screen-size 500x1400 \
    -e WEB_URL="$url" --test-output-dir "$OUT/maestro" \
    --format junit --output "$OUT/junit.xml" "$@"
}

OUT=${E2E_OUT:-$(mktemp -d)}
mkdir -p "$OUT"
if [[ -n ${E2E_WEB_URL:-} ]]; then
  run_flows "$E2E_WEB_URL" "$@"
  exit
fi

: "${DATABASE_URL:?Set DATABASE_URL to a local Postgres (see docs/deploy.md)}"
API_PORT=${API_PORT:-3100}
WEB_PORT=${WEB_PORT:-8180}
BASE=${E2E_BASE_PATH:-}
db="e2e_$(date +%s)_$$"
bin=$PWD/node_modules/.bin

psql "$DATABASE_URL" -qc "create database $db"
cleanup() {
  # shellcheck disable=SC2046 # one pid per word
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
  psql "$DATABASE_URL" -qc "drop database if exists $db with (force)"
}
trap cleanup EXIT

# The API migrates its empty database on start.
(cd apps/api && DATABASE_URL="${DATABASE_URL%/*}/$db" PORT=$API_PORT BASE_PATH=$BASE \
  exec node --import tsx src/dev.ts) >"$OUT/api.log" 2>&1 &

if [[ -z ${E2E_PREBUILT:-} ]]; then
  # EXPO_PUBLIC_E2E opens the test-only routes (src/app/dev/crash.tsx).
  (cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:$API_PORT$BASE EXPO_PUBLIC_REALTIME_URL='' \
    BASE_PATH=$BASE EXPO_PUBLIC_E2E=1 "$bin/expo" export -p web) >"$OUT/export.log" 2>&1
fi
# Serves the export under the base path, falling back to its index.html for the deep links the
# flows open (/dev/crash, /j/<token>), like the deployed site. expo serve does neither.
# shellcheck disable=SC2016 # JavaScript template literals, not shell
DIST=apps/mobile/dist BASE=$BASE PORT=$WEB_PORT node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  import { createServer } from "node:http";
  import { extname, join, normalize } from "node:path";
  const { DIST, BASE, PORT } = process.env;
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
    ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf" };
  createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (!path.startsWith(`${BASE}/`)) return res.writeHead(404).end();
    const file = join(DIST, normalize(path.slice(BASE.length)));
    const body = await readFile(file).catch(() => undefined);
    res.writeHead(200, { "content-type": (body && types[extname(file)]) || "text/html" });
    res.end(body ?? (await readFile(join(DIST, "index.html"))));
  }).listen(PORT);
' >"$OUT/web.log" 2>&1 &

for url in "http://localhost:$API_PORT$BASE/health" "http://localhost:$WEB_PORT$BASE/"; do
  for _ in $(seq 60); do curl -sf -o /dev/null "$url" && continue 2; sleep 0.5; done
  echo "$url didn't come up; logs in $OUT" >&2
  exit 1
done

run_flows "http://localhost:$WEB_PORT${BASE:+$BASE/}" "$@"
