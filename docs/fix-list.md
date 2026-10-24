# Fix list

Findings from the overnight review (security, backend, frontend, infra, code quality) that need a decision. Clear-cut fixes were already opened as PRs (#53–#62, #64); this list is what's left.

How to use it: tick an item to accept the recommendation, or write your decision next to it (e.g. "won't fix", "do b instead"). Accepted items become small PRs, one per item or per tight group.

## High

- [ ] **[high] No rate limiting on deployed stages** — Better Auth's rateLimit only turns on when `NODE_ENV==='production'` (never set), so guest sign-in, joins and item/expense creation are unbounded; its store is per-Lambda memory and the IP comes from `x-forwarded-for` — (a) API Gateway default stage throttling now, (b) later Better Auth rateLimit with database storage and the right IP header — `apps/api/src/auth.ts`, `infra/app/sst.config.ts` (source: reviewer 1)
- [ ] **[high] Feedback goes verbatim into public GitHub issues** — the 5/hr per-user limit is bypassable with unlimited guests (and count-then-insert isn't locked); title/body allow @mentions, phishing links, tracking images and prompt injection of agents reading issues — require a Google account or a global cap; defang text (break `@`, quote/code block); label untrusted — `routes/feedback.ts`, `src/github.ts` (source: reviewer 1 / PR #50)
- [ ] **[high] Production DB has no backups** — 0 AWS Backup plans — `backup: $app.stage === 'production'` on `sst.aws.Dsql` (daily, 7-day retention, small cost) — `infra/app/sst.config.ts` (source: reviewer 4)
- [ ] **[high] Android shares invite links as `yallist://…`** — friends without the app can't open them and WhatsApp won't linkify — add `EXPO_PUBLIC_WEB_URL` (per-stage env var or SST output) and share `https://<site>/j/<token>`; ties to domain decision D1 — `features/trip/PeopleTab.tsx`, `android.yml` (source: reviewer 3)

## Medium

- [ ] **[med] Migration runner can get stuck** — each DDL commits before its `__migrations` row (DSQL can't mix DDL+DML); a crash in between makes the next deploy re-run e.g. CREATE TABLE and fail forever — treat "already exists" (42P07/42701/42710) as applied, or check the catalog per statement — `apps/api/src/db/migrate.ts` (source: reviewer 2)
- [ ] **[med] `CREATE INDEX ASYNC` jobs never awaited** — a failed unique index build is recorded as applied with no uniqueness and no error — capture the job id, `CALL sys.wait_for_job(...)`, fail the deploy on failure — `apps/api/src/db/migrate.ts` (source: reviewer 2)
- [ ] **[med] Debts with removed members can't be settled** — they keep a balance and show in suggested transfers, but `POST /payments` requires an active recipient — allow payments to/from former members, or block removal while balance ≠ 0 — `routes/money.ts`, `routes/trips.ts` (source: reviewer 2)
- [ ] **[med] Removal doesn't stick** — a removed user can rejoin as a new guest via the same invite link, and mergeUser's "active beats removed" reactivates them — auto-rotate the invite on remove/decline (or prompt the organizer); keep "removed" in mergeUser if either side was removed — `routes/trips.ts`, `dal/profiles.ts` (source: reviewer 1)
- [ ] **[med] Actions pinned by tag in deploy.yml** — that workflow holds the AdministratorAccess role — pin by SHA + Dependabot for actions (deploy role trusting `environment:*` is safe only while all environments are main-only) — `.github/workflows/deploy.yml` (source: reviewer 1)
- [ ] **[med] Deploys don't wait for CI on main** — deploy.yml runs in parallel with CI and strict checks are off, so two green PRs can merge into a broken main that still deploys to production — make ci.yml reusable (`workflow_call`) and run it first in deploy.yml, or enable strict checks — `.github/workflows/*` (source: reviewer 4)
- [ ] **[med] Migrations run after new code is live** — ~1 min per stage of new code on the old schema; a failed migration leaves it there — document expand/contract migrations in `docs/deploy.md`, or migrate before deploy — `docs/deploy.md` (source: reviewer 4)
- [ ] **[med] No alarms or observability** — no CloudWatch alarms, X-Ray off, only the $10 budget — SNS topic → `BUDGET_EMAIL` + 5xx/error alarms on production; ties to the Sentry/New Relic decision — `infra/app/sst.config.ts` (source: reviewer 4)
- [ ] **[med] Offline changes don't survive a restart** — after #61 they're dropped instead of stuck — `setMutationDefaults(['trip'], { mutationFn })` + refetch on resume, when offline mode (Phase 7) is built — `state/` (source: reviewer 3 / PR #61)
- [ ] **[med] Overlapping trip writes** — a failed first write's rollback can wipe the second's optimistic state; background refetch can overwrite it too — accept, or roll back by refetching — `state/trips.ts` (source: reviewer 3)
- [ ] **[med] Token and personal data unencrypted** — bearer token in AsyncStorage/localStorage (XSS-readable on web); persisted cache holds own email/phone and members' names — expo-secure-store on native, strict CSP on web, don't persist `['me']` — `apps/mobile/src/` (source: reviewer 3)

## Low

- [ ] **[low] Guest→Google merge changes others' split** — when guest and account share an expense the guest share is deleted, so others owe more — decide if intended, or keep the original split count — `dal/profiles.ts` (source: reviewer 2)
- [ ] **[low] Merge can create a self-payment** — from == to after merge — delete such payments during merge — `dal/profiles.ts` (source: reviewer 2)
- [ ] **[low] Missing profile breaks a user permanently** — profile insert runs in an after-create hook outside the user's tx; on failure /me 404s and trip create 500s — create the profile lazily / upsert on getSession — `apps/api/src/auth.ts` (source: reviewer 2)
- [ ] **[low] Large guest merge can exceed DSQL's 3,000-row tx limit** — merge updates all guest activity rows — batch the activity update — `dal/profiles.ts` (source: reviewer 2)
- [ ] **[low] No CSP on web** — token in localStorage means XSS = account takeover (no raw HTML rendering today) — add after testing with Google Identity Services + AppSync wss — `infra/app/sst.config.ts` (source: reviewer 1 / PR #54)
- [ ] **[low] `trustedOrigins` includes localhost:8081 in production** — gate by stage — `apps/api/src/auth.ts` (source: reviewer 1)
- [ ] **[low] Trust model** — any member can record an expense "paid by" another, and rename/delete items and categories — confirm this is intended (source: reviewer 1)
- [ ] **[low] Receipts: one per expense** — a second is refused until the first is deleted — confirm, or allow multiple photos (source: PR #52)
- [ ] **[low] Receipts: delete permission** — follows the expense-delete rule (who added/paid it, or an organizer) — confirm (source: PR #52)
- [ ] **[low] Receipts: orphaned uploads stay in the bucket** — presigned but never attached — S3 lifecycle rule expiring `uploads/` (or untagged) objects after 1 day — `infra/app/sst.config.ts` (source: PR #52)
- [ ] **[low] Receipts: no pinch-zoom on Android** — gesture library skipped, untested on device — add if needed (source: PR #52)
- [ ] **[low] Receipts: not verified on real AWS** — presigned POST/GET and bucket CORS — check on dev after merge (source: PR #52)
- [ ] **[low] Lambdas on SST defaults** — x86_64, 1024 MB, 20 s; arm64 is ~20% cheaper — later (source: reviewer 4)
- [ ] **[low] Release tagged before deploy** — a version can be "released" without reaching production — leave (documented) or move later (source: reviewer 4)
- [ ] **[low] Deploy step names blank in the UI** — YAML anchor — add per-step `name:` — `.github/workflows/deploy.yml` (source: reviewer 4)
- [ ] **[low] Input length limits duplicated/missing** — over-limit text gets a 400 + generic toast — a `LIMITS` const in `@yallist/domain` used by zod and inputs, after #50/#52 (source: reviewer 5)
- [ ] **[low] Route param schemas repeated in 4 route files** — move to `access.ts` after #52 (source: reviewer 5)
- [ ] **[low] Item `Tone` type is a v1 leftover** — collapse unless design brings tones back — `features/trip/labels.ts`, `ItemRow.tsx`, `items/[itemId].tsx` (source: reviewer 5)
- [ ] **[low] Large files to split** — `trips.test.ts` (601), `profile.tsx` (362, after #50), `items/[itemId].tsx` (300), `trips/new.tsx` (297) (source: reviewer 5)
- [ ] **[low] `scripts/release.sh` has no tests** — port to a small TS script with vitest (source: reviewer 5)
- [ ] **[low] Login redirect drops the query string** — `?tab=money` lost — `app/(app)/_layout.tsx` (source: reviewer 3)
- [ ] **[low] Profile name/phone save on submit and blur** — possible duplicate PATCH — drop `onSubmitEditing` — `profile.tsx` (source: reviewer 3)
- [ ] **[low] Join page effect has no dependency list** — calls `open()` every render once approved — `app/j/[token].tsx` (source: reviewer 3)
- [ ] **[low] DateField calls `DateTimePickerAndroid` on iOS** — crash if iOS is built — `components/DateField.tsx` (source: reviewer 3)
- [ ] **[low] Dead code** — `he.join.missing` and remaining unused exports (some removed by #62) (source: reviewer 3)

## Info

- [ ] **[info] `pnpm audit --prod`** — node-forge, zod <4.6.6, esbuild on dev-tool paths only, not shipped — no action (source: reviewer 1)
- [ ] **[info] Local Postgres port mismatch** — container uses 55432, README/deploy.md/CI/dev.ts say 5432 — pick one (source: reviewer 5)
- [ ] **[info] Web JS is one 1.5 MB chunk** — ~410 KB gzip, no code splitting — later (source: reviewer 3)
