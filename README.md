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
pnpm --filter mobile web   # opens the web app at http://localhost:8081
```

The current web MVP is local-only: everything is saved in the browser. Tap "טיול לדוגמה" on the empty home screen to see a filled-in trip.

Checks: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`.
