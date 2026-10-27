# Plans

One file per phase from the [SPEC build plan](../SPEC.md#11-build-plan), adapted to [tech-decisions.md](../tech-decisions.md).

- Each phase lands as one or a few small PRs, each on its own branch. Nothing is committed directly to `main`.
- Update the plan file when the approach changes during implementation, so it reflects what was actually built.

| Phase           | Plan                                                                           | Status                                  |
| --------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| 0 — Foundation  | [phase-0-foundation.md](phase-0-foundation.md)                                 | Done                                    |
| 1 — Backend     | [phase-1-backend.md](phase-1-backend.md)                                       | Done                                    |
| PR previews     | [e2e-live-environments.md](e2e-live-environments.md)                           | Built                                   |
| Remote pipeline | [remote-feature-pipeline.md](remote-feature-pipeline.md)                       | Design                                  |
| UI tests        | [ui-tests.md](ui-tests.md)                                                     | Web and previews; native planned        |
| Email sign-in   | [email-signup.md](email-signup.md)                                             | Design; deferred, blocked on the domain |
| UI plan         | [ui-plan.md](../design/plans/ui-plan.md)                                       | PRs 1–4 done                            |
| Packing spec    | [PACKING_SHOPPING_SPEC.md](../specs/packing-shopping/PACKING_SHOPPING_SPEC.md) | Steps 1, 3 done; 2, 4 in progress       |
| 2+ — Roadmap    | [roadmap.md](roadmap.md)                                                       | Updated 2026-10-27                      |
