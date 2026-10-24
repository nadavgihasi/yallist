# yallist

An app that helps friends plan and organize trips together: a shared bring list, a shared buy list, and a cost split. Hebrew and RTL first.

Working name — not final. Start with [docs/](docs/README.md):

- [Product spec](docs/SPEC.md)
- [Tech decisions](docs/tech-decisions.md)
- [Design mockups](docs/design/README.md)
- [Implementation plans](docs/plans/README.md)

## Run it

Requires Node 22+ and pnpm 10.

```sh
pnpm install
# The API on http://localhost:3000, against a local Postgres (migrated on start):
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm --filter @yallist/api dev
pnpm --filter mobile web   # opens the web app at http://localhost:8081, using that API
```

For Google sign-in locally, set `GOOGLE_CLIENT_ID` for the API and `EXPO_PUBLIC_GOOGLE_CLIENT_ID` for the app to the dev OAuth client ID (`infra/app/sst.config.ts`).

Checks: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`.
