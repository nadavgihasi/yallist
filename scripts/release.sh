#!/usr/bin/env bash
# CI (deploy.yml): pick the next version from Conventional Commit subjects since the last v* tag,
# tag HEAD and create a GitHub release. Without a feat/fix/perf since that tag, reuse its version.
# Writes version=X.Y.Z to $GITHUB_OUTPUT. Needs full history (fetch-depth: 0) and GH_TOKEN.
set -euo pipefail

last=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)

if [[ -z "$last" ]]; then
  next=0.1.0
else
  IFS=. read -r major minor patch <<<"${last#v}"
  subjects=$(git log --format=%s "$last..HEAD")
  bodies=$(git log --format=%b "$last..HEAD")
  type='^[a-z]+(\([^)]*\))?'
  if grep -qE "$type!:" <<<"$subjects" || grep -qE '^BREAKING[ -]CHANGE:' <<<"$bodies"; then
    # Before 1.0, breaking changes bump the minor version.
    if ((major == 0)); then next=0.$((minor + 1)).0; else next=$((major + 1)).0.0; fi
  elif grep -qE '^feat(\([^)]*\))?:' <<<"$subjects"; then
    next=$major.$((minor + 1)).0
  elif grep -qE '^(fix|perf)(\([^)]*\))?:' <<<"$subjects"; then
    next=$major.$minor.$((patch + 1))
  else
    next=${last#v}
  fi
fi

if [[ "v$next" != "$last" ]]; then
  gh release create "v$next" --target "$(git rev-parse HEAD)" --title "v$next" --generate-notes
fi
echo "version=$next" >>"${GITHUB_OUTPUT:-/dev/stdout}"
