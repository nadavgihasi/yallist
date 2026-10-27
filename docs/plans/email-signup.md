# Sign-up without Google: email and password

**Status:** design, nothing built. Facts checked against the linked official pages and the Better Auth 1.7.12 source (the version in `apps/api`, tag [`v1.7.12`](https://github.com/better-auth/better-auth/tree/v1.7.12)) on 2026-10-27.

## Summary

Add **email + password** (Better Auth [`emailAndPassword`](https://www.better-auth.com/docs/authentication/email-password)) next to Google (user decision: we want passwords). Sign up with name, email and password; sign in with email and password. Every email step uses a **6-digit code**, never a link: the [Email OTP plugin](https://www.better-auth.com/docs/plugins/email-otp) verifies the address on sign-up (`email-verification`) and resets a forgotten password (`forget-password`). No passwordless code sign-in. Guests stay the default for WhatsApp joiners; a password account is an upgrade that keeps their trips, through the same `mergeUser` path Google uses today. Same email via Google is the same user.

Email goes out through **Amazon SES**, defined in SST (`sst.aws.Email`). It costs **under $1/month** at 1,000 sign-ups. The blocker is **the custom domain**: SES needs a verified domain to send from and to leave the sandbox.

SMS and WhatsApp codes are out for now (user decision), see [Later](#later).

## Options

|                             | **Password, code to verify and reset**                                                      | Email code only (OTP) | Magic link                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| Better Auth                 | `emailAndPassword` + `emailOTP` (`overrideDefaultEmailVerification`)                        | `emailOTP`            | [`magicLink`](https://www.better-auth.com/docs/plugins/magic-link) plugin |
| Screens                     | 4 (sign up, sign in, verify code, forgot/reset)                                             | 2 (email, code)       | 2 (email, "check your mail")                                              |
| Android app                 | Works: codes are typed in the app                                                           | Works                 | **Breaks:** the link opens the browser until [App Links](roadmap.md) ship |
| Emails per user             | Sign-up verify + each reset                                                                 | 1 per new device      | 1 per new device                                                          |
| Sign in without the mailbox | **Yes**                                                                                     | No                    | No                                                                        |
| Attack surface              | Credential stuffing, brute force, weak passwords, enumeration, hash CPU (all handled below) | Code guessing         | Link leaks (forwarding, scanners)                                         |
| Guest → account keeps trips | Yes (on verify and on sign-in, [below](#accounts-and-linking))                              | Yes                   | Yes                                                                       |

## Decisions

| Topic                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main path                 | `emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 6, revokeSessionsOnPasswordReset: true, onExistingUserSignUp }`.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Verify the address        | **6-digit code**: `emailOTP({ overrideDefaultEmailVerification: true })` turns Better Auth's verification link into a code ([docs](https://www.better-auth.com/docs/plugins/email-otp#override-default-email-verification)). `emailVerification: { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: true }`: the code is sent on sign-up, again when an unverified user signs in (403 `EMAIL_NOT_VERIFIED`), and a correct code signs the user in ([source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/plugins/email-otp/routes.ts#L532)). |
| Forgot password           | **6-digit code**: `POST /email-otp/request-password-reset`, then `POST /email-otp/reset-password { email, otp, password }` ([docs](https://www.better-auth.com/docs/plugins/email-otp#reset-password-with-otp)). The app then signs in with the new password. A reset also marks the email verified.                                                                                                                                                                                                                                                                                                 |
| Passwordless code sign-in | **Not offered.** One way in per screen keeps the UI simple; "forgot password" already is the no-password path (email → code → new password → in). `emailOTP` always mounts `/sign-in/email-otp`, so block it: `disableSignUp: true` and `disabledPaths: ['/sign-in/email-otp', '/forget-password/email-otp', '/request-password-reset']` (the last two: the deprecated OTP alias and the link-based reset). Easy to add later as a "send me a code instead" link if users ask.                                                                                                                       |
| Password policy           | Min **6** characters (user decision), max 128 (Better Auth default), any characters (Hebrew, spaces, emoji), **no composition rules** ([NIST SP 800-63B §3.1.1.2](https://pages.nist.gov/800-63-4/sp800-63b.html)). **No breached-password check** (user decision). NIST asks for 15 characters and a blocklist for password-only sign-in; this policy is deliberately weaker, and the per-account rate limit is what stops guessing.                                                                                                                                                                |
| Hash                      | **Keep Better Auth's default scrypt**, see [Hashing](#hashing-on-lambda).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sessions                  | Unchanged: an opaque session token in the DB, sent as `Authorization: Bearer` (bearer plugin), stored in SecureStore (Android) / storage (web), as for Google and guests.                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Flow

```mermaid
sequenceDiagram
  participant U as User (app/web)
  participant API as API Lambda (Better Auth)
  participant SES as Amazon SES
  participant DB as DSQL

  U->>API: POST /api/auth/sign-up/email {name, email, password}
  API->>API: rate limit (IP, email)
  API->>DB: user (emailVerified false) + credential account (scrypt hash)
  API->>SES: Hebrew RTL email with code (or "you already have an account")
  API-->>U: 200, token null (same answer for an existing email)
  U->>API: POST /api/auth/email-otp/verify-email {email, otp}
  API->>DB: check code (3 tries); emailVerified = true; new session
  alt caller is a guest (bearer token of an anonymous user)
    API->>DB: onLinkAccount → mergeUser(guest, user); delete guest
  end
  API-->>U: session token (set-auth-token header) → stored like today
```

Sign-in is one call: `POST /api/auth/sign-in/email {email, password}` → token.

## Accounts and linking

The anonymous plugin's after-hook matches paths starting with `/sign-in`, `/sign-up` and `/email-otp/verify-email`, and runs only when the response sets a session ([source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/plugins/anonymous/index.ts#L342), checked in the installed 1.7.12). So:

| Case                                        | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest → **sign up** with a password         | `/sign-up/email` matches but sets no session (verification required), so nothing merges yet and the guest stays signed in. `/email-otp/verify-email` with the guest's bearer creates the session → `onLinkAccount` → `mergeUser`, guest deleted. No new code. The guest's display name prefills `name`. If the code is entered on another device (no guest token there), the trips stay with the guest on the first device.                        |
| Guest → **sign in** to an existing account  | `/sign-in/email` sets a session → merge, like Google today. Same after a reset (the app signs in with the new password).                                                                                                                                                                                                                                                                                                                           |
| Password first, Google later                | Google's email is verified and the local user is verified, so Better Auth links Google to the user ([implicit linking](https://www.better-auth.com/docs/concepts/users-accounts)). One user, two `accounts` rows.                                                                                                                                                                                                                                  |
| Password first **unverified**, Google later | Refused (`account not linked`): `requireLocalEmailVerified` defaults to true ([source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/oauth2/link-account.ts#L288)). This stops a squatter who registered someone else's address from taking over their Google sign-in. The real owner uses "forgot password", which verifies the address and replaces the squatter's password; the Google error screen says so. |
| Google first, password later                | Sign-up returns the usual answer but creates nothing; `onExistingUserSignUp` emails "you already have an account; sign in with Google or set a password with 'שכחתי סיסמה'". Reset creates the `credential` account when there is none ([source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/utils/password.ts#L40)). One user, two `accounts` rows.                                                          |

Keep `accountLinking.enabled` and don't set `disableImplicitLinking` (defaults). The client trims email; Better Auth lower-cases it.

## Security

### Rate limits

Better Auth's [limiter](https://www.better-auth.com/docs/concepts/rate-limit) counts **per IP and path** only, and is in-memory by default (useless on Lambda). Use `rateLimit: { enabled: true, storage: 'database' }`; its database storage checks and increments atomically (a conditional `count < max` update, [source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/api/rate-limiter/index.ts#L205)). Per-account limits are ours: a `hooks.before` on the paths below keys the same table by `acct:<sha256(email)>:<path>`.

| Path                                                                    | Per IP (`customRules`)        | Per account (our hook)               | Against                                     |
| ----------------------------------------------------------------------- | ----------------------------- | ------------------------------------ | ------------------------------------------- |
| `/sign-in/email`                                                        | 10 / min                      | 10 / 15 min                          | Brute force on one account; stuffing per IP |
| `/sign-up/email`                                                        | 10 / hour                     | 1 / 60 s and 5 / hour (sends mail)   | Mass sign-up, mail-bombing                  |
| `/email-otp/send-verification-otp`, `/email-otp/request-password-reset` | 3 / min (Better Auth default) | 1 / 60 s and 5 / hour                | Mail-bombing one address from many IPs      |
| `/email-otp/verify-email`, `/email-otp/reset-password`                  | 10 / min                      | 3 tries per code (`allowedAttempts`) | Code guessing                               |

- **Credential stuffing** comes from many IPs, so per-IP limits only slow it. The real defences: the per-account limit and Google as the alternative. With 6-character passwords and no breached-password check, reused passwords are the main risk; watch the sign-in 401 alarm. Per-IP limits stay loose because Israeli mobile carriers put many users behind one IP (CGNAT).
- **Account lockout by an attacker:** the per-account sign-in limit lets someone block a victim's password sign-in for 15 minutes. Accepted: Google and "forgot password" still work, and nothing is locked permanently.
- **Client IP:** Better Auth reads `x-forwarded-for`, whose left part the client controls. The Lambda handler sets `x-real-ip` from API Gateway's `requestContext.http.sourceIp`, and Better Auth reads only that (`advanced.ipAddress.ipAddressHeaders: ['x-real-ip']`). API Gateway stage throttling stays the outer limit.
- **Codes:** 6 digits, `expiresIn: 600`, `allowedAttempts: 3`, `storeOTP: 'hashed'`.
- DSQL uses optimistic concurrency: parallel requests on one key may fail with a conflict. The vitest suite fires them in parallel; on conflict, retry once.
- **No CAPTCHA:** Watch sign-in 401s and 429s (Monitoring). Add Better Auth's [captcha plugin](https://www.better-auth.com/docs/plugins/captcha) (Turnstile) only if abused.

### Account enumeration

| Endpoint            | Same answer for known and unknown emails?                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up             | Yes, with `requireEmailVerification`: an existing email gets a 200 with a fake user and `token: null`, after hashing the password anyway ([docs](https://www.better-auth.com/docs/authentication/email-password#email-enumeration-protection), [source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/api/routes/sign-up.ts#L225)). The app always shows "enter the code"; the owner gets the "you already have an account" email instead. |
| Sign-in             | Yes: 401 `INVALID_EMAIL_OR_PASSWORD` for both, and an unknown email still runs a hash, so timing matches ([source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/api/routes/sign-in.ts#L542)). `EMAIL_NOT_VERIFIED` comes only after a correct password.                                                                                                                                                                                   |
| Reset / resend code | Yes: 200 either way ([source](https://github.com/better-auth/better-auth/blob/v1.7.12/packages/better-auth/src/plugins/email-otp/routes.ts#L742)). But an unknown email skips the SES call, so it answers faster. Lambda has no `waitUntil` to send in the background, so these three send endpoints (and sign-up) answer no sooner than 1.5 s (a Hono middleware).                                                                                                           |

### Hashing on Lambda

|                  | **scrypt (default)**                                                                                                                                   | argon2id                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parameters       | N=16384, r=16, p=1, 64-byte key: 32 MiB ([source](https://github.com/better-auth/utils/blob/v0.5.0/src/password.node.ts#L4-L6)); input NFKC-normalised | OWASP minimum 19 MiB, t=2                                                                                                                                                                                                        |
| Implementation   | `node:crypto` on the libuv thread pool: no native module                                                                                               | `@node-rs/argon2` (the [docs' example](https://www.better-auth.com/docs/authentication/email-password#configuration)), a native binary per arch that must match arm64 in the bundle; or `crypto.argon2`, experimental in Node 24 |
| Memory on Lambda | 32 MiB of the API's 1,024 MB (SST default), per concurrent hash                                                                                        | Similar                                                                                                                                                                                                                          |
| Latency          | 37 ms measured on an M-series Mac; estimate ~0.1–0.15 s on arm64 at 1,024 MB (~0.6 vCPU). PR 2 logs it.                                                | Similar at OWASP settings                                                                                                                                                                                                        |
| Migration later  | —                                                                                                                                                      | Custom `hash`/`verify` that accepts both formats                                                                                                                                                                                 |

**Keep scrypt.** OWASP recommends scrypt when argon2id isn't available, which is Better Auth's own reasoning; the gain from argon2id is small, and it would add the API's first native binary ([core.ts](../../infra/app/core.ts) relies on plain-JS bundles for arm64). Each sign-in and sign-up costs one hash, which the rate limits cap.

## UX (Hebrew, RTL)

The login screen keeps "מתחילים עם שם" (guest) first, then Google, then **"כניסה עם אימייל"** → the sign-in screen.

| Screen                   | Content                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **כניסה** (sign in)      | Email, password, "כניסה". Links: "שכחתי סיסמה", "אין לך חשבון? הרשמה". Error: "האימייל או הסיסמה שגויים" (one message for both). 429: "יותר מדי ניסיונות, נסו שוב בעוד כמה דקות".                                                                                                                            |
| **הרשמה** (sign up)      | Name (prefilled for guests), email, password with hint "לפחות 6 תווים", "הרשמה". Too short: "הסיסמה צריכה להכיל לפחות 6 תווים". Link: "כבר יש לך חשבון? כניסה".                                                                                                                                              |
| **אימות** (verify code)  | "שלחנו קוד ל־x@y.com" + "שינוי", six-digit field (`autoComplete="one-time-code"`, `textContentType="oneTimeCode"`), auto-submit on the 6th digit, "שליחה שוב" with a 60 s countdown. Errors: wrong code, expired, too many tries. Shown after sign-up and after a sign-in that returns `EMAIL_NOT_VERIFIED`. |
| **שכחתי סיסמה** (forgot) | Step 1: email, "שליחת קוד". Step 2 on the same screen: code field (as above) + new password, "שמירה וכניסה" → reset, then sign in.                                                                                                                                                                           |

**Password field** (one `PasswordInput` component): `secureTextEntry`, text typed **LTR** (`writingDirection: 'ltr'`, `textAlign: 'left'`; `dir="ltr"` on web) inside the RTL form, label still on the right; `autoCapitalize="none"`, `autoCorrect={false}`; `autoComplete`/`textContentType` `new-password`/`newPassword` on sign-up and reset, `current-password`/`password` on sign-in, so password managers fill and save. A **show/hide** eye button at the field's left edge (`accessibilityLabel` "הצגת סיסמה" / "הסתרת סיסמה"), useful when the Hebrew keyboard was on. Email fields: `keyboardType="email-address"`, LTR.

The **profile** for guests shows "שמירת החשבון עם אימייל" next to Google → the sign-up screen, with a link to sign in for existing accounts. That's the upgrade path for WhatsApp joiners.

**Email** (HTML + plain text, built in code, no SES templates), one per `type`: verify (subject `קוד האימות שלך ליאליסט: 123456`), reset (`קוד לאיפוס הסיסמה ביאליסט: 123456`), and "you already have an account" (no code). `<html dir="rtl" lang="he">`, the code large in a `dir="ltr"` span, "הקוד תקף ל־10 דקות. לא ביקשת? אפשר להתעלם." The code in the subject lets Gmail/iOS suggest it.

## Changes

| Area        | Change                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API auth    | `emailAndPassword` and `emailVerification` as in [Decisions](#decisions); `emailOTP({ sendVerificationOTP, overrideDefaultEmailVerification: true, disableSignUp: true, otpLength: 6, expiresIn: 600, allowedAttempts: 3, storeOTP: 'hashed' })`; `disabledPaths`; `rateLimit` + per-account hook; `ipAddressHeaders`; response-time floor on send endpoints. A `Mailer` interface (SES / local sink / preview capture). |
| DB          | One migration: `rate_limits` (`key` PK, `count`, `last_request`). Passwords go in `accounts.password` (`providerId: 'credential'`), codes in `verifications`, and `users.email_verified` exists: no other schema change.                                                                                                                                                                                                 |
| Infra (SST) | `sst.aws.Email('Mail', { sender: '<domain>', dmarc: 'v=DMARC1; p=quarantine;' })` in `infra/global` (one identity, DKIM via Route 53), linked to the API in every stage; `events` for bounces/complaints → SNS.                                                                                                                                                                                                          |
| App         | `emailOTPClient()`; sign-in, sign-up, verify and forgot screens; `PasswordInput`; profile upgrade entry; strings in `he.ts`; testIDs below.                                                                                                                                                                                                                                                                              |
| Monitoring  | Alarms in `monitoring.ts`: SES bounce rate > 2 %, complaint rate > 0.05 % (SES pauses accounts at 10 % / 0.5 %), auth 429s spike, sign-in 401s spike (stuffing); Telegram notifier on each.                                                                                                                                                                                                                              |

## E2E tests

Must ship with the feature. The flows read codes from a **mail sink**, never from a real inbox:

- **Local and CI (`pnpm e2e:web`):** `dev.ts` gives the auth a `Mailer` that keeps messages in memory and serves the last one at `GET /dev/mail?to=<email>` → `{ type, code }`, like `/dev/receipts` today. `dev.ts` is the local server only; the Lambda handler never mounts it.
- **PR previews (real AWS):** the API sends through **real SES** to the [mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html), `success+<run>-<flow>@simulator.amazonses.com`. It works in the sandbox, doesn't use quota and supports `+labels`, so no verified inbox or domain is needed for tests. Only in `pr-<n>` stages (`preview-pr.ts` sets `E2E_MAIL=1`), the mailer also writes each message for a `@simulator.amazonses.com` recipient to the PR's bucket (`e2e-mail/<to>.json`), and `GET /e2e/mail?to=` reads it. The route exists only with `E2E_MAIL=1`, answers only for simulator addresses, and a unit test asserts it is 404 without the flag. Chosen over SES inbound → S3, which needs an MX record on the domain and is slower.
- **How a flow gets the code:** `runScript` (`e2e/scripts/mail-code.js`, Maestro's `http.get` on `${API_URL}/dev/mail` or `/e2e/mail`) → `output.code` → `inputText`. `scripts/e2e-web.sh` and `preview.yml` pass `API_URL`.
- **Isolation:** every flow makes its own address (`success+${timestamp}-${flow}@simulator.amazonses.com`, same format locally), so shards and reruns never share a user. Cleanup: the local database is dropped after the run; a preview's DSQL and bucket go with the stage.
- **Rate limits in e2e:** all flows share one IP, so the e2e API raises the IP limits (`AUTH_RATE_LIMIT_SCALE=100`, env only set by the script and preview stages); per-account limits stay real.

| Flow                        | Checks                                                                                                                                                                                                                                                                                                          | Where                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `password-signup`           | Name, email, password → verify screen → code from the sink → signed in, name on profile                                                                                                                                                                                                                         | local, preview                                                                                                                                                                |
| `password-signin`           | Account made through the API in `runScript` (sign-up + code), clear state, sign in → same trips; show/hide toggle reveals the text                                                                                                                                                                              | local, preview                                                                                                                                                                |
| `password-wrong`            | Wrong password and unknown email → the same error text                                                                                                                                                                                                                                                          | local, preview                                                                                                                                                                |
| `password-forgot`           | Forgot → code from the sink → new password → signed in; old password then fails                                                                                                                                                                                                                                 | local, preview                                                                                                                                                                |
| `verify-code-wrong`         | Wrong code → error; resend disabled during countdown; second code works; unverified sign-in → verify screen                                                                                                                                                                                                     | local, preview                                                                                                                                                                |
| `password-upgrade-guest`    | Guest creates trip, adds and claims an item → profile → sign up with password → code → trip and claim still there, profile says email                                                                                                                                                                           | local, preview                                                                                                                                                                |
| Auth API                    | Sign-up with an existing email: same response shape, "already have an account" mail, no code; reset for unknown email: 200, no mail; expired code; 5-character password rejected, 6 accepted; `/sign-in/email-otp` 404; guest merge on `/email-otp/verify-email` and `/sign-in/email`, none on `/sign-up/email` | **vitest** in `apps/api` against local Postgres                                                                                                                               |
| Rate limits                 | 11th sign-in from one IP in a minute → 429 + `X-Retry-After`; 11th sign-in for one email from different `x-real-ip`s → 429; second code within 60 s → 429; parallel requests on one key count once each                                                                                                         | **vitest** (scale = 1)                                                                                                                                                        |
| Google ↔ password same user | Password (verified) then Google, and Google then reset-to-set-password → one `users` row, two `accounts`; unverified password user then Google → refused                                                                                                                                                        | **vitest**, Google's `verifyIdToken`/`getUserInfo` overridden in test config. Real Google on a preview: **manual** checklist in the PR (Maestro can't drive Google's sign-in) |
| Android                     | Same flows once the Android workflow from [ui-tests.md](ui-tests.md) runs; `runScript` works the same                                                                                                                                                                                                           | later                                                                                                                                                                         |

**testIDs:** `login-email`, `signin-email`, `signin-password`, `signin-submit`, `signin-error`, `signin-forgot`, `signin-to-signup`, `signup-name`, `signup-email`, `signup-password`, `signup-submit`, `signup-error`, `password-toggle`, `verify-code`, `verify-error`, `verify-resend`, `verify-change`, `forgot-email`, `forgot-send`, `forgot-code`, `forgot-password`, `forgot-submit`, `profile-email-upgrade`, `profile-account-email`.

## Rollout

1. **Domain + SES** (blocked on you, below). Meanwhile `infra/global` can use a single verified sender address for dev/preview: sandbox sends only to verified recipients and the simulator, which is all e2e needs.
2. **PR 1 – rate limiting** (`fix(api)`): DB-backed limiter, client IP, per-account hook, `rate_limits` migration, vitest. Useful on its own.
3. **PR 2 – email and password** (`feat(auth)`): `emailAndPassword` + `emailOTP`, mailer + sinks, SST Email, screens, e2e flows, linking tests, alarms. Behind `EXPO_PUBLIC_EMAIL_SIGNIN` until SES is out of the sandbox.
4. **Production:** SES production access granted → flag on in `production`.

## Costs

SES: $0.10 per 1,000 emails, no monthly fee ([pricing](https://aws.amazon.com/ses/pricing/)). Assumes ~2 emails per sign-up (the verify code, plus a resend or a later reset).

| Item                                                          | 100 sign-ups/month | 1,000 sign-ups/month |
| ------------------------------------------------------------- | -----------------: | -------------------: |
| SES (~200 / ~2,000 emails)                                    |              $0.02 |                $0.20 |
| Route 53 hosted zone (domain itself ~$15/year, needed anyway) |              $0.50 |                $0.50 |
| DSQL rate-limit writes                                        |            < $0.01 |               ~$0.05 |
| Lambda time for hashing (~0.15 s × 1 GB per sign-in)          |            < $0.01 |              < $0.01 |
| **Total**                                                     |         **~$0.55** |           **~$0.75** |

Resend (not AWS) would be free up to 3,000/month (100/day) then $20/month ([pricing](https://resend.com/pricing)); SES is cheaper and stays in SST.

## What you need to do

1. **Pick and buy the domain** (roadmap's open domain decision). SES won't reliably deliver from a Gmail address (DMARC), so production waits on this.
2. Once SST has created the identity: **request SES production access** in us-west-2 (console, "Transactional", website URL, bounce/complaint handling). AWS answers within 96 hours ([docs](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)). Sandbox is 200 emails/day, verified recipients only.
3. Approve the Hebrew wording of the screens and the emails.

## Open questions

| Question                                         | Recommendation                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Sender address                                   | `noreply@<domain>` with `Reply-To` your support address; display name "יאליסט". |
| Code lifetime                                    | 10 minutes (people switch to Gmail and back).                                   |
| Show email on the login screen or behind a link? | Behind "כניסה עם אימייל", so guest stays the one obvious start.                 |
| SES in `infra/global` or per stage?              | Global: one identity, one sandbox exit; stages link it with `Email.get`.        |

## Later

- **SMS / WhatsApp codes:** not now (user decision). Would need AWS End User Messaging with SMS Protect against pumping, or a WhatsApp Business sender.
- Passkeys, once there are accounts worth protecting.
- A "send me a code instead" sign-in link, if users ask: remove `/sign-in/email-otp` from `disabledPaths`.
- Remove unverified sign-ups older than a few days, if squatted addresses become a support issue (today "forgot password" fixes it).
