# Build checklist: branches, PRs, checks, screenshots, CI

`CLAUDE.md` wins wherever this differs.

## Branches

- **Branch from `origin/main`**, in a worktree of your own under `.claude/worktrees/`. Use the branch name the session was given, with a suffix per task (`…-payments`, `…-m3`).
- **Stacking:**
  - Only stack when a task changes the same screens as one still open. Branch from that task's branch and open the PR with `base` set to it.
  - If the new task needs an open PR that isn't its base, merge that PR's branch in and say so in the body.
  - When the base PR merges, merge `main` in and retarget the stacked PR to `main`.
- **Migrations:** two open PRs that each add one get the same number. Where branches combine, regenerate with `pnpm --filter @yallist/api db:generate --name <name>`, which takes the next number, and say in the PR that it may need regenerating after the other merges.

## Before every push

- **Run all four:** `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`. **Look at the exit codes.** `pnpm -s typecheck` printing nothing is not a pass: a domain test fixture once failed in CI after a "quiet" local run.
- **Postgres:** API tests skip without it. Start it if needed (`service postgresql start`, then wait for `pg_isready`). Make sure the output shows the API tests ran rather than being skipped. In a container that restarts, Postgres can stop between turns.
- **Lint memory:** `pnpm lint` can run out of memory in a small container. Retry with `NODE_OPTIONS=--max-old-space-size=6144`.
- **Formatting:** run `npx prettier --write` on the files you touched.
- **Main moved?** Merge it in and re-run everything. Tests on main guard things a milestone tends to change:
  - `apps/mobile/src/state/cacheBuster.test.ts` fingerprints the shape of the data the app caches. Set `CACHE_SHAPE` to the value it prints.
  - The trip-delete and user-merge coverage tests catch new tables and columns that miss `deleteTrip`, `USER_COLUMNS` or `USER_KEYED`.

## Compatibility

- **Older Android builds still call the API.** When you remove or change a route the app used, keep the old one working (a no-op is fine) and test it. Payments without confirmation kept `POST /payments/:id/confirm`, answering `confirmed`.
- **New columns:** nullable, with no default; the API treats null as the default. A column that references a profile goes in `USER_COLUMNS`.

## Screenshots

1. Commit first. The capture script works from a commit.
2. Build and serve with `scripts/serve-stack.sh`. The web export takes about 8 minutes, so run it in the background.
3. Write a Playwright script with `scripts/shots-common.cjs`: guests through the API, a trip, members, expenses, then open the screens. Phone size 390×844 at deviceScaleFactor 2.
4. **Look at every image.** Fix what's cut off, wrapped or wrong, retake, and only then push.
5. Push the images to the orphan `screenshots` branch, in a folder per PR (do it in a worktree, not the main checkout). Embed them as `https://raw.githubusercontent.com/<owner>/<repo>/screenshots/<folder>/<file>`, showing before/after when there is a before.

## The PR

- Open it ready for review, with a Conventional Commits title (`feat(money): …`), stacked if it is.
- The body covers:
  - what changes (API / app / domain)
  - the screenshots
  - migrations
  - open PRs touching the same files
  - checks: which ran, what could only run in CI
  - what's not done

  It ends with the session's attribution lines.

- Subscribe to the PR's activity. On each CI event, read the failing job's log (download it; the summary isn't enough), reproduce it locally, fix the cause, and show the same check passing before you push.
- A summary job like `all-pass` failing on an older commit needs nothing once the newer commit is fixed.
- A failure that's red on main as well gets one comment saying so, plus the smallest fix in the PR.

## Pitfalls hit last time

- **Logs in the wrong place:** a script called by a relative path wrote its logs to the repo root. Call it by its absolute path.
- **Killing your own shell:** `pkill -f name` kills the shell whose command line contains `name`. Use `pkill -f "nam[e]"`.
- **Double taps:** a double tap can record a payment twice before React re-renders. Guard buttons that create things with a ref lock that is released when the mutation settles.
- **RTL text:**
  - Keep units like `×2` together with `ltr()`.
  - Use a non-breaking space between a label and its amount.
  - Prefer gender-neutral Hebrew ("להעביר", "לקבל") over slash forms ("חייב/ת").
  - Say "אני" for the current user consistently.
- **Amounts:** use `formatShekel` everywhere (₪2,040 and ₪904.60). Big numbers need a smaller font so they stay on one line: `adjustsFontSizeToFit` does nothing on web.
- **Two controls doing the same thing** (a floating button and an in-list button): keep one.
