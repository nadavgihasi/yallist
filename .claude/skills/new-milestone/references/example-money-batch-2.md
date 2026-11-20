# Worked example: the money parity milestone (November 2026)

How the money milestone actually went, as a model for the next one.

## 1. Research and plan

- **Research:** a review of the money code against Splitwise produced the **Money Parity Plan** artifact. It has ten tasks in three batches:
  - Batch 1 · Money, finished: M1 edit an expense, M2 settle up that pays, M4 the expense screen.
  - Batch 2 · Fair and clear: M3 uneven splits, M5 balances with the reason, M8 a calmer money tab, M9 faster add-expense.
  - Batch 3 · Alive: M6 reminders, M7 history, M10 trip totals and export.

  Each task had Why / Today / Build / Done when, and a copy button.

- **Batch 1:** one PR per task (#186, #189, #190). The user merged #186, asked for screenshots on the other two, then asked to "fix conflicts" after main moved.
- **"What's left?":** answered from the plan, as two tables (batch 2 and batch 3), with the suggested order.

## 2. Design

- **Mockups:** a Design canvas, "Money Batch 2 Mockups", with seven phone artboards:
  - settling up
  - my number in three states
  - one person's balance
  - the expense log by day
  - add expense, by weight, and in parts

  The sample trip added up exactly: 4 people, ₪2,620. The canvas used the app's v3 tokens because the design-system artifact was older.

- **Change of direction:** the user's change ("payments don't need confirmation; anyone can record that someone paid") went into the mockups first, including a new "record a payment" artboard, and then into code.

## 3. Build

- **Branches:** one branch and PR per phase.
  - #217: payments without confirmation (new `payments.created_by`, the confirm route removed, any member can delete).
  - #218 (M3): weights and parts.
  - #219 (M9): date, last split, toast with my share. Stacked on M3.
  - #220 (M5): balances. Stacked on M9, with #217 merged in.
  - #221 (M8): the calmer tab. Stacked on M5.
- **Migrations:** they collided at 0022, so they were regenerated as 0022/0023/0024 on the stack.
- **Screenshots:** each PR carried before/after screenshots from a local build, pushed to the `screenshots` branch.
- **CI:** one failure was the agent's own. A fixture still had the removed `status` field and a quiet local typecheck hid it, which is why the checklist now says to read exit codes.
- **One PR:** the user asked whether they could merge just one. #221 was retargeted to `main`, `main` was merged in, and the description was rewritten to cover everything. Later the user asked to close #217–#220.

## 4. Review

- **Two agents** against a local build:
  - **QA** found:
    - a double tap recording a payment twice (high)
    - weights dropped when editing an expense with parts and weights
    - a wrong people count in the breakdown
    - "אני" vs the user's name on the same row
    - echoed weight-1 values
    - no date range
    - wrapping big amounts
  - **UI/UX** raised:
    - the balance below the fold
    - no undo for "שולם"
    - the same debt shown twice
    - amounts without grouping or with forced ".00"
    - gendered slashes
    - weak chip contrast
    - a doubled date field
- **Bugs:** fixed at once, and the double tap was re-tested in a browser by counting payments.
- **UX decisions:** brought to the user as six numbered items. They said "it's hard without photos", so the canvas got a now-vs-proposed row per item, and the answer was "all of them". All six were built:
  1. a compact header on the money tab, with a "רישום תשלום" floating button
  2. an undo toast that also highlights the new payment
  3. my transfers only in the top card, with others folded below
  4. ₪2,040 / ₪904.60 formatting
  5. להעביר / לקבל / סגור labels
  6. filled chips, one row of date chips, and the per-person amount on its own line

## 5. Compare

- **Three agents** (product, UI/UX, customer) compared money with Splitwise from public sources. Their reports became the "Yallist vs Splitwise" page, with 7 screen pairs, the gaps table, 8 "let's talk" cards, user quotes and a next batch.
- **Verdict:** we're at parity or ahead on the core, with no cap, ads or signup. The gap is trust (history, notifications), then speed and closing the trip.
- **"What are your suggestions?"** was answered with two lists:
  - (a) eight improvements to #221: what each expense does to me, payments in the log, weights plus parts, explaining the transfers, the expense screen header, a calculator in the amount, a payment sentence, my balance on the home card.
  - (b) next phases A–E.

  The user said "add 1–8 and put the rest in the docs". Both were done, with screenshots checked.

## 6. Close

- **Main moved three times.** The merges brought:
  - a conflict with #225 (`itemId` handled separately), kept both
  - the new cache fingerprint test (bumped `CACHE_SHAPE`)
  - the new trip-delete coverage test, red on main too: #225 stopped writing `expenses.item_id`, so the fix in the test was carried in the PR and explained in one PR comment
- **CLAUDE.md** (new on main) added the rule about older Android builds. The removed confirm route came back as a tested no-op.
- **The roadmap** got a "Money next" section, phases A–E, with the decisions made in the comparison.

## Outcomes

- **One PR (#221), ready to merge.** It covers:
  - payments any member records with no confirmation, with undo and delete
  - splits by weight and in parts, together
  - a date on each expense, the last split remembered, a calculator in the amount, and a save message with my share
  - each person's balance with its maths
  - a calmer money tab: a compact header, my number in colour, others' transfers, recorded payments folded, the log grouped by day with what each expense does to me and payments shown
  - grouped amounts and Hebrew without slashes
  - my balance on each home card
- **Next, in the roadmap:**
  - A Trust: history, restore, notifications.
  - B Settling: WhatsApp reminder, several payers, exact amounts.
  - C Speed: one-line quick add, a default split per trip.
  - D End of trip: summary, export, comments.
  - E Later: offline entry, multi-currency to discuss.
