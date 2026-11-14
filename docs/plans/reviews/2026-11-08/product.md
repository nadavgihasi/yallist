# Product review: Yallist milestones M1–M6

Sources: `docs/plans/roadmap.md` (Next milestones, branch `ccr-32b202da-izyuof`), `docs/SPEC.md`, `docs/research/competitors-and-next-features.md`, `docs/specs/packing-shopping/PACKING_SHOPPING_SPEC.md`, `docs/plans/remote-feature-pipeline.md`, issues #151 and #124, PRs #129, #131 and #132, and the code in `apps/api/src/db/schema.ts`, `apps/api/src/routes/money.ts` and `apps/mobile/src/features/trip/*`.

## 1. Core loop and "aha"

**Loop:** the organizer creates a trip from a template, pastes the link into WhatsApp, and friends join without an account. They claim items, someone runs to the supermarket, the app splits the cost and the group settles up.

**The aha belongs to the invited newcomer, not the organizer.** It happens when they open a WhatsApp link, see "חסר: פחם, קרח", tap "עליי" and watch the organizer's screen update. A spreadsheet can't do that, and a WhatsApp list goes stale the moment someone answers it. The second aha comes after the trip: the shopping run (#126) turns into an expense and "who owes whom" with no math. The research summary says the same: "lists and money in one flow".

**Is the order delivering it early enough? Not quite:**

- Most of the invitee's aha is in M3, and the whole of M3 is gated on **D1, the domain, which is deferred**. Only OG previews, App Links and OAuth redirects actually need it. The join-page work does not: preview, who's in, what's missing and the name field (roadmap Phase 2, "join and pending pages") all run on the CloudFront URL. Testers will invite friends in week 1 of the 14 days and get today's bare join page.
- Closed testers are Android users, but **their friends join on web as guests, and guests get no push**. So M4's push-first "stays on track" misses most members. WhatsApp share-backs reach them. Push doesn't.
- There is **no measurement at all**: no analytics in `apps/` (grep finds only the privacy policy). The closed test will finish with opinions, not numbers. The `activity` table (`schema.ts:395`) already logs events, so a funnel is cheap to build.

## 2. Gaps and cuts

**Missing from the roadmap:**

- **Paste a list from WhatsApp.** Phase 4's bulk add is marked "side work", but it is the migration path from WhatsApp: the organizer already has the list in the group chat. Pull it into the critical path.
- **Share balances and reminders to WhatsApp.** Today only "what's missing" is shared (`ReadinessHero.tsx`). "Who owes whom" and the day-before text should be one-tap WhatsApp messages too.
- **#124 isn't really closed by #132.** The user asked that items they always own be ticked automatically on shared "each" items. #132 copies essentials in as _private_ items instead, and the spec allows "same name as a shared item" (§7). The result is a duplicate שק שינה, with the shared "each" item still unticked. Add: an essential that matches a shared `each` item claims it instead.
- **#151, open the app.** D2 rules out a payee link, but #152 found that Bit does open. "Copy number + amount" followed by "פתיחת Bit/PayBox" is honest, and it is what the user actually asked for. Add a PayBox group-link field (research Q&A, size S).
- **Carpool** (research #10) and **food notes** (#16) are Israeli-specific and no rival has them. They're absent from the roadmap. Validate them with testers before building.
- **Instrumentation and a weekly funnel digest to Telegram** (see §4).

**Cut or defer:**

- **Arrivals checklist (M5).** It duplicates `packed_at`; the spec's own open question 1 asks whether to drop `arrived_at`. Cut it.
- **"My lists" (Phase 4).** Essentials (#132) plus duplicate-trip cover it. Defer.
- **QR and link rotation in the invite sheet.** Groups share on WhatsApp, not in person. Defer.
- **Unequal splits.** The research calls them P0, but SPEC §1 decided equal splits for individual members, and exclusion is already supported. Ask the testers before reopening it.
- **"Make organizer" and the full settings screen.** Low value for 4–8 friends. Defer.

## 3. Prioritized next features

| #   | Feature                                                                             | User problem                                               | Who       | Value          | Effort                                  | Milestone             |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------- | -------------- | --------------------------------------- | --------------------- |
| 1   | Settle up: one-tap copy of phone and amount, open Bit/PayBox, "קיבלתי" (#151)       | Paying means hunting for the number                        | Member    | H              | M (`paymentPhone` API from #152)        | M1                    |
| 2   | Edit expense (amount, payer, shares)                                                | A typo forces delete and re-add, and balances go wrong     | Member    | H              | S (`money.ts` has only POST and DELETE) | M1 (from M4)          |
| 3   | Merge #129, #131 and #132, plus essentials auto-claim matching `each` items (#124)  | Re-ticking the same gear every trip, or getting duplicates | Member    | M              | S on top of #132                        | M1                    |
| 4   | Join page per mockup: what's missing, who's in, claim before or right after joining | The newcomer sees nothing worth joining for                | Newcomer  | **H**          | M                                       | M2 (no domain needed) |
| 5   | Invite sheet: `wa.me`, editable message, social proof ("4 כבר בפנים")               | The invite looks like spam                                 | Organizer | H              | S–M                                     | M2                    |
| 6   | Paste a list (multi-line, `×N`)                                                     | The list already lives in the WhatsApp chat                | Organizer | H              | S (API) + M (sheet)                     | M2                    |
| 7   | Funnel digest (from `activity` and members) to Telegram                             | We can't tell whether the test worked                      | Team      | H              | S                                       | M2                    |
| 8   | Custom domain, OG preview card, App Links, "open in the app"                        | The link shows a bare URL, and the app doesn't open        | Newcomer  | H              | M                                       | M3                    |
| 9   | WhatsApp share-backs: balances, the day-before "what's still on you"                | Guests get no push                                         | Organizer | H              | S                                       | M4                    |
| 10  | Activity strip with the last 3 events, then the feed                                | The trip feels dead between visits                         | All       | M              | S–M (the table exists)                  | M4                    |
| 11  | Push and the day-before reminder                                                    | App users forget                                           | Member    | M              | M–L (FCM, Scheduler)                    | M4                    |
| 12  | Persisted offline mutations                                                         | Changes made at the campsite are lost (#61)                | Member    | M              | M                                       | M5                    |
| 13  | Duplicate trip with new dates                                                       | Next year's trip starts from zero                          | Organizer | M              | M                                       | M5                    |
| 14  | Carpool: drivers, seats, who rides with whom                                        | Logistics happen in a separate chat                        | Organizer | M–H (validate) | M                                       | M5, if testers ask    |
| 15  | Food notes per member (kosher, vegan, allergies)                                    | "Who's vegan?" gets asked in every chat                    | Organizer | M              | S–M                                     | After M6              |

## 4. Success metrics and tester questions

**North star:** trips that depart with ≥3 members and ≥80% of items covered, and are then fully settled.

- **M1:** zero feature PRs older than 7 days. Share of transfers marked paid within 7 days of `ends_on`. Expenses deleted then re-added within 10 minutes (should drop to 0 with edit).
- **M2:** at least 12 testers opted in on all 14 days. **At least 3 real trips** fall inside the window. Activation means a trip with ≥3 members and ≥10 items within 48 h. Bulk paste is used on at least 50% of new trips.
- **M3:** invite link opened → joined (count opens at the preview endpoint) of at least 60%. Median time to join under 60 s. Invitees who claim within 24 h: at least 50%. Invitees who later create their own trip, as the k-factor seed.
- **M4:** coverage the day before departure compared with 3 days before. Claims within 2 h of a share-back or push. Push opt-in rate.
- **M5:** sync failures and 409s per trip day. Ended trips that are duplicated.
- **M6:** listing → install conversion, D30 retention, crash-free sessions ≥99.5% (Sentry).

**Recruit groups, not individuals:** 3–4 friend groups, each with a real trip in the 14 days. Twelve scattered testers can never produce the group aha.

**Ask the testers** (a short Hebrew poll at day 7 and day 14):

1. What did you still do in WhatsApp or a spreadsheet, and why?
2. Did your friends join from the link? Where did they get stuck?
3. Was settling up easy? Which app did you pay with?
4. Did anyone need to pay a different share (couples, kids, non-drinkers)?
5. Would carpool, rooms or food notes have helped on this trip? Rank them.
6. What would make you open Yallist the day before the trip?
7. Would you use it for your next trip? (0–10, with a reason)

## 5. Changes to the milestones

- **M1, rename it "Money that settles itself".** Add edit expense (from M4) and the #124 auto-claim. Sentry alerts and the realtime deflake stay, as hygiene.
- **M2, rename it "Real groups on the closed test".** Add the join page, the invite sheet without a domain, paste-a-list and the funnel digest. Also move **OTA here from M6**: 14 days of fixes shouldn't each wait on a Play build. M2 is the window where the aha has to work.
- **M3, shrink it to the domain-bound work:** the domain, OG, App Links and open-in-app. Push for D1 to be decided this week. If it slips, M3 lands after the test, which is acceptable once item 4 has shipped.
- **M4, rename it "Reach people who aren't in the app".** WhatsApp share-backs and the activity strip come first, push and the scheduler second. Push only reaches installed Android users.
- **M5:** drop the arrivals checklist. Keep offline and duplicate. Add carpool only if the poll ranks it first.
- **M6:** unchanged, minus OTA. Rate limiting stays here, as the public-launch prerequisite.
