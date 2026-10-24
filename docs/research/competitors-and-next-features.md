# Competitors and next-feature candidates

As of 2026-10-24. Five web/desk research passes (expense splitting, packing lists, trip planning, the Israeli market, engagement). Mostly competitor blogs and store pages, so biased; claims marked **[unv]** are unverified. Not adopted: [roadmap.md](../plans/roadmap.md) is unchanged, this is input for deciding.

## Executive summary

- **Splitters** (Splitwise, Tricount, Settle Up, Splid, Spliit) do money well. Splitwise's daily entry cap and ads are the top complaint; Splid and Spliit win on no signup and no caps.
- **Packing apps** (PackPoint, Packr, Packing Pro) are per-person and template-driven. Closest rivals with claiming (Packalong, PackParty, whobrings) are small and none is Hebrew.
- **Trip planners** (Wanderlog, TripIt, Troupe) do itinerary or polls. Nobody does decide + bring + split + go well, so groups fall back to WhatsApp.
- **Israel:** WhatsApp is the hub and now has native Events/RSVP, so don't build dates/RSVP or chat. Money moves through Bit/PayBox, which are payment rails, not ledgers. The one local splitter (כמה בזבזתי) has no lists.
- **Where Yallist wins:** lists and money in one flow (claim → buy → split), Hebrew RTL, a WhatsApp-native loop (rich invite card, "what's missing" posted back to the group), guest join, no paywall or caps, offline on trip day.
- **Biggest gaps:** unequal splits, per-person packed state, quantity by headcount, carpool/rooms/location (no rival does them), and a trip screen that feels alive (readiness, activity).
- **Bit/PayBox:** Bit has no public deep link, so copy amount + phone + "קיבלתי" is the realistic settle-up. This confirms roadmap D2.
- **Roadmap is utility-first.** Delight (readiness hero, activity strip, recap) sits in Phases 6 to 8; pulling a thin slice forward is cheap.

## Ranked candidates

Effort: S under a few days, M about a week, L more. Priority: P0 do next, P1 soon, P2 later.

| #   | Feature                                                                      | Why                                                     | Who has it                                     | Effort | Pri | On roadmap?                            |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- | ------ | --- | -------------------------------------- |
| 1   | OG link previews for `/j/*` with Hebrew title, dates, "X already in"         | The WhatsApp invite card is the growth loop             | Troupe-style invites; none in Hebrew           | M      | P0  | Phase 2 (plain card; add social proof) |
| 2   | "Share what's missing" Hebrew summary to the group + count in share text     | Replaces the stale pasted list; pulls people back in    | None found                                     | S      | P0  | New                                    |
| 3   | Readiness hero: countdown, "18/24 covered", CTA "missing: coffee, tent"      | One glance says what to do; low gimmick risk            | PackPoint-style progress; none with claiming   | M      | P0  | New                                    |
| 4   | Inline last-3-events activity strip on the trip screen                       | Makes the trip feel alive without the full feed         | Todoist/Wanderlog feeds                        | S-M    | P0  | Phase 6 (full feed); strip is new      |
| 5   | Unequal splits (shares, %, exact; adult 2, kid 1)                            | Most common real-world case; table stakes               | Splitwise, Tricount, Settle Up, Splid, Spliit  | M      | P0  | New (edit expense is Phase 5)          |
| 6   | Settle up: copy amount + payee phone, open Bit/PayBox, "קיבלתי"              | Israeli differentiator without an unavailable deep link | kamabizbazti (Bit/PayBox settle)               | S-M    | P0  | Phase 5 (D2)                           |
| 7   | Per-person "my bag" packed check-off beside group claims                     | The #1 gap in claim-only apps                           | Packr, Packing Pro, PackPoint                  | M      | P0  | New                                    |
| 8   | Quantity scaling by headcount ("grill for N", ×members)                      | Counts are wrong the moment the group changes           | Packr, PackPoint (partly)                      | S-M    | P0  | New (reverses D3 as opt-in)            |
| 9   | Location pin + Waze / Google Maps "Navigate"                                 | Cheap and used on trip day                              | Wanderlog, Roadtrippers                        | S      | P0  | New                                    |
| 10  | Carpool: drivers, seats, pickup, who rides with whom                         | Core Israeli trip logistics; nobody does it well        | None found                                     | M      | P0  | New                                    |
| 11  | Israeli seasonal templates + prefilled empty states + sample trip            | Zero-effort first trip; Pesach, Sukkot, beach, zimmer   | Static Hebrew checklists only                  | S      | P0  | Later (more templates)                 |
| 12  | Edit/delete expense, audit trail                                             | Balances must stay right after edits                    | All splitters                                  | S-M    | P0  | Phase 5                                |
| 13  | Room/bed/tent assignment                                                     | Zimmer and camping need it; no rival found              | None found                                     | M      | P1  | New                                    |
| 14  | Capped nudges: day-before "missing X", "you owe", per-trip mute              | Retention without spam                                  | Troupe, Splitwise reminders                    | M      | P1  | Phase 6                                |
| 15  | Post-trip recap card (shareable image) + duplicate trip                      | Strongest viral and repeat-use hook                     | Polarsteps (photo book), Spotify-Wrapped style | M      | P1  | Phase 8 (summary, duplicate); card new |
| 16  | Food notes per member (kosher, vegan, allergies)                             | Shown on food items; Israeli groups ask this constantly | None found                                     | S-M    | P1  | New                                    |
| 17  | Shabbat/holiday warning on trip dates; "שומרי שבת" tag                       | Local trust signal                                      | None found                                     | M      | P1  | New                                    |
| 18  | Multi-currency per expense (fixed rate to trip currency)                     | Needed for trips abroad, not for domestic camping       | Tricount, Settle Up, Splid, Spliit             | M      | P1  | New                                    |
| 19  | Offline entry on trip day                                                    | Campsites have no signal                                | Splid, Tricount, PackPoint                     | M      | P1  | Phase 7                                |
| 20  | Pinned links/docs (booking, address, check-in code), PayBox group link field | Replaces "scroll the WhatsApp group for the code"       | Lambus, TripIt                                 | S-M    | P1  | New                                    |
| 21  | Weather hints for dates and place                                            | Drives smart suggestions                                | PackPoint, Wanderlog                           | M      | P2  | New (needs place)                      |
| 22  | Receipt photos; OCR and itemized split                                       | Photos are cheap; OCR is large                          | Settle Up, Spliit (beta AI)                    | M / L  | P2  | Phase 5 (photos); OCR new              |
| 23  | Date/place polls                                                             | Lower value: WhatsApp Events does dates and RSVP        | Troupe, Howbout                                | M      | P2  | Later ("help choosing a place")        |
| 24  | Light schedule/timeline; shared photo album link                             | Nice, not core                                          | Wanderlog, Lambus; Polarsteps                  | M; S   | P2  | New                                    |
| 25  | English fallback for join page and OG                                        | Mixed-language groups                                   | n/a                                            | M      | P2  | Later (locales)                        |

Skipped as low value for trips: recurring expenses, store/aisle sorting, weight per bag, item photos, hosted chat, widget, badges.

## Do next (proposed phase "make the group loop sing")

1. **OG previews + "share what's missing"** (#1, #2). The WhatsApp card gets people in; the summary gets them back. Both are tiny next to their effect, and OG is already blocked only on the domain.
2. **Readiness hero + inline activity strip + prefilled empty states** (#3, #4, #11). One trip-screen pass that makes the app feel alive; no push or feed backend needed beyond what exists.
3. **Unequal splits** (#5, with #12). Biggest functional hole against every splitter; needs a weight on expense shares, so do it with edit-expense.
4. **Settle up with phone + copy + "קיבלתי"** (#6). Already Phase 5; keep it, no deep link.
5. **Per-person packed state + quantity scaling** (#7, #8). Closes the gap against packing apps. Ship scaling as opt-in per item or template so D3's fixed default stays safe.
6. **Location + Waze, then carpool** (#9, #10). Waze is an afternoon; carpool is the one logistics feature no rival does, and it is very Israeli. Rooms (#13) follow the same pattern.
7. **Israeli seasonal templates** (#11). Cheap content that makes first use instant; add Pesach, Sukkot, beach, zimmer, with home-screen banners later.

Judgment call: I left polls (#23) and chat out. WhatsApp owns both.

## Don't build

- Chat, RSVP, or date polls as a headline feature (WhatsApp Events and groups own them).
- Daily entry caps, ads, or paywalling anything that is free today (Splitwise's top complaint).
- Requiring a bank account or signup to join.
- Push per claim, streaks, leaderboards, competitive badges, gamified debt.
- Fake or AI filler content, invented social proof ("7 already in" must be real).
- Confetti everywhere: three milestones at most (all covered, all settled, trip done).
- Generated payment links (bit.ly-style) or scraping Bit; phishing warnings and no public API.
- Unreconciled balances after edits, and rounding drift in splits.
- Per-person subscriptions.

## Open questions

| Question                                                                 | Recommendation                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Scale quantities by headcount (reverses D3)?                             | Yes, opt-in per template item ("per person"); default stays fixed.                       |
| Pull a thin slice of the activity feed (last 3 events) ahead of Phase 6? | Yes: read-only strip from existing data, no push.                                        |
| Per-person packed state: separate "my bag" list or a flag on each item?  | A per-member packed flag on items you claim or that apply to everyone; no second list.   |
| Add Israeli sample/seasonal templates before Play launch?                | Yes; content only, helps the 12 closed testers get a first trip fast.                    |
| Carpool before or after rooms?                                           | Carpool first (more trips need it); share one "assignment" pattern.                      |
| Add a PayBox group link field ("קישור לקופה") on trips?                  | Yes, S effort, no integration risk.                                                      |
| Validate priorities with the 12 Play closed testers?                     | Yes, a short Hebrew poll in the app or WhatsApp, before committing to carpool and rooms. |
| Is a recap card worth doing before iOS and Play production?              | Yes in Phase 8; it is the main organic growth loop beyond invites.                       |

## Appendix: sources and caveats

Reports 1 to 4 used web search; **report 5 was written from memory with no fetches, so every example-app claim in it is unverified.**

1. **Expense splitting:** hipposplit.com blog (3 posts), tripprof.com, spliit.pro, flowtrip.app, split-circle.com, splitterup.app, spliit.app, openalternative.co, alternativeto.net, globes.co.il (Bit/PayBox fees), Wikipedia (PayBox). **[unv]:** prices and limits, Trustpilot ~1.8, Tricount's bunq requirement, "no Hebrew-first splitter".
2. **Packing:** PackPoint, Packr, PackParty and Packalong store pages, justuseapp, techradar, backpackinglight forum, wanderlog blog, herpackinglist, cookbookmanager, getbuybye, itechguides, Google Keep/Todoist/Microsoft help, hikt.app, packplexity.com, packitsmart.app, tripprof.com, stippl.io. Search snippets only; **[unv]** where marked.
3. **Trip planning:** wanderlog.com blog, wandrly.app, tripprof.com, tripstone.app, travelvient.com, troupe.com, whistleout.com, flowtrip.app, itechguides.com, swipesights.com. Mostly rival blogs (biased); prices unverified.
4. **Israel market:** developer.bitpay.co.il, bitpay.co.il FAQ, geektime, mako, help.sumit.co.il, payboxapp.com, PayBox App Store IL, kamabizbazti.com, tulon.app, financa.co.il, activemind.co.il, blog.whatsapp.com (events), parks.org.il, lametayel.co.il. **[unv]:** tulon.app's depth; no Play Store sweep. Not covered: Doodle, Partiful, SignUpGenius, Sheets usage, reservist and youth-movement specifics.
5. **Engagement:** none (memory only). Validate with the closed testers.
