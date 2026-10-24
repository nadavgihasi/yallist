# Deploying the web app

Infrastructure is [SST](https://sst.dev) in `eu-central-1`, defined in [sst.config.ts](../sst.config.ts). Today it's one static site: the Expo web export on S3 + CloudFront.

## Prerequisites

An AWS SSO profile named `yallist-dev` (`aws configure sso`). Sign in when the session expires:

```sh
aws sso login --profile yallist-dev
```

## Deploy

```sh
AWS_PROFILE=yallist-dev pnpm deploy:dev
```

This builds `apps/mobile` with `expo export -p web` and uploads `dist/`. The command prints the CloudFront URL. Stages other than `production` are removed with `sst remove --stage <stage>`; `production` is protected and retained.
