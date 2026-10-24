# Deploying

Infrastructure is [SST](https://sst.dev), in two SST apps. Both live in the `@yallist/infra` workspace package under [infra/](../infra), which owns the `sst` dependency and the deploy scripts; the root `pnpm deploy:*` and `pnpm sst` scripts delegate to it.

- **App** ([infra/app/sst.config.ts](../infra/app/sst.config.ts)): the API, its database and the Expo web export. Stages `dev` and `production`.
- **Global** ([infra/global/sst.config.ts](../infra/global/sst.config.ts)): account-wide resources in `eu-central-1`. These are the $10/month budget, which emails `BUDGET_EMAIL` at 80% actual and 100% forecasted spend, and the IAM role GitHub Actions deploys with. One stage, `global`, protected.

## Deploys come from `main`

[deploy.yml](../.github/workflows/deploy.yml) runs on every push to `main`. It deploys `global`, then `dev`, then `production`, each in the GitHub environment of the same name. Those environments only accept the `main` branch.

- **Credentials:** jobs get them through GitHub OIDC. They assume the role in the repo variable `AWS_DEPLOY_ROLE_ARN`, so no AWS keys are stored in GitHub.
- **Laptops:** don't deploy from a laptop except for the one-time bootstrap below or an emergency.

### One-time bootstrap

The deploy role is created by the global stack, so the first global deploy runs locally:

```sh
BUDGET_EMAIL=$(gh variable get BUDGET_EMAIL) pnpm deploy:global
gh variable set AWS_DEPLOY_ROLE_ARN --body <deployRoleArn from the output>
```

After that, the `yallist-dev` access key is only needed for emergencies. Consider deactivating it in IAM.

## Stages

There are exactly two stages. Any other `--stage` fails before touching AWS.

| Stage        | Region         | Command            | AWS profile    | On `sst remove`                        |
| ------------ | -------------- | ------------------ | -------------- | -------------------------------------- |
| `dev`        | `us-east-2`    | `pnpm deploy:dev`  | `yallist-dev`  | Everything is deleted.                 |
| `production` | `eu-central-1` | `pnpm deploy:prod` | `yallist-prod` | Refused (`protect`). Buckets retained. |

The profile and region are set per stage in `infra/app/sst.config.ts`, not in the scripts. In CI (`CI=true`) no profile is used. That way every `sst` command (`deploy`, `diff`, `remove`) picks the right credentials without an `AWS_PROFILE=` prefix.

Every `sst` command needs `--stage dev` or `--stage production`, including `pnpm sst install`. From the repo root, `pnpm sst <args>` runs `sst <args>` against the app. SST's default personal stage (your username) is rejected.

## Prerequisites

Two AWS CLI profiles backed by IAM user access keys. Both use the same AWS account for now:

```sh
aws configure --profile yallist-dev    # access key, secret, region eu-central-1
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

[apps/api](../apps/api) is a [Hono](https://hono.dev) app. One Lambda serves every path behind an API Gateway HTTP API (`$default` route).

- **URL:** the `api` output of `sst deploy`. The web build gets it as `EXPO_PUBLIC_API_URL` ([src/lib/api.ts](../apps/mobile/src/lib/api.ts)).
- **Health check:** `curl $API/health` returns `{"ok":true}`.
- **CORS:** any origin. Auth uses bearer tokens, not cookies, so there is nothing for another origin to ride on.

## Database

Aurora DSQL, one cluster per stage (`sst.aws.Dsql('Database')`), available in both stage regions. It is linked to the API Lambda, which connects as `admin` with a short-lived IAM auth token ([client.ts](../apps/api/src/db/client.ts)). There is no password to store.

- **Schema:** [schema.ts](../apps/api/src/db/schema.ts), Drizzle, kept to DSQL's SQL subset: no enum types (text plus `CHECK`), no triggers or extensions, UUID keys, money in integer agorot. Foreign keys are enforced; they use `NO ACTION` because cascades count toward the 3,000-rows-per-transaction limit.
- **Migrations:** after changing the schema, run `pnpm --filter @yallist/api db:generate` and commit the new file in `apps/api/drizzle/`. Never edit a migration that has been deployed.
- **Runner:** [migrate.ts](../apps/api/src/db/migrate.ts) runs each statement in its own transaction (DSQL allows one DDL per transaction) and records it in `__migrations`, so a failed run resumes where it stopped. For DSQL it rewrites `CREATE INDEX` to `CREATE INDEX ASYNC` and adds `ALTER TABLE` constraints as `NOT VALID`. It then reloads `template_items` from `@yallist/domain` TEMPLATES.
- **Deploys:** [deploy.yml](../.github/workflows/deploy.yml) runs the migrations after each stage deploys: `pnpm sst shell --stage <stage> -- pnpm --filter @yallist/api db:migrate`.
- **Local and tests:** with `DATABASE_URL` set, everything uses plain Postgres instead (DSQL has no emulator). The API tests migrate a throwaway database and skip without `DATABASE_URL`; CI provides a `postgres:17` service.

```sh
docker run -d --rm --name yallist-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
pnpm test
```

## Naming and tags

Every resource has the stage in its name or identifier, so dev and production never collide and are easy to tell apart in the console:

- **Named resources** (S3 bucket, CloudFront functions, CloudFront key-value store) are named `yallist-<stage>-<name>-<hash>` by SST, for example `yallist-dev-webassetsbucket-abcdefgh`.
- **The CloudFront distribution** has no name; its comment is set to `yallist-<stage>-web`.
- **The DSQL cluster** has no name; its `Name` tag is `yallist-<stage>-database`.
- **Tags:** every resource is tagged `app=yallist` and `stage=<stage>`, through the AWS provider's default tags. SST also adds its own `sst:app` and `sst:stage` tags.

## Remove dev

```sh
pnpm sst remove --stage dev
```

This deletes every dev resource, bucket contents included. Production is protected: `sst remove --stage production` refuses to run. To tear it down on purpose, set `protect: false` first.
