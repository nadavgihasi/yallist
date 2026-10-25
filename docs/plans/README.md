# Plans

One file per phase from the [SPEC build plan](../SPEC.md#11-build-plan), adapted to [tech-decisions.md](../tech-decisions.md).

- Each phase lands as one or a few small PRs, each on its own branch. Nothing is committed directly to `main`.
- Update the plan file when the approach changes during implementation, so it reflects what was actually built.

| Phase          | Plan                                                 | Status |
| -------------- | ---------------------------------------------------- | ------ |
| 0 — Foundation | [phase-0-foundation.md](phase-0-foundation.md)       | Done   |
| 1 — Backend    | [phase-1-backend.md](phase-1-backend.md)             | Done   |
| Live e2e tests | [e2e-live-environments.md](e2e-live-environments.md) | Design |
| UI tests       | [ui-tests.md](ui-tests.md)                           | Web    |
| 2+ — Roadmap   | [roadmap.md](roadmap.md)                             | Draft  |
