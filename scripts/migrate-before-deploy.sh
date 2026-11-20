#!/usr/bin/env bash
# CI (deploy.yml, preview.yml): applies the database migrations to a stage before `sst deploy`
# puts its new code live, so the columns and tables that code reads already exist
# (docs/deploy.md, Database). The workflows migrate again after the deploy.
#
#   scripts/migrate-before-deploy.sh dev                          # fails unless migrated
#   scripts/migrate-before-deploy.sh pr-123 --stage-may-not-exist # previews only
#
# `sst shell` links what the stage's last deploy created. Any failure fails the job before anything
# deploys, and a rerun is safe. dev and production always exist, so a stage that can't be loaded
# is an error there, not a first deploy. Only a PR preview may not exist yet (its first push, or
# its first since it was removed): with --stage-may-not-exist it is skipped, and the migrate after
# the deploy creates its schema.
set -euo pipefail
cd "$(dirname "$0")/.."

# Inside `sst shell`: say that it ran and whether the stage has a database, then migrate.
if [[ ${1:-} == --in-shell ]]; then
  marks=$2
  touch "$marks/ran"
  if [[ -z ${SST_RESOURCE_Database:-} ]]; then
    touch "$marks/no-database"
    exit 0
  fi
  exec pnpm --filter @yallist/api db:migrate
fi

stage=$1
may_not_exist=false
if [[ ${2:-} == --stage-may-not-exist ]]; then
  [[ $stage =~ ^pr-[0-9]+$ ]] || { echo "--stage-may-not-exist is for PR stages, not $stage" >&2 && exit 1; }
  may_not_exist=true
fi
marks=$(mktemp -d)
trap 'rm -rf "$marks"' EXIT
# SST logs why it exited here (`pnpm sst` runs in infra/app); start from an empty one.
log=infra/app/.sst/log/sst.log
rm -f "$log"

skip() {
  echo "::$1::$stage: $2; it is migrated after the deploy only."
  exit 0
}

if pnpm sst shell --stage "$stage" -- "$PWD/scripts/migrate-before-deploy.sh" --in-shell "$marks"; then
  [[ -e $marks/no-database ]] || exit 0
  $may_not_exist || { echo "$stage has no Database linked" >&2 && exit 1; }
  skip notice "no database yet"
fi
# The migration ran and failed: don't deploy.
[[ -e $marks/ran ]] && exit 1
# `sst shell` couldn't load the stage.
$may_not_exist || { echo "::error::sst shell couldn't load $stage (see the error above)" && exit 1; }
# Never deployed: no state at all (provider.ErrStateNotFound, SST 4.17.2).
if grep -q 'msg="exited with error" err="state not found"' "$log" 2>/dev/null; then
  skip notice "not deployed yet"
fi
# Anything else. A preview removed by preview-cleanup.yml (its SST passphrase deleted, its empty
# state kept) may land here, and that error hasn't been seen yet, so a preview warns, not fails.
skip warning "sst shell couldn't load the stage (see the error above)"
