#!/usr/bin/env bash
# CI (ci.yml): run typecheck, lint, test and format:check at the same time, then print each one's
# output: passing checks in a collapsed log group, failing ones in full. Fails if any check fails.
set -uo pipefail

checks=(typecheck lint test format:check)
logs=$(mktemp -d)
declare -A pids

for check in "${checks[@]}"; do
  pnpm "$check" >"$logs/$check.log" 2>&1 &
  pids[$check]=$!
done

failed=()
for check in "${checks[@]}"; do
  if wait "${pids[$check]}"; then
    echo "::group::$check passed"
    cat "$logs/$check.log"
    echo "::endgroup::"
  else
    failed+=("$check")
  fi
done

for check in "${failed[@]}"; do
  echo "::error title=$check failed::pnpm $check failed; its output follows."
  cat "$logs/$check.log"
done
((${#failed[@]} == 0))
