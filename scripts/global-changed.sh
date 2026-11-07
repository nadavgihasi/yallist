#!/usr/bin/env bash
# CI (deploy.yml): whether the global stack (infra/global) needs deploying. A push deploys it only
# if something it's built from changed since main's last successful deploy; a manual run always
# does, and so does any push when that deploy can't be found. Writes changed=true|false to
# $GITHUB_OUTPUT. Needs full history (fetch-depth: 0) and GH_TOKEN with actions: read.
set -euo pipefail

paths=(infra/global infra/package.json package.json pnpm-lock.yaml .nvmrc .github/workflows/deploy.yml)
changed=true

if [[ "${GITHUB_EVENT_NAME:-}" == push ]]; then
  last=$(gh run list --workflow deploy.yml --branch main --status success --limit 1 \
    --json headSha --jq '.[0].headSha // empty' || true)
  if [[ -n "$last" ]] && git cat-file -e "$last^{commit}" 2>/dev/null &&
    git diff --quiet "$last" HEAD -- "${paths[@]}"; then
    echo "No global changes since the last successful deploy ($last)."
    changed=false
  fi
fi

echo "changed=$changed" >>"${GITHUB_OUTPUT:-/dev/stdout}"
