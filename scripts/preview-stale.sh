#!/usr/bin/env bash
# CI (preview-cleanup.yml): lists stale PR preview stages (docs/plans/e2e-live-environments.md),
# one `pr-<n> <reason>` per line. Needs credentials for the preview role in us-west-2, and GH_TOKEN.
#
#   scripts/preview-stale.sh          # every deployed pr-* stage that's stale
#   scripts/preview-stale.sh pr-123   # that stage, if it's still deployed and stale
#
# A stage is deployed while any resource in us-west-2 is tagged with it, and stale when its PR is
# closed, merged or gone, or its API Lambda's expires-at tag (6 h after its last deploy,
# infra/app/stacks/preview-pr.ts) has passed. A stage with no expires-at (a deploy that failed
# before the Lambda) expires only with its PR.
set -euo pipefail

filters=("Key=app,Values=yallist")
[[ -n ${1:-} ]] && filters+=("Key=stage,Values=$1")

now=$(date -u +%Y-%m-%dT%H:%M:%S.000Z) # the format of Date.toISOString()
mapfile -t stages < <(aws resourcegroupstaggingapi get-resources --tag-filters "${filters[@]}" \
  --query 'ResourceTagMappingList[].Tags' --output json |
  jq -r '[.[] | from_entries | select(.stage // "" | test("^pr-[0-9]+$"))] | group_by(.stage)[] |
    "\(.[0].stage) \([.[]["expires-at"] // empty] | max // "none")"')

for line in "${stages[@]}"; do
  read -r stage expires <<<"$line"
  pr=${stage#pr-}
  if ! state=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$pr" \
    --jq 'if .merged then "merged" else .state end' 2>&1); then
    if [[ $state == *'HTTP 404'* ]]; then
      echo "$stage PR #$pr doesn't exist"
    else
      # Not knowing is not stale: the next run tries again.
      echo "::warning::$stage: can't read PR #$pr: $state" >&2
    fi
  elif [[ $state != open ]]; then
    echo "$stage PR #$pr is $state"
  elif [[ $expires != none && $expires < $now ]]; then
    echo "$stage last deployed over 6 h ago (expired at $expires)"
  fi
done
