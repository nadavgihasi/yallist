#!/usr/bin/env bash
# CI (preview.yml): removes PR preview stages (docs/plans/e2e-live-environments.md) with
# `sst remove`, the only way their AWS resources go away. Needs credentials for the preview role
# in us-west-2, and GH_TOKEN for --expired.
#
#   scripts/preview-remove.sh pr-123   # that PR's stage
#   scripts/preview-remove.sh --expired
#
# --expired removes every stage whose API Lambda's expires-at tag (6 h after its last deploy,
# infra/app/stacks/preview-pr.ts) has passed, or whose PR is closed. It fails after removing a stage of a
# closed PR: closing should have removed it, so something leaked.
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

if [[ ${1:-} != --expired ]]; then
  remove "$1"
  exit
fi

now=$(date -u +%Y-%m-%dT%H:%M:%S.000Z) # the format of Date.toISOString()
mapfile -t stages < <(aws resourcegroupstaggingapi get-resources \
  --resource-type-filters lambda:function --tag-filters Key=app,Values=yallist Key=expires-at \
  --query 'ResourceTagMappingList[].Tags' --output json |
  jq -r '.[] | from_entries | select(.stage | test("^pr-[0-9]+$")) | "\(.stage) \(.["expires-at"])"')
failed=0
for line in "${stages[@]}"; do
  read -r stage expires <<<"$line"
  state=$(gh pr view "${stage#pr-}" --json state -q .state)
  if [[ $state != OPEN ]]; then
    echo "::error::$stage was left behind by its $state PR; removing it"
    remove "$stage" || true
    failed=1
  elif [[ $expires < $now ]]; then
    echo "$stage expired at $expires; removing it"
    remove "$stage" || failed=1
  fi
done
exit "$failed"
