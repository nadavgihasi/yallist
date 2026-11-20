#!/usr/bin/env bash
# Starts the API (port 3100) and the web app (port 8180) from a checkout, on a fresh Postgres
# database, and leaves them running for screenshots and review agents.
#
#   serve-stack.sh <repo-checkout> <work-dir>
#
# The database name goes to <work-dir>/qa-db.txt (shots-common.cjs reads it as SMOKE_DB), logs to
# <work-dir>/*.log. The web export takes ~8 minutes: run this in the background.
# Stop with: pkill -f "src/de[v].ts"; pkill -f "serv[e].mjs"
set -euo pipefail
REPO=$(cd "$1" && pwd)
WORK=$(mkdir -p "$2" && cd "$2" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
PG=${PG_URL:-postgres://postgres:postgres@localhost:5432}

pg_isready -q -d "$PG/postgres" || service postgresql start
db="qa_$(date +%s)"
psql "$PG/postgres" -qc "create database $db"
echo "$db" > "$WORK/qa-db.txt"

(cd "$REPO/apps/api" && DATABASE_URL="$PG/$db" PORT=3100 nohup node --import tsx src/dev.ts > "$WORK/api.log" 2>&1 &)
(cd "$REPO/apps/mobile" && EXPO_PUBLIC_API_URL=http://localhost:3100 EXPO_PUBLIC_REALTIME_URL='' \
  EXPO_PUBLIC_E2E=1 npx expo export -p web > "$WORK/export.log" 2>&1)
# Serve a copy, so checking out another commit for "before" shots doesn't change the running app.
rm -rf "$WORK/dist" && cp -r "$REPO/apps/mobile/dist" "$WORK/dist"
(nohup node "$HERE/serve.mjs" "$WORK/dist" > "$WORK/web.log" 2>&1 &)

for _ in $(seq 60); do
  curl -sf -o /dev/null localhost:3100/health && curl -sf -o /dev/null localhost:8180/ && echo READY && exit 0
  sleep 1
done
echo NOT-READY; exit 1
