# QA review: Yallist (2026-11-08)

**Environment note.** The pr-156 preview could not be tested. Its stage hit the 6 h `expires-at` and the cleanup removed it while the PR was still open. The API returns 404, and the CloudFront router answers **502 "Failed to contact the origin" on every path, `/` included**. No other preview was live either. So I ran the same stack locally (API `src/dev.ts` on Postgres 16, plus `expo export -p web`) and drove it with Playwright at 390×844 in two contexts. This setup has no AppSync and no DSQL. **Suites:** `pnpm test` passes 314/314 (domain 65, mobile 53, API 196 with DATABASE_URL). `pnpm typecheck` is clean.

## 1. Bugs

| #   | Sev         | Bug                                                                                                                                       | Repro → expected / actual                                                                                                                                                                                                                                                                                                               | Likely file                                                                                           |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | **P2**      | Double-tapping "Create trip" makes **two trips**                                                                                          | New trip → blank → name → double-click `#new-trip-create`. Expected: 1 trip. Actual: 2 identical trips on home. `disabled={isPending}` only takes effect on the next render.                                                                                                                                                            | `app/(app)/trips/new.tsx` ~L72/215/231 (needs a ref guard)                                            |
| 2   | **P2**      | Client doesn't enforce the API's limits, so input is lost behind a misleading toast                                                       | (a) A trip name over 80 chars (tried 136 Hebrew+emoji) → 400 → "השינוי לא נשמר, נסו שוב". Retrying can never work. (b) An expense of ₪2,000,000, or a description over 80 chars: the sheet closes, toasts "ההוצאה נשמרה", then the 400 drops the expense (and any receipt). Expected: maxLength / range checks with a specific message. | `trips/new.tsx`, `expenses/new.tsx`, `login`, `j/[token].tsx` (no maxLength); fix-list "LIMITS const" |
| 3   | **P2** (M5) | An item added offline is **invisible until reconnect**                                                                                    | `setOffline(true)` → add item → the list still shows the old count. A claim offline _is_ optimistic. It syncs on reconnect, but users will re-add it and get duplicates. There's no offline indicator, and an offline expense toasts "saved" yet isn't listed.                                                                          | `state/trips.ts` `useTripAction` / add-item sheet path                                                |
| 4   | P3          | Item quantity stepper has no maximum                                                                                                      | Tap + past 999 → API 400 "failed".                                                                                                                                                                                                                                                                                                      | `features/trip/ItemForm.tsx` ~L166                                                                    |
| 5   | P3          | "1,000" isn't accepted as ₪1000                                                                                                           | The save button just stays disabled, with no hint. (`1,000` → `1.000` fails the 2-decimal regex.)                                                                                                                                                                                                                                       | `packages/domain/src/money.ts` `parseShekel`                                                          |
| 6   | P3          | Back after deleting a trip shows the generic 404 "השביל הזה לא מסומן"                                                                     | Delete trip → browser Back. Expected: "הטיול נמחק…", as the realtime path shows.                                                                                                                                                                                                                                                        | `app/(app)/trips/[tripId]` error state                                                                |
| 7   | P3          | A removed member sees the full join page with a Join button, and learns they're blocked only after tapping it. That button has no testID. | Remove Noa → Noa opens the link.                                                                                                                                                                                                                                                                                                        | `app/j/[token].tsx` ~L178; `routes/invites.ts` GET                                                    |
| 8   | P3          | A payment _to_ a removed member stays "marked" forever: the receiver can no longer confirm it                                             | Code path in `routes/money.ts` (confirm needs membership)                                                                                                                                                                                                                                                                               | `routes/money.ts`                                                                                     |
| 9   | P3 (ops)    | An expired preview leaves a dead link in the PR comment, and the router serves a raw 502                                                  | See the note above.                                                                                                                                                                                                                                                                                                                     | `preview.yml`, `stacks/preview-pr.ts`, router default behavior                                        |
| 10  | doc         | Fix-list item "Removal sticks" is stale: rejoining now gets a 403 "Removed from this trip"                                                | —                                                                                                                                                                                                                                                                                                                                       | `docs/fix-list.md`                                                                                    |

**Verified OK:** racing claims on the last unit (one 200, one 409). Five rapid claim/release toggles end consistent. Double-tapping item save or expense save makes no duplicates. The server rejects 0, negative, fractional and >₪1M amounts and qty 1000. Non-members get 404, including a cross-trip itemId. Shares or payments to outsiders get 400. `<script>`/`<img onerror>` names don't execute. The last organizer can't leave (409). A removed member keeps their balance. Offline mutations sync on reconnect.

## 2. Coverage gaps

- **API (strong: 196 tests)** runs only on Postgres. DSQL OCC (40001/OC000 → `withRetry`) is tested only as `isRetryable`, never against DSQL. No concurrent double-purchase test (`itemId` lock). No test that each write route publishes. No rate-limit tests (there's no rate limiting).
- **UI, Maestro (17 flows):** none cover settle-up (mark paid / confirm / delete payment), approve/decline, remove member, leave, categories, editing trip dates/place, the join page as a new guest, Google sign-in, offline, input limits, or double-tap. There are no component tests (no RNTL). Nothing runs natively on Android (only proposed). There's no WebKit run, and web runs at 500 px, not 390.
- **Realtime (3 Playwright tests: claim, pack, delete):** nothing for expenses/payments, approval reaching the pending page (needs a per-user channel), a removed member being sent home, reconnect after offline or sleep, or session expiry on an open socket.
- **#112 flake, root-cause hypotheses (most likely first):**
  1. **The tests don't wait for the app's own subscription.** `claim` waits for its _injected_ socket's `subscribe_success`. `packing` and `delete` wait for nothing. Noa can act before Dana's `useTripUpdates` subscribes. The `onSubscribed` refetch covers that only if it runs _after_ Noa's commit. If AppSync acks the subscribe before fan-out is live, the event is dropped. The refetch already read old data, so nothing refetches before the 10 s timeout.
  2. **Authorizer cold starts and load.** TTL 0 means a Lambda call per subscribe (getSession plus a DSQL query), while 4 Playwright workers and 4 Maestro shards hit the same preview. One `subscribe_error` costs 0.5–1 s of backoff, then 1–2 s, then 2–4 s, which can blow the 10 s budget.
  3. **Publishing is best-effort** (3 s timeout, only logged), so a slow publish is lost for good.

  **Fix:** expose readiness (for example `data-realtime="subscribed"` in E2E builds) and await it before Noa acts. Add a refetch on visibility/interval as a product safety net. Count publish failures as a CloudWatch metric. Track flakes with `retries: 1` plus a flake report, rather than hiding them.

## 3. Release gates

**M2 (closed testing):**

- [ ] Release AAB signed with the upload key, installed from the Play internal track (not sideloaded) on: Android 10, 12, 13, 14, 15 and 16; one low-end device (≤3 GB RAM); one Samsung (One UI); one Pixel; a 360 dp and a large screen.
- [ ] Google sign-in works on a Play-signed build (SHA-1 of the _app signing_ key in OAuth), with guest→Google merge.
- [ ] RTL: system language set to Hebrew and to English. Mixed bidi names, emoji, 80-char names. Font scale 200 %. Dark mode.
- [ ] Accessibility: TalkBack across the core flows (sign in, join, claim, add expense). 48 dp touch targets. Contrast AA.
- [ ] Data safety form matches reality: name, photos (receipts/avatar on S3), Sentry crash data, account deletion in-app and on the web URL. Privacy and terms pages reachable without login.
- [ ] Sentry release and dist set, with source maps. Crash-free sessions ≥ 99 % on internal testers over 3 days. Zero P0/P1 open.
- [ ] Maestro flows pass on an emulator (API 34) from CI, at least nightly.

**M6 (production):**

- [ ] Crash-free users ≥ 99.5 %, sessions ≥ 99.8 % over the 14-day closed test. ANR rate < 0.47 %, crash rate < 1.09 % (Play's bad-behavior thresholds).
- [ ] Upgrade testing: install M2's build, create data, upgrade to the release candidate. The persisted query cache buster, the session and queued mutations survive. An OTA update applies and can be rolled back.
- [ ] Migrations: expand/contract proven on a copy of production DSQL. The old app works against the new API for one release.
- [ ] Load: 50 concurrent members on one trip (k6 against a preview) with no 5xx; OCC retries within budget.
- [ ] Rate limiting live and tested. Token at rest (secure-store) and CSP verified.
- [ ] Device matrix as M2, plus Android 8/9 if minSdk allows. Pre-launch report clean.
- [ ] Every P2 above fixed. Staged rollout at 10 % → 50 % → 100 %, watching Sentry and alarms.

## 4. Test plan per milestone

- **M1:**
  - Settle up: API tests for each transfer path and for rounding (10001 agorot / 3). Maestro: mark paid → confirm, with a two-member Playwright run.
  - Sentry → Telegram: trigger the test-only `crash` route on a preview and assert the Telegram webhook received it (mock the bot).
  - Deflake #112 as above: 20 consecutive green runs on one preview.
  - #131/#132 (private bag): API test that private items never appear in another member's `GET /trips/:id`.
- **M2:**
  - Native Maestro on an emulator: login, Google (manual on device), claim, expense.
  - Manual pass over the M2 gate matrix.
  - Play upload from CI: dry-run on the internal track.
  - Terms and login per the mockup: Maestro screenshot plus manual RTL review.
- **M3:**
  - OG previews: curl the custom domain's `/j/<token>` with WhatsApp/Facebook user agents and assert the `og:*` tags, and that no member data leaks (preview test).
  - App Links: `adb shell am start -d https://…/j/…` with the app installed and not installed. Check `assetlinks.json`.
  - Join in under a minute: timed manual run on a cold device.
  - Pending page goes live on approval: a Playwright realtime test.
- **M4:**
  - Push token registration and rotation (API).
  - Scheduled reminders: unit tests with fake clocks across Asia/Jerusalem DST.
  - Delivery on a real device, foreground and background.
  - Activity feed: an API test per activity type.
  - Edit expense: an API test that balances recompute. Maestro edit flow.
- **M5:**
  - Offline: Playwright `setOffline` across add, claim and expense. Mutations persist across an app kill (native, manual and Maestro `stopApp`). Conflict when two offline members claim the last unit. Fix bug #3 first.
  - Arrivals checklist: API tests.
  - Trip lifecycle and duplicate: API tests that a duplicate copies items without claims or money.
  - Campsite day: a manual run in airplane mode on a device.
