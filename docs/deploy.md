# Deploying the web app

Infrastructure is [SST](https://sst.dev) in `eu-central-1`, defined in [sst.config.ts](../sst.config.ts). Today it's one static site: the Expo web export on S3 + CloudFront.

## Stages

There are exactly two stages. Any other `--stage` fails before touching AWS.

| Stage        | Command            | AWS profile    | On `sst remove`                        |
| ------------ | ------------------ | -------------- | -------------------------------------- |
| `dev`        | `pnpm deploy:dev`  | `yallist-dev`  | Everything is deleted.                 |
| `production` | `pnpm deploy:prod` | `yallist-prod` | Refused (`protect`). Buckets retained. |

The profile is set per stage in `sst.config.ts`, not in the scripts. That way every `sst` command (`deploy`, `diff`, `remove`) picks the right credentials without an `AWS_PROFILE=` prefix.

Every `sst` command needs `--stage dev` or `--stage production`, including `pnpm sst install`. SST's default personal stage (your username) is rejected.

## Prerequisites

Two AWS CLI profiles backed by IAM user access keys. Both use the same AWS account for now:

```sh
aws configure --profile yallist-dev    # access key, secret, region eu-central-1
aws configure --profile yallist-prod   # same keys for now
```

To move production to its own account or IAM user later, point the `yallist-prod` profile at the new credentials. No code change is needed.

## Deploy

```sh
pnpm deploy:dev    # dev
pnpm deploy:prod   # production
```

This builds `apps/mobile` with `expo export -p web` and uploads `dist/`. The command prints the CloudFront URL.

## Naming and tags

Every resource has the stage in its name or identifier, so dev and production never collide and are easy to tell apart in the console:

- **Named resources** (S3 bucket, CloudFront functions, CloudFront key-value store) are named `yallist-<stage>-<name>-<hash>` by SST, for example `yallist-dev-webassetsbucket-abcdefgh`.
- **The CloudFront distribution** has no name; its comment is set to `yallist-<stage>-web`.
- **Tags:** every resource is tagged `app=yallist` and `stage=<stage>`, through the AWS provider's default tags. SST also adds its own `sst:app` and `sst:stage` tags.

## Remove dev

```sh
pnpm sst remove --stage dev
```

This deletes every dev resource, bucket contents included. Production is protected: `sst remove --stage production` refuses to run. To tear it down on purpose, set `protect: false` first.
