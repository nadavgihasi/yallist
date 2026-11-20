---
name: new-milestone
description: Plan, design, build and review a new Yallist milestone end to end: research (code, competitors, customers), a plan artifact with one brief per task, mockups on a design canvas, one branch and PR per task with before/after screenshots, QA and UI/UX review agents, a competitor comparison page with screenshots, and the next phases written into docs/plans/roadmap.md. Use this whenever the user wants to start, plan, scope, design or run a new milestone, batch, phase or "next set of features" for Yallist, asks "what's left" on a plan, wants to compare a part of the app with a competitor (Splitwise, Tricount, a list app), or asks for review agents, mockups or a plan page for upcoming work, even if they don't say "milestone".
---

# New milestone

A milestone is a set of related tasks that ship together and change one part of the product (money, lists, trips). This skill is the loop that took the money parity milestone from a research question to a merged-ready PR. Follow it in order, but move at the user's pace: they approve each stage, and often redirect it.

Read `CLAUDE.md` first. Its rules on branches, checks, DSQL migrations and older Android builds override anything here.

## The stages

| #   | Stage    | What you produce                                                                                      | The user decides              |
| --- | -------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Ground   | A short "where things stand" from the code, roadmap and open PRs                                      | Scope                         |
| 2   | Research | Findings from code, and from competitor and customer research when the milestone is about catching up | What's in                     |
| 3   | Plan     | A plan artifact: tasks with why, today, build, done-when, in batches                                  | Order, batches                |
| 4   | Design   | Mockups on a design canvas, one artboard per screen state                                             | Changes before code           |
| 5   | Build    | One branch and PR per task, with tests and before/after screenshots                                   | Merges                        |
| 6   | Review   | QA and UI/UX agents against a local build; bugs fixed, UX options shown as now vs proposed            | Which UX changes              |
| 7   | Compare  | A comparison page with screenshots (product, UI/UX, customer agents)                                  | What goes in this PR vs later |
| 8   | Close    | Roadmap "next" phases, superseded PRs closed, conflicts and CI fixed                                  | Merge                         |

Stages 2, 6 and 7 use subagents. Only start agents when the user asks for them (this skill counts as asking once the user has invoked it for that stage). Brief each agent completely: it starts with none of this conversation. The briefs that worked are in `references/agent-briefs.md`.

## 1. Ground

- Fetch `origin/main` and read `docs/plans/roadmap.md`, `docs/fix-list.md`, `docs/research/`, and the code the milestone touches.
- List open PRs and note any that touch the same files.
- Write the user a short status: what exists, what's partial, what's missing. Use a table if there are more than a few items.

## 2. Research

- **Code first.** Know the data model, routes, app screens and Hebrew strings involved before proposing anything.
- **Competitor and customer research** when the milestone is "be as good as X": three agents in parallel (product, UI/UX, customer), with briefs from `references/agent-briefs.md`. They use public sources only: store listings, help centres, reviews, forums. They never sign in to a competitor, and they say which claims they verified on a page and which come from memory.
- Merge their reports into gaps (they have, we don't), differences (we do it differently: keep, align or discuss), and where we're ahead.

## 3. Plan artifact

Build the plan as an Artifact page (a plain page, see `references/artifacts.md`), English, with:

- **Shared context**: where things stand, where the code lives, the conventions (agorot, Hebrew RTL strings in `he.ts`, theme tokens, DSQL limits, tests), and what is left out on purpose.
- **Batches and order**, with the dependencies between tasks spelled out.
- **One brief per task**, with an id (M1, M2…) and these parts: Why, Today, Build, Done when. Add a "Copy brief" button that copies the brief plus the shared context, so another session can take one task alone.
- **Left out on purpose**, with the reason for each.

Ask which task or batch to start with. Answer "what's left?" from the plan, as a table.

## 4. Design

Before code for anything visual, put mockups on a Design canvas artifact (`references/artifacts.md`).

- Use the app's real tokens from `apps/mobile/src/theme/index.ts`. The design-system artifact can lag behind; say so if it does.
- Use sample data that adds up: shares sum to totals, balances sum to zero. The user will check the numbers.
- Make one artboard per screen state (owe, owed, settled; empty; a sheet open), with a sticky note for assumptions.
- When the user changes direction ("no confirmation for payments"), update the mockups first, then build.

## 5. Build

One task, one branch, one PR, opened ready for review. `references/pr-checklist.md` has the full checklist. In short:

- Branch from `origin/main`. Stack a task on the previous task's branch only when it changes the same screens, and set the PR's base to that branch so the diff stays small. Say it's stacked in the PR body.
- Tests go next to the code: domain rules in `packages/domain`, API tests against Postgres (they skip silently without it), and app logic as pure functions with Vitest.
- Run all four checks and look at their exit codes, not their quiet output.
- Take before/after screenshots from a local build (`scripts/`), look at them yourself, and fix what you see before pushing. Push the images to the `screenshots` branch and embed them in the PR body.
- Subscribe to the PR and fix CI until it's green. A failure that is also red on `main` gets one comment saying so, plus the smallest fix carried in the PR.
- If the user wants one PR instead of a stack, retarget the top PR to `main`, merge `main` in, rewrite its description to cover everything, and close the others once they say so.

## 6. Review

When the user asks for review agents, start a local build and two agents with the briefs in `references/agent-briefs.md`:

- **QA**: wrong amounts, permissions, double taps, stale screens, RTL text, layout at 390px. Confirmed bugs with steps, separate from suspicions.
- **UI/UX**: a prioritised list (must / should / nice) against the design system, each with a concrete fix and a screenshot.

Then:

1. Fix the clear bugs in the PR right away, and verify the important ones in a browser (for example, a double-tap script that counts payments).
2. Bring the UX items that change product behaviour to the user as a short numbered list. If they find it hard to judge, add a "now vs proposed" row to the design canvas: the real screenshot next to a mockup of the change.
3. Build the ones they pick, screenshot them, and send the images.

## 7. Compare

When the user wants to "be like" a competitor, start three agents (product, UI/UX, customer) and turn their reports into a comparison page (`references/artifacts.md`):

- Screen-by-screen pairs (our screenshot, theirs from public store or help pages), each with what they do, what we do, which is clearer, and a suggestion.
- A table of gaps (relevance for group trips in Israel, effort, Pro-only or left out on purpose).
- "Where we do it differently: let's talk" cards, each with a recommendation and a question.
- Where we're ahead, real user quotes with links, and a recommended next batch in order.

Then give your own suggestions, split into (a) improvements to what this milestone already built, to add to the open PR, and (b) next phases. Answer your own open questions with a recommendation instead of asking each one.

## 8. Close

- Write the next phases into `docs/plans/roadmap.md` as a table with Phase, Status, Scope, Why, Depends and Size. Record the decisions made, and update the status of rows the milestone finished.
- Merge `main` into the PR when it moves. Resolve conflicts by keeping both sides' intent. Re-run everything, because new tests on main often catch the milestone (the cache fingerprint, the `USER_COLUMNS`/`deleteTrip` coverage tests).
- Close the PRs the consolidated PR supersedes, when the user says so, and unsubscribe from them.
- End with a summary: what shipped, which PRs, what's left and where it's written down.

## Working with the user

- They write short messages, sometimes in Hebrew. Answer in English unless they write Hebrew to you, and keep UI copy in Hebrew.
- Before anything big, give a recommendation, not a menu. When they say "do all of them", do all of them.
- Show, don't describe: screenshots of real screens, and mockups for what doesn't exist yet. Send the images (SendUserFile) rather than only linking them.
- Keep them posted in one line while long builds run, and don't claim a result before you've seen it.

## Reference files

- `references/agent-briefs.md`: the briefs for research, review and comparison agents.
- `references/artifacts.md`: the plan page, the design canvas, the now-vs-proposed rows and the comparison page.
- `references/pr-checklist.md`: branch and PR rules, checks, screenshots, CI, and the pitfalls hit last time.
- `references/example-money-batch-2.md`: the money parity milestone as a worked example, with the actual sequence and outcomes.
- `scripts/serve-stack.sh`, `scripts/serve.mjs`, `scripts/shots-common.cjs`: a local API and web build plus Playwright helpers for screenshots and review agents.
