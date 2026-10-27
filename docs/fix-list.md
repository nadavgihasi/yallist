# Fix list

What's left from the overnight review (security, backend, frontend, infra, code quality), sorted by decision. Clear-cut fixes already shipped (#53–#62, #64).

## Done

- [x] **Production DB backups:** AWS Backup on the production DSQL cluster, daily, 7 days (#80) — `infra/app/core.ts`
- [x] **Debts with removed members:** allow payments to/from former members so their balance can be settled (#83) — `routes/money.ts`, `routes/trips.ts`
- [x] **Safe migrations:** treat "already exists" as applied so a crash between DDL and its `__migrations` row can't wedge deploys; await `CREATE INDEX ASYNC` jobs and fail on error (#79, #108) — `apps/api/src/db/migrate.ts`
- [x] **Deploy waits for CI:** deploy.yml calls ci.yml first (#81) — `.github/workflows/deploy.yml`, `ci.yml`
- [x] **Android https invite links:** share `https://<site>/j/<token>`, not `yallist://` (#82) — `features/trip/PeopleTab.tsx`, `android.yml`
- [x] **Small app bugs:** login redirect drops the query string — `app/(app)/_layout.tsx`; profile double PATCH (submit + blur) — `profile.tsx`; join page effect has no deps — `app/j/[token].tsx` (#84)
- [x] **`trustedOrigins` localhost in production:** non-production stages only (#85) — `apps/api/src/auth.ts`
- [x] **Deploy polish:** per-step names, and tag the release after production deploys (#87) — `.github/workflows/deploy.yml`, `scripts/release.sh`
- [x] **arm64 Lambdas:** ~20% cheaper (#86) — `infra/app/core.ts`
- [x] **Alarms and observability:** production CloudWatch alarms to Telegram (#99), Sentry (#101; account setup in #106) — `infra/app/monitoring.ts`

## Later

- **API rate limiting:** API Gateway throttling, then Better Auth rateLimit with DB storage; a prerequisite for [email sign-up](plans/email-signup.md) — `apps/api/src/auth.ts`, `infra/app/stacks/app.ts`
- **Receipt orphan cleanup:** S3 lifecycle rule expiring unattached uploads — `infra/app/core.ts`
- **Removal sticks:** removed users can rejoin via the same link; mergeUser reactivates them — `routes/trips.ts`, `dal/profiles.ts`
- **Offline mutations across restart:** queued changes are in memory only (#61) and lost when the app closes; `setMutationDefaults` + refetch on resume, with Phase 7 — `apps/mobile/src/state/`
- **Overlapping optimistic writes:** roll back by refetching — `state/trips.ts`
- **Token and personal data at rest:** secure-store on native, CSP on web, don't persist `['me']` — `apps/mobile/src/`
- **`LIMITS` const:** shared input limits in `@yallist/domain` for zod and inputs — `packages/domain`
- **Route param dedupe:** move the repeated param schemas to `access.ts` — `apps/api/src/routes/`
- **Large file splits:** `trips.test.ts`, `profile.tsx`, `items/[itemId].tsx`, `trips/new.tsx`
- **`release.sh` tests:** port to a small TS script with vitest — `scripts/release.sh`
- **Migrations run after new code:** document expand/contract migrations — `docs/deploy.md`
- **Missing profile:** create it lazily on getSession — `apps/api/src/auth.ts`
- **Web code splitting:** one 1.5 MB chunk — `apps/mobile`

## Dropped or accepted

- **Actions pinned by SHA:** dropped; #88 closed on purpose — `.github/workflows/*`
- **Feedback public-issue abuse:** done in #50 — `routes/feedback.ts`
- **Receipts on real AWS:** verified
- **Unused exports and dead code:** done in #62 and #73
- **Trust model:** any member edits anything, by design
- **Guest→Google merge changes others' split:** accepted — `dal/profiles.ts`
- **Guest merge over 3,000 rows:** unrealistic — `dal/profiles.ts`
- **DateField on iOS:** until there's an iOS build — `components/DateField.tsx`
- **Item `Tone` type:** cosmetic — `features/trip/labels.ts`
- **Self-payment after merge:** fold into later work if seen — `dal/profiles.ts`
- **Local Postgres port:** fixed here, local docs now use 55432 like the `yallist-pg` container — `README.md`, `docs/deploy.md`
