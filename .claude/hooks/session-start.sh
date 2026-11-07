#!/bin/bash
# Installs workspace dependencies at session start so typecheck, lint and tests
# work immediately. The container is cached after the hook finishes, so a later
# session reuses node_modules and this install is skipped unless a manifest or
# the lockfile changed.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# pnpm is pinned via the "packageManager" field; corepack serves the right one.
corepack enable >/dev/null 2>&1 || true

# Run the install only if a listed file changed since it last succeeded. The hash
# file lives inside node_modules, so it disappears if the packages do (and
# node_modules is gitignored, so git never sees it).
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # Drop stale hashes first, so a failed install is retried next session.
  rm -f "$hashes"

  # install (not the frozen `ci` equivalent) so the cached container can reuse it.
  pnpm install --frozen-lockfile

  # Hash this script, the lockfile, the workspace config and every package
  # manifest: any of them changing means dependencies may need reinstalling.
  mkdir -p node_modules
  sha256sum \
    .claude/hooks/session-start.sh \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    package.json \
    apps/api/package.json \
    apps/mobile/package.json \
    infra/package.json \
    packages/domain/package.json \
    2>/dev/null > "$hashes" || rm -f "$hashes"
fi
