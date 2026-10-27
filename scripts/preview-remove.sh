#!/usr/bin/env bash
# CI (preview.yml, preview-cleanup.yml): removes a PR preview stage
# (docs/plans/e2e-live-environments.md) with `sst remove`, the only way its AWS resources go away.
# Needs credentials for the preview role in us-west-2.
#
#   scripts/preview-remove.sh pr-123
set -euo pipefail
cd "$(dirname "$0")/.."

remove() {
  local stage=$1
  [[ $stage =~ ^pr-[0-9]+$ ]] || { echo "Not a PR stage: $stage" >&2 && return 1; }
  echo "Removing $stage"
  # A cancelled deploy leaves the stage locked.
  pnpm sst unlock --stage "$stage"
  pnpm sst remove --stage "$stage"
  # SST keeps the stage's secrets passphrase; the stage won't come back.
  aws ssm delete-parameter --name "/sst/passphrase/yallist/$stage" 2>/dev/null || true
  # The tagging API lags behind deletes by a few minutes.
  local left
  for _ in $(seq 10); do
    left=$(aws resourcegroupstaggingapi get-resources --tag-filters "Key=stage,Values=$stage" \
      --query 'ResourceTagMappingList[].ResourceARN' --output text)
    [[ -z $left ]] && return 0
    sleep 30
  done
  echo "Still tagged stage=$stage after sst remove: $left" >&2
  return 1
}

remove "$1"
