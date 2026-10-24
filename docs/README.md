# Docs

| Doc                                    | What it is                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| [SPEC.md](SPEC.md)                     | Product spec: behavior, data model, domain rules, screens, design system, build plan.       |
| [tech-decisions.md](tech-decisions.md) | Stack and infrastructure choices, plus how the SPEC's Supabase-based parts were overridden. |
| [design/](design/README.md)            | Design system v2 (tokens, brand, reference screens) and the superseded v1 mockups.          |
| [plans/](plans/README.md)              | Implementation plans, one per phase.                                                        |
| [releases.md](releases.md)             | Versioning: release tags made from commit titles on every push to main.                     |

## Which one wins

- **Behavior, data, domain rules:** SPEC.md.
- **Tech stack, infrastructure, security enforcement, realtime/notification plumbing:** tech-decisions.md.
- **Layout, copy, colors, spacing:** design system v2 in `design/`; v1 mockups in `design/v1/screens/` for copy.

If two docs disagree on something not covered above, ask before deciding.
