# Versioning and releases

Every push to `main` is a potential release. The `version` job in [deploy.yml](../.github/workflows/deploy.yml) runs [scripts/release.sh](../scripts/release.sh), which reads the commit titles (squash-merged PR titles) since the last `vX.Y.Z` tag:

| Since the last tag                                | Next version             |
| ------------------------------------------------- | ------------------------ |
| `type!:` title or `BREAKING CHANGE:` in a body    | major (minor before 1.0) |
| a `feat:` title                                   | minor                    |
| a `fix:` or `perf:` title                         | patch                    |
| nothing else (`chore`, `docs`, `ci`, `refactor`…) | no release, same version |

The `version` job only computes the number, for the builds. After production deploys, the `release` job runs `release.sh --publish`: on a bump it tags `main` and creates a GitHub release with generated notes (the merged PRs). The first run, with no tag yet, releases `v0.1.0`. So PR titles must follow Conventional Commits; they decide the version.

## Where the version goes

- **Web:** the `dev` and `production` deploys get it as `APP_VERSION`. [app.config.ts](../apps/mobile/app.config.ts) puts it into the Expo config.
- **Android:** [android.yml](../.github/workflows/android.yml) uses the latest tag as `versionName`; `versionCode` stays the run number.
- **In the app:** the home and login screens show `גרסה X.Y.Z · <short sha>`, plus `· dev` on the dev stage. Local builds show `0.0.0-dev · dev`.

A failed deploy creates no release. The next successful push to `main` releases its commits together with the failed one's, so the version may bump once for both.
