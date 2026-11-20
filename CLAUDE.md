# Working on yallist

Start with [README.md](README.md) and [docs/](docs/README.md). This file holds the rules that are easy to get wrong.

## Branches and pull requests

- A local `main` is often stale. Fetch, and branch from `origin/main` in a worktree of your own under `.claude/worktrees/`. Don't touch the main checkout or another agent's worktree.
- One task, one pull request. Keep the diff to the task.
- Open pull requests as ready for review, never as drafts.
- Don't merge, and don't turn on auto-merge. `main` deploys to dev and then production on every push.
- PR titles follow Conventional Commits: they decide the next version ([docs/releases.md](docs/releases.md)). `feat:` is a minor, `fix:` and `perf:` a patch, the rest no release.
- Pushing a change under `.github/workflows/` needs the `workflow` scope on the GitHub token. If the push is refused, stop and say so. Don't push with another identity.
- Agents working in parallel may share one scratch directory. Keep temporary files, such as a PR body, in a folder of your own there: a common name like `pr-body.md` gets overwritten.
- Before you start, look at the open pull requests and say in yours which ones touch the same files.

## Checks

- Node 24 and pnpm 10.33.0. If `pnpm` isn't on the PATH, use `npx -y pnpm@10.33.0`.
- Run all four before opening a pull request: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`. `pnpm lint` needs `uv`.
- The API tests need Postgres and **skip silently** without it. Set `DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres` and check the output says they ran, not that they were skipped. If another agent's Postgres already listens on 55432, use it; don't start a second one.
- Say in the pull request which checks you ran and which you couldn't. The Maestro and preview-only Playwright flows usually run only in CI.
- A test that guards a fix must fail without the fix. Check that it does, and say so.

## Database: Aurora DSQL

Production is Aurora DSQL; tests and local dev are plain Postgres. Only a PR's preview runs on real DSQL, so its checks matter. The schema's header comment (`apps/api/src/db/schema.ts`) has the full list of limits. The ones that bite:

- **No cascades.** A new table under a trip must be deleted in `deleteTrip` (`apps/api/src/dal/trips.ts`). A new column that references a profile must be added to `USER_COLUMNS`, and a new (key, user) table to `USER_KEYED` (`apps/api/src/dal/profiles.ts`), or deleting and merging users breaks.
- **Never put a user id inside JSON.** `mergeUser` moves user columns, not ids inside a `jsonb` payload. Use a column with a foreign key.
- **A new column is nullable with no default.** DSQL can't add a default or `NOT NULL` to a table that exists; the API treats null as the default.
- **No partial or expression indexes.** Uniqueness that needs one is checked in code under a lock (see `trip_categories`, `shopping_runs.active`).
- **Writes conflict instead of waiting.** Run every write through `transact` (`apps/api/src/db/tx.ts`), which retries. Don't add a row that every write to a trip updates, such as a counter on `trips`: all concurrent writes would then conflict.
- **At most 3,000 rows per transaction.** Batch larger deletes and backfills.

## Migrations and deploys

- Change `schema.ts`, then run `pnpm --filter @yallist/api db:generate` and commit the SQL and `drizzle/meta`. Never edit a migration that has been deployed.
- Old and new code both run against the database during a deploy, in either order. So add first: a new column or table ships with, or before, the code that uses it.
- Dropping or renaming a column or table, or tightening a constraint, ships in a later pull request than the code that stops using it. Say so in the first one.
- Two open pull requests that each add a migration take the same number. Say in yours that it may need regenerating after the other merges.
- PR previews share one HTTP API and CloudFront router, deployed **only from `main`** (`.github/workflows/preview-stage.yml`). A change to `API_CORS` in `infra/app/core.ts` (say, a new request header) or to `infra/app/stacks/preview-shared.ts` doesn't reach your own preview. Merge that part first, in a pull request of its own.

## API

- Every router calls `requireUser` itself; that is what types `c.var.user`.
- Every successful write under `/trips/:tripId/*` publishes a realtime event (`apps/api/src/app.ts`). Events carry no personal data; clients refetch through the API.
- Every write logs to `activity` in its own transaction (`logActivity`). Keep doing it: notifications are built from it ([docs/specs/notifications](docs/specs/notifications/README.md)).
- The routes' types are the app's types (`hc<AppType>`). Changing a response changes what the app caches on the device, and older Android builds still call the API.

## App

- Everything about one trip is one query (`tripKey`). The home list (`tripsKey`, `GET /trips`) is a heavy request: mark it stale; don't refetch it on every change.
- A change to a trip goes through `useTripAction` (`apps/mobile/src/state/trips.ts`): shown at once, sent in order, rolled back if refused.
- Text is Hebrew and right to left. Strings live in `apps/mobile/src/i18n/he.ts`.

## Docs and comments

- Comments say why, in a sentence or two. Match the ones around your change.
- When code makes a doc or a comment false, fix it in the same pull request. `docs/tech-decisions.md`, `docs/deploy.md` and `docs/SPEC.md` are read as current.
- [docs/fix-list.md](docs/fix-list.md) lists known problems and what was decided about them. Read it before proposing a fix; move an item to Done when you ship it.
