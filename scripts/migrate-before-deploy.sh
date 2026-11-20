#!/usr/bin/env bash
# CI (deploy.yml, preview.yml): applies the database migrations to a stage before `sst deploy`
# puts its new code live, so the columns and tables that code reads already exist
# (docs/deploy.md, Database). The workflows migrate again after the deploy.
#
#   scripts/migrate-before-deploy.sh <stage> [--stage-may-not-exist]
#
# `sst shell` links what the stage's last deploy created. Any failure fails the job before anything
# deploys, and a rerun is safe. dev and production always exist, so a stage that can't be loaded
# is an error there. --stage-may-not-exist lets a stage that was never deployed be skipped (the
# migrate after the deploy creates its schema):
#   pr-<n>         previews (preview.yml): a PR's first push, or its first since it was removed.
#   dev/production only in a manual deploy.yml run with `bootstrap` checked, for a new stage.
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

usage() {
  echo "Usage: $0 <stage> [--stage-may-not-exist]" >&2
  exit 1
}
stage=
may_not_exist=false
for arg in "$@"; do
  case $arg in
    --stage-may-not-exist) may_not_exist=true ;;
    -*) usage ;;
    *)
      [[ -z $stage ]] || usage
      stage=$arg
      ;;
  esac
done
[[ -n $stage ]] || usage
preview=false
[[ $stage =~ ^pr-[0-9]+$ ]] && preview=true
if $may_not_exist && ! $preview && [[ ${GITHUB_EVENT_NAME:-} != workflow_dispatch ]]; then
  echo "--stage-may-not-exist is for PR stages, or a manual bootstrap run of deploy.yml" >&2
  exit 1
fi

marks=$(mktemp -d)
trap 'rm -rf "$marks"' EXIT
# SST logs why it exited here (`pnpm sst` runs in infra/app), not on the console, and the runner
# discards it: start from an empty one and print its errors on failure.
log=infra/app/.sst/log/sst.log
rm -f "$log"

skip() {
  echo "::$1::$stage: $2; it is migrated after the deploy only."
  exit 0
}
fail() {
  echo "::error::$stage: $1. Nothing was deployed; rerunning is safe."
  if [[ -s $log ]]; then
    echo "SST's errors (from $log):"
    grep -E 'level=ERROR|exited with error' "$log" | tail -n 20 || true
  fi
  exit 1
}

if pnpm sst shell --stage "$stage" -- "$PWD/scripts/migrate-before-deploy.sh" --in-shell "$marks"; then
  [[ -e $marks/no-database ]] || exit 0
  $may_not_exist || fail "no Database is linked to the stage"
  skip notice "no database yet"
fi
[[ -e $marks/ran ]] && fail "the migration failed (its output is above)"
# `sst shell` couldn't load the stage. Never deployed: no state at all (provider.ErrStateNotFound,
# SST 4.17.2).
if $may_not_exist && grep -q 'msg="exited with error" err="state not found"' "$log" 2>/dev/null; then
  skip notice "not deployed yet"
fi
# Anything else fails, except on a preview: one removed by preview-cleanup.yml (its SST passphrase
# deleted, its empty state kept) may land here, and that error hasn't been seen yet.
if $may_not_exist && $preview; then
  if [[ -s $log ]]; then grep -E 'level=ERROR|exited with error' "$log" | tail -n 20 || true; fi
  skip warning "sst shell couldn't load the stage"
fi
fail "sst shell couldn't load the stage"
