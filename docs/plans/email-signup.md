# Sign-up without Google: email code

**Status:** design, nothing built. Facts checked against the linked official pages on 2026-10-26 (Better Auth 1.7.12, the version in `apps/api`).

## Summary

Add **sign in with an email code** (Better Auth's [Email OTP plugin](https://www.better-auth.com/docs/plugins/email-otp)) next to Google. One flow is both sign-up and sign-in: type an email, get a 6-digit code, type it, you're in. No passwords, no links. Guests stay the default for WhatsApp joiners; an email account is an upgrade that keeps their trips, through the same `mergeUser` path Google uses today. Same email via Google later is the same user.

Email goes out through **Amazon SES**, defined in SST (`sst.aws.Email`). It costs **under $1/month** at 1,000 sign-ups. The blocker is **the custom domain**: SES needs a verified domain to send from and to leave the sandbox.

SMS and WhatsApp codes are out for now (user decision), see [Later](#later).

## Options

|                             | **Email code (OTP)**                                                       | Magic link                                                                                                                             | Password + verify + reset                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth                 | `emailOTP` plugin                                                          | [`magicLink`](https://www.better-auth.com/docs/plugins/magic-link) plugin                                                              | [`emailAndPassword`](https://www.better-auth.com/docs/authentication/email-password) + `emailVerification`                                                                                                                    |
| Screens                     | 2 (email, code)                                                            | 2 (email, "check your mail")                                                                                                           | 4 (sign up, sign in, verify, forgot/reset)                                                                                                                                                                                    |
| Android app                 | Works: the code is typed in the app                                        | **Breaks:** the link opens the browser, not the app, until [App Links](roadmap.md) ship; and fails when mail is read on another device | Works                                                                                                                                                                                                                         |
| Emails per user             | 1 per new device                                                           | 1 per new device                                                                                                                       | Sign-up verify + every reset                                                                                                                                                                                                  |
| Something to forget         | Nothing                                                                    | Nothing                                                                                                                                | A password; reset needs email anyway                                                                                                                                                                                          |
| Attack surface              | Code guessing (6 digits, 3 tries, rate limit)                              | Link leaks (forwarding, scanners)                                                                                                      | Credential stuffing, brute force, enumeration, scrypt CPU on Lambda (Better Auth's default hash; [argon2id](https://www.better-auth.com/docs/authentication/email-password) suggested at 64 MiB, more than our Lambda budget) |
| Sign-up = sign-in           | Yes ([auto-registers](https://www.better-auth.com/docs/plugins/email-otp)) | Yes                                                                                                                                    | No, two forms                                                                                                                                                                                                                 |
| Guest → account keeps trips | Yes (see below)                                                            | Yes                                                                                                                                    | Yes                                                                                                                                                                                                                           |

## Decision: email code

- **Fits the audience.** Israeli group-trip users on phones, arriving from WhatsApp. Copying a 6-digit code from Gmail is a pattern they know (banks, Wolt, gov.il). Nothing to remember for a trip app used a few times a year.
- **Works on Android today.** Magic links need App Links (domain + signing key, [roadmap](roadmap.md)); a code doesn't.
- **Least security work.** No password storage, no reset flow, no hashing cost on Lambda, and no enumeration: unknown emails get a code too (they're registered on use).
- **Password later if asked for.** `emailAndPassword` can be added on top; the code flow becomes its "forgot password".

## Flow

```mermaid
sequenceDiagram
  participant U as User (app/web)
  participant API as API Lambda (Better Auth)
  participant SES as Amazon SES
  participant DB as DSQL

  U->>API: POST /api/auth/email-otp/send-verification-otp {email, type: sign-in}
  API->>API: rate limit (per IP, per email)
  API->>DB: verifications: hashed code, expires 10 min
  API->>SES: Hebrew RTL email with code
  API-->>U: 200 (same answer for any email)
  U->>API: POST /api/auth/sign-in/email-otp {email, otp, name}
  API->>DB: check code (3 tries); find or create user (emailVerified = true)
  alt caller is a guest (bearer token of an anonymous user)
    API->>DB: onLinkAccount → mergeUser(guest, user); delete guest
  end
  API-->>U: session token (set-auth-token header) → stored like today
```

The anonymous plugin's link hook matches every path starting with `/sign-in` ([source](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/anonymous/index.ts), checked in the installed 1.7.12), so `/sign-in/email-otp` runs the existing `onLinkAccount` → `mergeUser` with no new code.

## Accounts and linking

- **Guest → email:** as above. The guest's display name is sent as `name`, so the profile keeps it.
- **Email first, Google later (same address):** Google says the email is verified, so Better Auth links Google to the existing user ([implicit linking](https://www.better-auth.com/docs/concepts/users-accounts)). One user, two `accounts` rows. Default config; keep `accountLinking.enabled` and don't set `disableImplicitLinking`.
- **Google first, email code later:** the code proves the address, so sign-in finds the existing user by email. One user.
- **Signed-in guest uses an email that already has an account:** the guest is merged into it, like Google today.
- Email is lower-cased and trimmed before both endpoints (Better Auth matches exactly).

## Security

- **Rate limiting becomes required** (fix-list's "Later" item). Better Auth's [limiter](https://www.better-auth.com/docs/concepts/rate-limit) is in-memory by default, which is useless on Lambda, so: `rateLimit: { enabled: true, storage: 'database' }` (new `rate_limits` table). Rules: send-code 3/min and 10/hour per IP, sign-in-with-code 10/min per IP. Plus a per-email resend cooldown of 60 s (checked in `sendVerificationOTP` against the latest `verifications` row) so one address can't be mail-bombed from many IPs. Check that the built-in database storage counts atomically on DSQL; if not, `customStorage.consume` with one `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
- **Client IP:** Better Auth reads `x-forwarded-for`, whose left part the client controls. The Lambda handler sets `x-real-ip` from API Gateway's `requestContext.http.sourceIp` and Better Auth reads only that (`advanced.ipAddress.ipAddressHeaders: ['x-real-ip']`). API Gateway stage throttling stays the outer limit.
- **Code:** 6 digits, `expiresIn: 600`, `allowedAttempts: 3`, `storeOTP: 'hashed'`. Guessing: 3 tries per code × 10 codes/hour = ~1 in 33,000 per address per hour.
- **Enumeration:** the send endpoint always returns 200. Better Auth says not to await the email send (timing); Lambda has no `waitUntil`, so we await it, and since unknown addresses also get a code, timing reveals nothing.
- **No CAPTCHA:** the limits above plus SES's own quota cap the damage. Watch the send rate (Monitoring) and add Turnstile only if abused.
- **Sessions:** unchanged. Bearer token in SecureStore (Android) and storage on web, as for Google.

## UX (Hebrew, RTL)

The login screen keeps "מתחילים עם שם" (guest) first. Under the Google button add **"כניסה עם אימייל"** → two steps on one screen:

1. **אימייל:** field (`keyboardType="email-address"`, LTR text), button "שליחת קוד". Fine print: "נשלח לך קוד בן 6 ספרות. אין צורך בסיסמה."
2. **קוד:** "שלחנו קוד ל־x@y.com" + "שינוי", six-digit field (`autoComplete="one-time-code"`, `textContentType="oneTimeCode"`), auto-submit on the 6th digit, "שליחה שוב" with a 60 s countdown. Errors: wrong code, expired, too many tries ("ביקשת יותר מדי קודים, נסו שוב בעוד דקה").

The same two steps appear on the **profile** for guests ("שמירת החשבון עם אימייל", next to Google), the upgrade path for WhatsApp joiners. No separate sign-up screen: a new address is a sign-up.

**Email** (HTML + plain text, built in code, no SES templates): `<html dir="rtl" lang="he">`, subject `קוד הכניסה שלך ליאליסט: 123456` (lets Gmail/iOS suggest it), the code large in a `dir="ltr"` span, "הקוד תקף ל־10 דקות. לא ביקשת? אפשר להתעלם."

## Changes

| Area        | Change                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API auth    | `emailOTP({ sendVerificationOTP, otpLength: 6, expiresIn: 600, allowedAttempts: 3, storeOTP: 'hashed' })`; `rateLimit` as above; `ipAddressHeaders`. A `Mailer` interface (SES / local sink / preview capture). |
| DB          | One migration: `rate_limits` (`key` PK, `count`, `last_request`). Codes use the existing `verifications` table; `users.email_verified` exists.                                                                  |
| Infra (SST) | `sst.aws.Email('Mail', { sender: '<domain>', dmarc: 'v=DMARC1; p=quarantine;' })` in `infra/global` (one identity, DKIM via Route 53), linked to the API in every stage; `events` for bounces/complaints → SNS. |
| App         | `emailOTPClient()`; `EmailSignIn` component (login + profile); strings in `he.ts`; testIDs below.                                                                                                               |
| Monitoring  | Alarms in `monitoring.ts`: SES bounce rate > 2 %, complaint rate > 0.05 % (SES pauses accounts at 10 % / 0.5 %), send-code 429s spike; Telegram notifier on each.                                               |

## E2E tests

Must ship with the feature. The flows read the code from a **mail sink**, never from a real inbox:

- **Local and CI (`pnpm e2e:web`):** `dev.ts` gives the auth a `Mailer` that keeps messages in memory and serves the last one at `GET /dev/mail?to=<email>` → `{ code }`, like `/dev/receipts` today. `dev.ts` is the local server only; the Lambda handler never mounts it.
- **PR previews (real AWS):** the API sends through **real SES** to the [mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html), `success+<run>-<flow>@simulator.amazonses.com`. It works in the sandbox, doesn't use quota and supports `+labels`, so no verified inbox or domain is needed for tests. Only in `pr-<n>` stages (`preview-pr.ts` sets `E2E_MAIL=1`), the mailer also writes each message for a `@simulator.amazonses.com` recipient to the PR's bucket (`e2e-mail/<to>.json`), and `GET /e2e/mail?to=` reads it. The route exists only with `E2E_MAIL=1`, answers only for simulator addresses, and a unit test asserts it is 404 without the flag. Chosen over SES inbound → S3, which needs an MX record on the domain and is slower.
- **How a flow gets the code:** `runScript` (`e2e/scripts/mail-code.js`, Maestro's `http.get` on `${API_URL}/dev/mail` or `/e2e/mail`) → `output.code` → `inputText`. `scripts/e2e-web.sh` and `preview.yml` pass `API_URL`.
- **Isolation:** every flow makes its own address (`success+${timestamp}-${flow}@simulator.amazonses.com`, same format locally), so shards and reruns never share a user. Cleanup: the local database is dropped after the run; a preview's DSQL and bucket go with the stage.
- **Rate limits in e2e:** all flows share one IP, so the e2e API raises the IP limits (`AUTH_RATE_LIMIT_SCALE=100`, env only set by the script and preview stages); the per-email cooldown stays real.

| Flow                     | Checks                                                                                                                  | Where                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `email-signup`           | New address → code → signed in, name shown on profile                                                                   | local, preview                                                                                                                                                                                                     |
| `email-signin`           | Existing account (made through the API in `runScript`), clear state, sign in again → same trips                         | local, preview                                                                                                                                                                                                     |
| `email-code-wrong`       | Wrong code → error; 3 wrong → "request a new code"; expired code (API test, `expiresIn` can't be waited out in Maestro) | local, preview; expiry in vitest                                                                                                                                                                                   |
| `email-resend`           | Resend disabled during countdown; second code works, first doesn't; cooldown error from API                             | local, preview                                                                                                                                                                                                     |
| `email-upgrade-guest`    | Guest creates trip, adds and claims an item → profile → email code → trip and claim still there, profile says email     | local, preview                                                                                                                                                                                                     |
| `email-second-device`    | Sign out, `clearState`, sign in with same address → same trips (a second browser is the second device)                  | local, preview                                                                                                                                                                                                     |
| Google ↔ email same user | Email user then Google, and Google then email → one `users` row, two `accounts`                                         | **vitest** in `apps/api` against local Postgres, Google's `verifyIdToken`/`getUserInfo` overridden in test config. Real Google on a preview: **manual** checklist in the PR (Maestro can't drive Google's sign-in) |
| IP rate limit (429)      | 4th send in a minute → 429 + `X-Retry-After`                                                                            | vitest (scale = 1)                                                                                                                                                                                                 |
| Android                  | Same flows once the Android workflow from [ui-tests.md](ui-tests.md) runs; `runScript` works the same                   | later                                                                                                                                                                                                              |

**testIDs:** `login-email`, `email-address`, `email-send`, `email-code`, `email-code-error`, `email-resend`, `email-change`, `profile-email-upgrade`, `profile-account-email`.

## Rollout

1. **Domain + SES** (blocked on you, below). Meanwhile `infra/global` can use a single verified sender address for dev/preview: sandbox sends only to verified recipients and the simulator, which is all e2e needs.
2. **PR 1 – rate limiting** (`fix(api)`): DB-backed limiter, client IP, `rate_limits` migration, vitest. Useful on its own.
3. **PR 2 – email code** (`feat(auth)`): plugin, mailer + sinks, SST Email, login + profile UI, e2e flows, linking tests, alarms. Behind `EXPO_PUBLIC_EMAIL_SIGNIN` until SES is out of the sandbox.
4. **Production:** SES production access granted → flag on in `production`.

## Costs

SES: $0.10 per 1,000 emails, no monthly fee ([pricing](https://aws.amazon.com/ses/pricing/)). Assumes ~3 emails per sign-up (sign-up, a resend, a later new device).

| Item                                                          | 100 sign-ups/month | 1,000 sign-ups/month |
| ------------------------------------------------------------- | -----------------: | -------------------: |
| SES (~300 / ~3,000 emails)                                    |              $0.03 |                $0.30 |
| Route 53 hosted zone (domain itself ~$15/year, needed anyway) |              $0.50 |                $0.50 |
| DSQL rate-limit writes                                        |            < $0.01 |               ~$0.05 |
| **Total**                                                     |         **~$0.55** |           **~$0.85** |

Resend (not AWS) would be free up to 3,000/month (100/day) then $20/month ([pricing](https://resend.com/pricing)); SES is cheaper and stays in SST.

## What you need to do

1. **Pick and buy the domain** (roadmap's open domain decision). SES won't reliably deliver from a Gmail address (DMARC), so production waits on this.
2. Once SST has created the identity: **request SES production access** in us-west-2 (console, "Transactional", website URL, bounce/complaint handling). AWS answers within 96 hours ([docs](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)). Sandbox is 200 emails/day, verified recipients only.
3. Approve the Hebrew wording of the screens and the email.

## Open questions

| Question                                         | Recommendation                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Offer passwords too?                             | No. Add `emailAndPassword` only if users ask; the code flow would be its reset. |
| Sender address                                   | `noreply@<domain>` with `Reply-To` your support address; display name "יאליסט". |
| Code lifetime                                    | 10 minutes (people switch to Gmail and back).                                   |
| Show email on the login screen or behind a link? | Behind "כניסה עם אימייל", so guest stays the one obvious start.                 |
| SES in `infra/global` or per stage?              | Global: one identity, one sandbox exit; stages link it with `Email.get`.        |

## Later

- **SMS / WhatsApp codes:** not now (user decision). Would need AWS End User Messaging with SMS Protect against pumping, or a WhatsApp Business sender.
- Passkeys, once there are accounts worth protecting.
