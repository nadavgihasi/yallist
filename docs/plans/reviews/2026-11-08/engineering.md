# Engineering review: milestones M1–M6 (2026-11-08)

## 0. Open PRs

- **#129 has already merged** (e452d9d, deployed OK, including `0013 DROP COLUMN place_text` on DSQL). The roadmap is a day out of date.
- **#131 (my bag)** has 3 conflicts when merged onto main: `drizzle/meta/0009_snapshot.json`, `_journal.json` and `trips/[tripId]/index.tsx`. Its `0009_private_items` clashes with main's 0009–0013. To fix: drop its migration and snapshot, run `drizzle-kit generate` again to get `0014`, and resolve the ניהול/segment layout against #129. About 2 h plus CI. **The design is mostly sound.** `lockItem(…, owner)` denies by default, so shared routes return 404 for private items. `privateWrite` skips realtime, and `mergeUser` covers the new column. **Gaps:** (a) `visibleTo()` is opt-in per query. Every future reader of `items` (activity feed, OG preview, duplicate trip, push "what's missing", arrivals) has to remember it. Add a `sharedItems()` helper and a test that fails when a new raw `from(items)` appears. (b) `deleteUser` keeps a removed member's private items, which hold personal data no one else can see. Delete them before the reference scan.
- **#132 (essentials)** is stacked on #131 and has 5 conflicts, `routes/me.ts` among them. Rebase it after #131 as one squashed commit; both branches carry merge commits, so don't replay them. Migration becomes `0015`. **Bug:** `user_essentials` was added to `USER_COLUMNS`. A user whose only data is essentials can then never be hard-deleted, and their essentials survive "account deletion", which breaks D4 and the privacy page. `deleteUser` must delete essentials. Minor: a guest→Google merge can duplicate essential-copied private items in a shared trip. Rebase cost about half a day for both, plus a careful human review because privacy is involved.

## 1. Milestones: PRs, sizes, hidden work

**M1 — Clear the deck (≈1 week).** #131 rebase+fix (S), #132 rebase+fix (S), settle up (M; reuse #152's `paymentPhone` API part), Sentry alerts #106 (**XS, not M**: `/webhooks/sentry` and its formatter already exist, so what's left is Sentry console config and the secret), deflake realtime (S, timebox to 1 day; root cause unknown).

**M2 — Closed testing (≈1.5 weeks code + Play calendar).**

1. Upload key (XS, script exists), then **first AAB uploaded by hand**. Play App Signing's SHA-1 only exists after that upload, and the Android OAuth client needs it.
2. Google sign-in on Android (**M–L, not M**). No native Google module is installed today (`GoogleButton.tsx` is a disabled stub). The free `@react-native-google-signin` uses the legacy SDK; Credential Manager is in their paid build. The cleanest route is a small local Expo module (Kotlin, `androidx.credentials` + `googleid`, `serverClientId` = web client ID so Better Auth's audience check is unchanged). EAS isn't needed; prebuild in CI picks it up. It can only be tested on upload-key-signed builds, so Maestro can't cover it.
3. CI Play upload (S + setup): service account and Play API access, Gradle Play Publisher or `fastlane supply`.
4. Terms page (S, blocked on D5 text), login per mockup (S).
5. Play listing (human, 1–2 days). The data safety form must declare **Sentry session/error replays** (#160).
6. Hidden, should be in M2: native token **in AsyncStorage, not SecureStore** (email-signup.md wrongly says SecureStore); **API Gateway throttling** (anonymous sign-up is unlimited).

**M3 — WhatsApp groups (≈2 weeks; scope too big).** Domain (S code, days of DNS; the CloudFront certificate must be in us-east-1 while production is eu-central-1; keep the old CloudFront and API URLs alive for installed APKs; update OAuth origins). OG previews (M): move dev/prod from `StaticSite` to `sst.aws.Router` (previews already use it), route `/j/*` to a Lambda that injects OG tags into the deployed `index.html`. Hidden: the hashed bundle names, a small og:image (<300 KB, absolute https), and WhatsApp's aggressive cache. Invite sheet (M), open-in-app (S), App Links (M: `assetlinks.json` per host with upload and Play fingerprints). Join/pending pages (M; a **per-user realtime channel is new authorizer work**, so keep polling as the fallback). **Move "participants and settings" (L) out of M3**: only the approval switch is needed. **Add "removal sticks"** (fix-list): it matters once links spread.

**M4 — Stays on track (≈2–2.5 weeks).** Activity API (M) + screen (M); push tokens and sender (M); registration (S); scheduler (M); edit expense (S→M because of `expense_items` and runs) + remind payment (S). Hidden: Expo push needs an Expo `projectId`, FCM v1 service-account credentials uploaded to expo.dev (free, no build service), and `google-services.json` from a CI secret. Push should go out asynchronously (async invoke or SQS), not inline after commit. Prune `DeviceNotRegistered` tokens using the receipts. **Gap: no web push**, so iPhone-on-web users (all iOS users until D8) never "hear about" anything. M4's done-when is false for them unless web push (PWA) or an email digest is scoped.

**M5 — Offline and after (≈3 weeks; roadmap says M+M, really L+M+M+M).** The reducer design helps: one `Action` union through `send()`, scoped per trip, so `setMutationDefaults(tripKey)` plus `resumePausedMutations` is straightforward. The hidden work is elsewhere:

- `addItem` isn't optimistic and its IDs come from the server. Offline create-then-claim needs **client-generated UUIDs** on create endpoints and **idempotency** (duplicate creates after timeouts or DSQL retries).
- The cache `buster` wipes everything on each build, so queued mutations need their own versioning.
- Receipt uploads can't simply be queued.

Duplicate trip stays under DSQL's 3,000-row limit easily.

**M6 — Public (calendar-bound).** License (XS), rate limiting (S with Better Auth DB storage), web code splitting (M, risky with `asyncRoutes:false`; it matters more for the join page in M3 than here). **OTA via Hot Updater is L, not M** (native plugin, runtime-version fingerprinting, Sentry source maps per OTA bundle, signing). Make it optional for production.

## 2. Risks and spikes (run first)

| Risk                                                                                                        | Spike (≤1 day)                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Credential Manager on a release-signed build; ID-token `aud`/nonce accepted by Better Auth `sign-in/social` | Minimal Expo module → token → dev API                                                                                            |
| SHA-1 chicken-and-egg with Play signing                                                                     | Manual first internal upload in week 1                                                                                           |
| OG at CloudFront: Router migration may recreate distributions (URL change!)                                 | `sst diff` on dev, verify the distribution is kept or plan the domain cut-over together                                          |
| FCM v1 + Expo push without EAS                                                                              | Push to one device from a CI-built APK                                                                                           |
| EventBridge: `sst.aws.Cron` is UTC (DST drift for 18:00 Israel)                                             | Use `aws.scheduler.Schedule` with `scheduleExpressionTimezone: Asia/Jerusalem`; one daily scan, a sent-log table for idempotency |
| Persisted mutations across restart and build                                                                | Prototype with client UUID for `addItem`                                                                                         |
| DSQL: OCC conflicts on hot rows (push token upserts, activity cursors), no expression indexes               | Parallel test like the existing suites                                                                                           |
| Play CI upload permissions                                                                                  | Service account dry run to the internal track                                                                                    |

## 3. Tech debt, prioritized

- **P0 (M1/M2):** #131/#132 deletion fixes; SecureStore token; API Gateway throttling; data safety covering Sentry replays.
- **P1 (M3/M4):** `sharedItems()` guard; removal sticks; **migration-number and snapshot collisions** (will recur with parallel pipeline PRs; add a CI check plus a "regenerate on rebase" rule to the implementer prompt); `migrate()` re-runs `seedTemplates` (delete+insert) and three backfills on every deploy, so retire finished ones; document expand/contract (0013 relied on code-before-migrations); lazy missing profile.
- **P2:** `LIMITS` const, param dedupe, splitting `trips.test.ts` (793 lines), the `release.sh` port, the S3 receipt lifecycle rule.

## 4. Pipeline vs human-led

- **Pipeline:** Sentry console checklist doc, terms page (after D5), login per mockup, open-in-app, edit expense + remind, bulk add API/UI (D11 settled), arrivals API, trip lifecycle `ended`, license file, receipt lifecycle rule, removal sticks, lazy profile, `LIMITS`/param dedupe/file splits, API Gateway throttling.
- **Human design first:** #131/#132 rebases (privacy), Google native module, Play signing/upload, domain + Router/OG, App Links, push architecture (Expo vs direct FCM, async sending, web gap), per-user realtime channel, offline mutations (client IDs, idempotency), OTA, Better Auth rate limiting.

## 5. Six-week plan (from Mon 9 Nov)

- **W1:** Rebase #131 then #132 with the fixes. Sentry alert config. Settle up. Deflake timebox. **Decide D1, D5, the 12 testers.** Upload key and a manual first AAB. Spikes: Credential Manager, Router/OG `sst diff`.
- **W2:** Google sign-in on Android, SecureStore, API Gateway throttling, terms and login, CI Play upload, listing and data safety. **Closed track open about 20 Nov, and the 14-day clock starts.**
- **W3:** Domain cut-over plus OG previews (Router), invite sheet, open-in-app, removal sticks. Spike FCM v1 push. Pipeline: bulk add.
- **W4:** App Links + `assetlinks.json` (custom domain), join/pending pages (polling), approval switch. Pipeline: edit expense and remind.
- **W5:** Push tokens and async sender, registration, day-before scheduler (uses #132's text).
- **W6:** Activity API and screen, license, Better Auth rate limiting. **Apply for production about 4–7 Dec.** Write the offline-mutations design (client UUIDs, idempotency).

**Not in 6 weeks:** M5 (start in W7) and OTA (after production). Participants and settings beyond the approval switch goes to the backlog.
