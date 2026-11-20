#!/usr/bin/env bash
# CI (deploy.yml, preview.yml): applies the database migrations to a stage before `sst deploy`
# puts its new code live, so the columns and tables that code reads already exist
# (docs/deploy.md, Migrations). The workflows migrate again after the deploy.
#
#   scripts/migrate-before-deploy.sh dev
#
# `sst shell` links what the stage's last deploy created. A stage that hasn't been deployed (its
# first deploy, a new PR preview, or one removed since) has no state or no database, so it is
# skipped with a warning: the migrate after the deploy creates its schema. A migration that fails
# fails the job, so the new code isn't deployed onto a schema without its changes.
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
marks=$(mktemp -d)
trap 'rm -rf "$marks"' EXIT

if pnpm sst shell --stage "$stage" -- "$PWD/scripts/migrate-before-deploy.sh" --in-shell "$marks"; then
  if [[ -e $marks/no-database ]]; then
    echo "::notice::$stage has no database yet; it is migrated after the deploy."
  fi
  exit 0
fi
# The migration ran and failed: don't deploy.
[[ -e $marks/ran ]] && exit 1
# `sst shell` couldn't load the stage: never deployed, or removed (or AWS failed; the deploy
# would then fail too).
echo "::warning::sst shell couldn't load $stage (not deployed yet?); it is migrated after the deploy only."
