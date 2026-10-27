# Deploying

Infrastructure is [SST](https://sst.dev), in two SST apps. Both live in the `@yallist/infra` workspace package under [infra/](../infra), which owns the `sst` dependency and the deploy scripts; the root `pnpm deploy:*` and `pnpm sst` scripts delegate to it.

- **App** ([infra/app](../infra/app)): the API, its database and the Expo web export. Stages `dev` and `production`, plus the PR preview stages `preview` and `pr-<n>` ([PR previews](#pr-previews)). [sst.config.ts](../infra/app/sst.config.ts) picks each stage's region and credentials, then runs one file per kind of stage:

  | Stage               | File                                                              | What it creates                                                                                                                                                                        |
  | ------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `dev`, `production` | [stacks/app.ts](../infra/app/stacks/app.ts)                       | The app, with an HTTP API of its own, and its alerts ([monitoring.ts](../infra/app/monitoring.ts)): the `Alerts` topic and Telegram notifier, and in production the CloudWatch alarms. |
  | `preview`           | [stacks/preview-shared.ts](../infra/app/stacks/preview-shared.ts) | What every PR preview shares: the CloudFront Router, the HTTP API and the SSM parameter with their ids.                                                                                |
  | `pr-<n>`            | [stacks/preview-pr.ts](../infra/app/stacks/preview-pr.ts)         | One PR's copy of the app: its API Lambda with a route and integration on the shared API, its site on the Router, the permissions boundary on its roles and its expiry.                 |

  The app's parts (database, secrets, realtime, site, receipts, API Lambda) are in [core.ts](../infra/app/core.ts), shared by `app.ts` and `preview-pr.ts`, so a preview is built like `dev`.

- **Global** ([infra/global](../infra/global)): account-wide resources in `eu-central-1`. [sst.config.ts](../infra/global/sst.config.ts) has the $10/month budget, which emails `BUDGET_EMAIL` at 80% actual and 100% forecasted spend, and the IAM role GitHub Actions deploys with. [preview.ts](../infra/global/preview.ts) has the preview role, its permissions boundary and a $5/month `us-west-2` budget. One stage, `global`, protected.

## Deploys come from `main`

[deploy.yml](../.github/workflows/deploy.yml) runs on every push to `main`. It first runs CI ([ci.yml](../.github/workflows/ci.yml), the same checks as pull requests) and stops if it fails. Then it deploys `global`, then `dev`, then `production`, each in the GitHub environment of the same name. Those environments only accept the `main` branch. Last, it tags the release ([releases.md](releases.md)).

- **Credentials:** jobs get them through GitHub OIDC. They assume the role in the repo variable `AWS_DEPLOY_ROLE_ARN`, so no AWS keys are stored in GitHub.
- **Checks:** after each stage deploys and migrates, the job fetches the API's `/health` and the web app's URL. If dev fails, production doesn't deploy.
- **Laptops:** don't deploy from a laptop except for the one-time bootstrap below or an emergency.

### One-time bootstrap

The deploy role is created by the global stack, so the first global deploy runs locally:

```sh
BUDGET_EMAIL=$(gh variable get BUDGET_EMAIL) pnpm deploy:global
gh variable set AWS_DEPLOY_ROLE_ARN --body <deployRoleArn from the output>
```

After that, the `yallist-dev` access key is only needed for emergencies. Consider deactivating it in IAM.

## Stages

There are two app stages, plus the PR previews' stages. Any other `--stage` fails before touching AWS.

| Stage        | Region         | Command                                       | AWS profile    | On `sst remove`                        |
| ------------ | -------------- | --------------------------------------------- | -------------- | -------------------------------------- |
| `dev`        | `us-east-2`    | `pnpm deploy:dev`                             | `yallist-dev`  | Everything is deleted.                 |
| `production` | `eu-central-1` | `pnpm deploy:prod`                            | `yallist-prod` | Refused (`protect`). Buckets retained. |
| `preview`    | `us-west-2`    | [preview-stage.yml](#pr-previews)             | `yallist-dev`  | Everything is deleted.                 |
| `pr-<n>`     | `us-west-2`    | [preview.yml](#pr-previews), CI only (`CI=1`) | none           | Everything is deleted.                 |

The profile and region are set per stage in `infra/app/sst.config.ts`, not in the scripts. In CI (`CI=true`) no profile is used. That way every `sst` command (`deploy`, `diff`, `remove`) picks the right credentials without an `AWS_PROFILE=` prefix.

Every `sst` command needs `--stage dev` or `--stage production`, including `pnpm sst install`. From the repo root, `pnpm sst <args>` runs `sst <args>` against the app. SST's default personal stage (your username) is rejected.

## Prerequisites

Two AWS CLI profiles backed by IAM user access keys. Both use the same AWS account for now:

```sh
aws configure --profile yallist-dev    # access key and secret; sst.config.ts sets each stage's region
aws configure --profile yallist-prod   # same keys for now
```

To move production to its own account or IAM user later, point the `yallist-prod` profile at the new credentials. No code change is needed.

## Deploy locally (bootstrap or emergency only)

```sh
pnpm deploy:dev    # dev
pnpm deploy:prod   # production
```

This bundles the API Lambda, builds `apps/mobile` with `expo export -p web` and uploads `dist/`. The command prints the CloudFront URL (`url`) and the API URL (`api`).

## API

[apps/api](../apps/api) is a [Hono](https://hono.dev) app. One Lambda serves every path behind an API Gateway HTTP API (`$default` route). All Lambdas run on arm64 (a `$transform` in [core.ts](../infra/app/core.ts)).

- **URL:** the `api` output of `sst deploy`. The web build gets it as `EXPO_PUBLIC_API_URL` ([src/lib/api.ts](../apps/mobile/src/lib/api.ts)).
- **Health check:** `curl $API/health` returns `{"ok":true}`.
- **CORS:** any origin. Auth uses bearer tokens, not cookies, so there is nothing for another origin to ride on.

## Database

Aurora DSQL, one cluster per stage (`sst.aws.Dsql('Database')`), available in both stage regions. It is linked to the API Lambda, which connects as `admin` with a short-lived IAM auth token ([client.ts](../apps/api/src/db/client.ts)). There is no password to store.

- **Backups:** production only, through AWS Backup (`backup` on `sst.aws.Dsql`): a daily snapshot at 05:00 UTC, kept 7 days, in a vault SST creates beside the cluster. Restore from the AWS Backup console into a new cluster.
- **Deletion protection:** on for the production cluster, so it can't be deleted from the console or CLI either. Turn it off in [core.ts](../infra/app/core.ts) before a deliberate teardown.
- **Schema:** [schema.ts](../apps/api/src/db/schema.ts), Drizzle, kept to DSQL's SQL subset: no enum types (text plus `CHECK`), no triggers or extensions, UUID keys, money in integer agorot. Foreign keys are enforced; they use `NO ACTION` because cascades count toward the 3,000-rows-per-transaction limit.
- **Migrations:** after changing the schema, run `pnpm --filter @yallist/api db:generate` and commit the new file in `apps/api/drizzle/`. Never edit a migration that has been deployed.
- **Runner:** [migrate.ts](../apps/api/src/db/migrate.ts) runs each statement in its own transaction (DSQL allows one DDL per transaction) and records it in `__migrations`, so a failed run resumes where it stopped. For DSQL it rewrites `CREATE INDEX` to `CREATE INDEX ASYNC` and adds `ALTER TABLE` constraints as `NOT VALID`. It then reloads `template_items` from `@yallist/domain` TEMPLATES.
- **Deploys:** [deploy.yml](../.github/workflows/deploy.yml) runs the migrations after each stage deploys: `pnpm sst shell --stage <stage> -- pnpm --filter @yallist/api db:migrate`.
- **Local and tests:** with `DATABASE_URL` set, everything uses plain Postgres instead (DSQL has no emulator). The API tests migrate a throwaway database and skip without `DATABASE_URL`; CI provides a `postgres:17` service.

```sh
docker run -d --rm --name yallist-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17
export DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres
pnpm test
```

## Auth

[Better Auth](https://better-auth.com) ([auth.ts](../apps/api/src/auth.ts)) is served by the API under `/api/auth/*`, with its tables (`users`, `sessions`, `accounts`, `verifications`) in the same database.

- **Sign-in:** as a guest (`POST /api/auth/sign-in/anonymous` with `{ "name": "…" }`) or with Google. A guest who later signs in with Google keeps their trips: they move to the Google user, and the guest user is deleted.
- **Tokens:** clients send the session token as `Authorization: Bearer <token>`, not as a cookie. The API and the web app are on different domains, and Android has no cookie jar. Sign-in responses return the token.
- **Profiles:** every new user gets a `profiles` row, named after their Google name or the name given for guest sign-in. `GET /me` returns it.
- **Google OAuth clients:** one per stage, in Google Cloud Console. The client IDs are public and set in [infra/app/core.ts](../infra/app/core.ts). Each client needs the redirect URI `<api>/api/auth/callback/google`, where `<api>` is that stage's `api` output.

### Secrets

The API needs two secrets per stage, `BetterAuthSecret` (signs sessions; changing it signs everyone out) and `GoogleClientSecret`. Their source of truth is GitHub: each is an environment secret on the `dev` and `production` environments.

| SST secret           | GitHub environment secret |
| -------------------- | ------------------------- |
| `BetterAuthSecret`   | `BETTER_AUTH_SECRET`      |
| `GoogleClientSecret` | `GOOGLE_CLIENT_SECRET`    |

SST reads a secret's value from the `SST_SECRET_<name>` environment variable, so [deploy.yml](../.github/workflows/deploy.yml) sets `SST_SECRET_BetterAuthSecret` and `SST_SECRET_GoogleClientSecret` from them on the `dev` and `production` jobs. Nothing is stored with `sst secret set`.

```sh
gh secret set BETTER_AUTH_SECRET --env dev --body "$(openssl rand -base64 32)"
gh secret set GOOGLE_CLIENT_SECRET --env dev   # paste the client secret from Google Cloud
# and the same with --env production
```

For a local emergency deploy, export the same variables first, e.g. `SST_SECRET_BetterAuthSecret=… SST_SECRET_GoogleClientSecret=… pnpm deploy:dev`.

#### Feature requests to GitHub (optional)

`POST /feedback` ([feedback.ts](../apps/api/src/routes/feedback.ts)) saves every feature request or bug report from the app in the `feedback` table and, when the stage has a token, also opens an issue in [nadavgihasi/yallist](https://github.com/nadavgihasi/yallist/issues) labelled `feature-request` or `bug`, and `untrusted`. The issue has the user's text, defanged (inside a code block, @mentions broken, under an "untrusted content" warning), the app version, platform and stage, and an anonymous reporter id; never a name, email or phone. Each user can send 5 requests an hour; past 50 issues a day across all users, requests are only saved.

| SST secret            | GitHub environment secret |
| --------------------- | ------------------------- |
| `GithubFeedbackToken` | `FEEDBACK_GITHUB_TOKEN`   |

The secret is optional. Without it, deploy.yml passes an empty value and the API only saves requests (the SST secret's placeholder, `unset`, is treated the same). GitHub doesn't allow secret names starting with `GITHUB_`, hence `FEEDBACK_GITHUB_TOKEN`.

1. Create a fine-grained personal access token at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new): resource owner `nadavgihasi`, **Only select repositories** → `nadavgihasi/yallist`, repository permissions **Issues: Read and write** and nothing else (Metadata: read-only is added automatically). Pick an expiry and note it; when it expires, issues stop being opened, requests are still saved.
2. Create the labels once (`bug` already exists): `gh label create feature-request -R nadavgihasi/yallist --description "Requested from the app"` and `gh label create untrusted -R nadavgihasi/yallist --description "User-submitted content from the app"`.
3. Store the token on both environments; the next deploy picks it up:

```sh
gh secret set FEEDBACK_GITHUB_TOKEN --env dev          # paste the token
gh secret set FEEDBACK_GITHUB_TOKEN --env production
```

A request without an issue (`github_issue_number` null: saved before the token existed, GitHub failed, or past the daily cap) is retried on every deploy: after migrations, deploy.yml runs `feedback:retry` ([feedback-retry.ts](../apps/api/src/feedback-retry.ts)), which opens the missing issues oldest first, within the same 50-a-day cap. Each sender claims a request (`github_issue_at`) before calling GitHub, so the API and overlapping runs never open an issue twice; a failed send drops its claim, and a claim left by a crash expires after 10 minutes. Without a token, the API and the retry log a warning and only save.

## Realtime

An [AppSync Events](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html) API per stage, `yallist-<stage>-realtime` ([realtime.ts](../apps/api/src/realtime.ts)), with one channel per trip: `/trips/<tripId>` in the `trips` namespace.

- **Publish:** after each successful write to a trip, the API publishes `{ "type": "changed", "tripId": "…" }` to its channel, signed with the API Lambda's IAM role. Events carry no personal data; clients refetch through the API. Publishing is best effort: a failure is logged and the write still succeeds.
- **Subscribe:** clients connect to `wss://<realtime host>/event/realtime` with their session token as the authorization. The web build gets the host as `EXPO_PUBLIC_REALTIME_URL`. The `host` in the connection's auth header is the matching HTTP host: `appsync-realtime-api` replaced by `appsync-api`.
- **Authorizer:** a Lambda ([realtime-authorizer.ts](../apps/api/src/realtime-authorizer.ts)) checks the token with Better Auth on connect, and active membership of the trip on subscribe. Clients can't publish. Results aren't cached, so a removed member can't subscribe again; an open subscription keeps getting "changed" events, but the refetch fails.

## Monitoring

Problems in production reach one Telegram chat, never email: CloudWatch alarms for the AWS side and Sentry alerts for errors in the app and the API. Both post through the same bot ([notify/telegram.ts](../apps/api/src/notify/telegram.ts)), which later features can reuse. Everything is optional: until the secrets below exist, nothing is sent and the senders log a warning.

### Alarms (CloudWatch)

Production only ([monitoring.ts](../infra/app/monitoring.ts)); dev has the topic and notifier but no alarms. Each alarm looks at one 5-minute window, treats no data (no traffic) as healthy, and notifies the `Alerts` SNS topic when it goes to ALARM and when it goes back to OK. CloudWatch never repeats a notification while an alarm stays in ALARM. The `AlertsNotifier` Lambda ([alarm-notifier.ts](../apps/api/src/alarm-notifier.ts)) posts each change with the stage, state, reason and a CloudWatch console link.

| Alarm                                         | Metric                             | Fires at                               |
| --------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `yallist-production-ApiErrors`                | API Lambda `Errors` (sum)          | 3 or more in 5 minutes                 |
| `yallist-production-ApiThrottles`             | API Lambda `Throttles` (sum)       | 1 or more in 5 minutes                 |
| `yallist-production-ApiDuration`              | API Lambda `Duration` (maximum)    | 16 s or more (80% of the 20 s timeout) |
| `yallist-production-Api5xx`                   | API Gateway `5xx` (sum)            | 5 or more in 5 minutes                 |
| `yallist-production-RealtimeAuthorizerErrors` | Realtime authorizer `Errors` (sum) | 3 or more in 5 minutes                 |

Cost: about $0.50 a month (5 standard alarms at $0.10); SNS and the notifier stay in the free tier.

### Errors (Sentry)

Two Sentry projects, both on the free plan: `yallist-app` (web and Android, [src/lib/sentry.ts](../apps/mobile/src/lib/sentry.ts)) and `yallist-api` ([src/sentry.ts](../apps/api/src/sentry.ts)).

- **Releases:** release `yallist@<version>` (the release tag), dist the git SHA, environment the stage (`dev`, `production`).
- **Sampling:** every error; 5% of app traces; no API traces (the duration alarm covers latency).
- **Personal data:** none is sent. `sendDefaultPii` is off, and every event and breadcrumb goes through [scrubEvent](../packages/domain/src/scrub.ts), which drops the user, cookies and headers and replaces tokens, emails, Israeli phone numbers and all Hebrew text (names, trip and item titles) in every string except stack traces.
- **Inert without a DSN:** local dev, unit tests and the UI tests build without one, so Sentry never loads.
- **Web:** loads Sentry's prebuilt browser bundle (`browser.sentry-cdn.com`, pinned by version and SHA-384) after the app starts, so the app's own bundle grows by about 1 KB gzipped. Errors in the first moments, before it loads, are missed.
- **API:** the light Node SDK (no OpenTelemetry): unhandled errors, tagged with the route pattern, are sent before the Lambda answers 500.
- **Source maps:** uploaded only when `SENTRY_AUTH_TOKEN` is set. deploy.yml uploads the web export's (`export:web:release`, which deletes them before the site is deployed) and the API bundle's (a `postbuild` hook in [core.ts](../infra/app/core.ts)); android.yml uploads the APK's (Sentry's Gradle step, for manual runs only).
- **Alerts:** Sentry calls `POST <api>/webhooks/sentry` ([sentry-webhook.ts](../apps/api/src/routes/sentry-webhook.ts)) when an alert rule fires. The API checks the `Sentry-Hook-Signature` HMAC with the integration's client secret and forwards issue alerts (`event_alert`) and metric alerts (`metric_alert`) to Telegram; it ignores other webhooks. Without the secret the endpoint answers 404.

### Muting

- **For a while:** mute the chat in Telegram (1 hour, 8 hours, …). Alerts keep arriving silently.
- **One Sentry alert:** edit or disable the alert rule in Sentry, or archive (ignore) the issue.
- **One CloudWatch alarm, for good:** change its threshold in [monitoring.ts](../infra/app/monitoring.ts), or remove it. Don't edit alarms in the console: the next deploy would undo it, and everything in AWS is defined in SST.
- **Emergency:** `aws cloudwatch disable-alarm-actions --alarm-names <name> --profile yallist-prod --region eu-central-1` silences one alarm until `enable-alarm-actions`. It's drift from the SST code, so turn it back on soon.
- **Everything:** delete the `TELEGRAM_CHAT_ID` secret; the next deploy stops all messages.

### Setup checklist

Secret values go only into the `gh secret set` prompts (they read from stdin, so nothing lands in shell history); never paste them in chat, issues or commits. Each step takes effect on the next deploy from `main`.

| GitHub (environment `production`, and `dev` if wanted) | Kind     | Becomes                          |
| ------------------------------------------------------ | -------- | -------------------------------- |
| `TELEGRAM_BOT_TOKEN`                                   | secret   | SST secret `TelegramBotToken`    |
| `TELEGRAM_CHAT_ID`                                     | secret   | SST secret `TelegramChatId`      |
| `SENTRY_DSN` (the `yallist-api` DSN)                   | secret   | SST secret `SentryDsn`           |
| `SENTRY_WEBHOOK_SECRET`                                | secret   | SST secret `SentryWebhookSecret` |
| `SENTRY_AUTH_TOKEN`                                    | secret   | source map uploads               |
| `EXPO_PUBLIC_SENTRY_DSN` (the `yallist-app` DSN)       | variable | the web and Android builds       |
| `SENTRY_ORG` (repository variable)                     | variable | source map uploads               |

1. **Telegram bot.** In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`, pick a name and a username ending in `bot`. It replies with the bot token.
2. **Chat id.** Send your new bot any message (or add it to a group and post there). Then, locally:

   ```sh
   read -rs TOKEN   # paste the bot token; it isn't echoed
   curl -s "https://api.telegram.org/bot$TOKEN/getUpdates" | jq '.result[].message.chat | {id, type, title}'
   unset TOKEN
   ```

   The `id` is the chat id (negative for groups).

3. **Telegram secrets:**

   ```sh
   gh secret set TELEGRAM_BOT_TOKEN --env production   # paste the token at the prompt
   gh secret set TELEGRAM_CHAT_ID --env production     # paste the chat id
   # optional, for dev's notifier and webhook: the same two with --env dev
   ```

4. **Sentry org and projects.** Sign up at [sentry.io](https://sentry.io) (Developer plan, free) and create an organization. Create two projects: `yallist-app` (platform React Native) and `yallist-api` (platform Node.js). Skip the setup wizards; the code is in place. Each project's DSN is under **Project Settings → Client Keys (DSN)**.

   ```sh
   gh variable set SENTRY_ORG --body <org slug>                                # the org's URL name
   gh variable set EXPO_PUBLIC_SENTRY_DSN --env production --body '<yallist-app DSN>'   # public: it ships in the app
   gh secret set SENTRY_DSN --env production                                   # paste the yallist-api DSN
   # optional, to see dev's errors too: the same EXPO_PUBLIC_SENTRY_DSN and SENTRY_DSN with --env dev
   ```

5. **Auth token for source maps.** **Settings → Developer Settings → Organization Tokens → Create New Token** (organization tokens can only upload source maps and releases).

   ```sh
   gh secret set SENTRY_AUTH_TOKEN --env production   # paste the token
   gh secret set SENTRY_AUTH_TOKEN --env dev          # dev deploys upload too, and android.yml runs in either
   ```

6. **Webhook to Telegram.** **Settings → Developer Settings → Custom Integrations → Create New Integration → Internal Integration**:
   - Name: `Telegram`.
   - Webhook URL: production's `api` output plus `/webhooks/sentry`, e.g. `https://<id>.execute-api.eu-central-1.amazonaws.com/webhooks/sentry` (the URL is on the summary of the last Deploy run).
   - **Alert Rule Action:** on. Permissions: leave all at No Access. Webhooks: subscribe to none.
   - Save, then copy the **Client Secret**:

   ```sh
   gh secret set SENTRY_WEBHOOK_SECRET --env production   # paste the client secret
   ```

7. **Alert rules.** After the deploy with `SENTRY_WEBHOOK_SECRET`, in each project, **Alerts → Create Alert → Issues**, three rules, each with environment `production`, action **Send a notification via Telegram** (the integration) and action interval **1 day**:
   - **New issue:** when "A new issue is created".
   - **Regression:** when "The issue changes state from resolved to unresolved".
   - **Spike:** when "Number of events in an issue is more than 50 in 1 hour".

   Use **Send Test Notification** in the rule editor to check the chain. Then turn off Sentry's email: delete the default "high priority issues" rule each project was created with, and under **User Settings → Notifications** set issue alerts and workflow to off (or to Slack/none).

8. **Check the alarms.** After the next production deploy, send one alarm through the chain; CloudWatch puts it back to OK within 5 minutes, so you get both messages:

   ```sh
   aws cloudwatch set-alarm-state --alarm-name yallist-production-ApiThrottles \
     --state-value ALARM --state-reason 'Testing the Telegram alerts' \
     --profile yallist-prod --region eu-central-1
   ```

## Naming and tags

Every resource has the stage in its name or identifier, so dev and production never collide and are easy to tell apart in the console:

- **Named resources** (S3 bucket, CloudFront functions, CloudFront key-value store) are named `yallist-<stage>-<name>-<hash>` by SST, for example `yallist-dev-webassetsbucket-abcdefgh`.
- **The CloudFront distribution** has no name; its comment is set to `yallist-<stage>-web`.
- **The DSQL cluster** has no name; its `Name` tag is `yallist-<stage>-database`.
- **The AppSync Events API** is named `yallist-<stage>-realtime`.
- **Tags:** every resource that supports tags is tagged `app=yallist` and `stage=<stage>` (`stage=global` for `infra/global`), through the AWS provider's default tags. SST also adds its own `sst:app` and `sst:stage` tags. That includes IAM roles, the OIDC provider, the budget and the Lambda log groups, which SST creates explicitly (30-day retention) rather than leaving Lambda to create them untagged.
  - **Not taggable** (AWS has no tags for them; the stage is in the name or parent): CloudFront functions and key-value stores, API Gateway routes and integrations, Lambda permissions, IAM role policies and attachments, and the S3 bucket policy.
  - **Not ours to tag:** SST's per-region bootstrap, created by the SST CLI rather than these configs and shared by every stage in the region: the `sst-state-*` and `sst-asset-*` buckets, the `sst-asset` ECR repository and the `/sst/bootstrap` and `/sst/passphrase/*` SSM parameters.

## PR previews

Every PR from a branch of this repo (not a fork) gets a live environment at `https://<router>/pr-<n>/`, posted as a PR comment. It's removed when the PR closes, or 6 hours after its last push. The design and its trade-offs are in [e2e-live-environments.md](plans/e2e-live-environments.md).

- **`preview` stage** ([preview-stage.yml](../.github/workflows/preview-stage.yml), from `main`, admin role): a CloudFront Router and an HTTP API that every PR shares, with their ids in the SSM parameter `/yallist/preview/outputs`. Nothing answers outside a PR's prefix.
- **`pr-<n>` stage** ([preview.yml](../.github/workflows/preview.yml), on every push, preview role): the API Lambda behind `ANY /pr-<n>/{proxy+}` on the shared API, the web export under `/pr-<n>` on the Router (`BASE_PATH`, [app.config.ts](../apps/mobile/app.config.ts)), and its own DSQL cluster, realtime API and receipts bucket. The API serves itself under the path of its URL ([app.ts](../apps/api/src/app.ts) `withBasePath`). Guests only: no Google client. No alarms or Telegram notifier, and the Telegram and Sentry secrets keep their `unset` placeholder, so a preview reports nothing.
- **After the deploy:** migrations, a `/health` and site smoke check, the sticky comment, then the Maestro flows against the URL (`E2E_WEB_URL`, [e2e-web.sh](../scripts/e2e-web.sh)). To run them yourself: `E2E_WEB_URL=https://<router>/pr-<n>/ scripts/e2e-web.sh`.
- **Removal** ([preview-remove.sh](../scripts/preview-remove.sh)): `sst remove --stage pr-<n>`, which is the whole teardown, then the stage's SST passphrase is deleted. The job fails if anything tagged `stage=pr-<n>` is left.
- **Cleanup** ([preview-cleanup.yml](../.github/workflows/preview-cleanup.yml), hourly or by hand, preview role): finds every deployed `pr-*` stage by its tags ([preview-stale.sh](../scripts/preview-stale.sh)) and removes those whose PR is closed, merged or gone, or whose Lambda's `expires-at` tag has passed. Each removal waits in the PR's concurrency group, so it never races the PR's own deploy or remove, and the run's summary lists what it removed. It fails on any stage a closed PR left behind.
- **Preview role** (`yallist-global-github-preview`): only this repo's `preview`-environment jobs can assume it ([infra/global/preview.ts](../infra/global/preview.ts)), and only in `us-west-2`. It can only touch `yallist-pr-*` resources. Every role a PR stage creates gets the `yallist-preview-workload-boundary`, which limits it to its own stage. The admin deploy role is unchanged.
- **Locally:** `E2E_BASE_PATH=/pr-123 scripts/e2e-web.sh` runs the flows against a build served under a prefix, as a preview is.

### Set up

These steps happen once, in this order. Each step needs the ones before it.

1. **Merge the infra PR.** `deploy.yml` then deploys `global` with the preview role, boundary and budget. Then point the workflow at the role:
   ```sh
   gh variable set AWS_PREVIEW_ROLE_ARN -R nadavgihasi/yallist \
     --body arn:aws:iam::007742375034:role/yallist-global-github-preview
   ```
2. **Create the `preview` environment.** It has no branch restriction, because PR branches deploy, and one secret:
   ```sh
   gh api -X PUT repos/nadavgihasi/yallist/environments/preview
   gh secret set BETTER_AUTH_SECRET --env preview -R nadavgihasi/yallist --body "$(openssl rand -base64 32)"
   ```
3. **Merge the workflows PR.** `preview-stage.yml` then deploys the `preview` stage with the admin role. A new CloudFront distribution takes up to about 15 minutes. If the workflow didn't start, run it by hand:
   ```sh
   gh workflow run preview-stage.yml -R nadavgihasi/yallist
   ```
4. **Push to any PR.** Its preview comment appears after about 5 minutes.

There's no user allowlist, no fork-approval setting and no `actor_id` in the OIDC subject: only collaborators can push branches here, and fork PRs get no secrets or OIDC token. Revisit when adding collaborators.

If the first PR's preview fails with a 403 creating an SST bucket, it raced the one-time `preview-stage.yml` bootstrap of SST in `us-west-2` (the preview role can't create those buckets). Re-run it once that workflow has finished.

When the preview role is denied something, CloudTrail in `us-west-2` names the action. Add it to `GithubPreviewPolicy` in [infra/global/preview.ts](../infra/global/preview.ts), and to the boundary if a PR's Lambda needs it.

## Remove dev

```sh
pnpm sst remove --stage dev
```

This deletes every dev resource, bucket contents included. Production is protected: `sst remove --stage production` refuses to run. To tear it down on purpose, set `protect: false` first.
