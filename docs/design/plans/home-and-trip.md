# Home and trip: making them feel full

Design plan, 2026-10-24. Scope: the home screen (`/(app)/`) and the trip screen (`/trips/[tripId]`), the core loop. Stays inside [design system v2](../DESIGN.md); the additions it needs are listed in [v2 additions](#v2-additions). Inputs: the live dev site (desktop, guest, a camping trip from the template), the code, [research PR #51](https://github.com/nadavgihasi/yallist/pull/51) (#3 readiness hero, #4 activity strip, #11 prefilled empty states) and its engagement notes.

## Diagnosis

The screens show _state_ (lists, counts) but not _the trip_: no sense of when, who, what's next, or what just happened. Everything that would answer those already exists in the data, except recent activity.

| Screen | Phone                                                                                                                                                                                                       | Tablet (600–1023)                                                     | Desktop (≥ 1024)                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Home   | Trip card is a list of facts; the countdown is a small caption at the bottom. Empty state is a picture + 3 steps, with no way in except the button.                                                           | 2-column grid; one trip leaves half the screen blank.                 | **Most empty.** One trip = one card in a 3-column grid, two thirds of the page blank. Empty state leaves a tall gap under the steps card.        |
| Trip   | Title, a caption line, then straight into tabs and a 0-of-16 progress bar. No countdown, no "what should I do", no sign of other people. 16 identical "חסר" rows at first open. Solo trip looks like a form. | Single column capped at 640: same as phone, wider.                   | Side panel is one card: "משתתף אחד" and one avatar. The panel is 340px of mostly nothing; the money card only appears once something is spent. |

Root causes: (1) the hero information (countdown, readiness, my part) is buried in captions; (2) nothing shows _other people acting_; (3) empty states explain instead of offering one-tap content; (4) the wide layouts are the phone layout with spare room; (5) nothing reacts when you finish something.

## Proposals, ranked

Impact ÷ effort, best first. Effort: S ≤ 2 days, M ≈ 1 week, L more. "Existing" = already in `GET /trips` or `GET /trips/:id`.

| #   | Proposal                       | Where                  | Data                                                                                       | Effort | New components / tokens                                |
| --- | ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------ |
| 1   | **Trip readiness hero**        | Trip, all widths       | Existing (dates, `doneCount`, missing items, `mine`, members)                              | M      | `ReadinessHero`, `ProgressRing`; `size.ring`           |
| 2   | **Next-trip hero card on home** | Home, all widths       | Existing + `missingNames` (top 3) on `GET /trips` (S)                                      | M      | `NextTripCard` (reuses `Cover`, `ProgressRing`)        |
| 3   | **Recent-activity strip**      | Trip (+ desktop panel) | **New** `GET /trips/:id/activity?limit=5`; the `activity` table is already written, never read | M      | `ActivityRow`, relative-time strings                   |
| 4   | Solo-trip invite nudge         | Trip hero              | Existing (`activeIds.length === 1`)                                                        | S      | none (Card action row)                                 |
| 5   | Desktop trip side panel        | Trip, desktop          | Existing + #3                                                                              | S      | none; panel = hero + activity + "who brings what"     |
| 6   | Desktop/tablet home layout     | Home, tablet/desktop   | Existing                                                                                   | S      | none                                                   |
| 7   | Empty states with content      | Home empty, empty list | Existing (`@yallist/domain` TEMPLATES)                                                     | S      | `TemplateTile` (extract from `trips/new.tsx`)          |
| 8   | Celebration moments (3 only)   | Trip                   | Existing, plus a seen-flag per trip in local storage                                       | S–M    | `Celebration`; `motion` tokens                         |
| 9   | Micro-interactions             | Both                   | none                                                                                       | S      | `motion` tokens; `expo-haptics` (new dep)              |
| 10  | Sample trip ("טיול לדוגמה")    | Home empty             | Client-only fixture from TEMPLATES (see Q2)                                                | M      | none                                                   |

### 1. Trip readiness hero

Replaces the per-tab `ProgressCard` and the caption line under the title with one card above the tabs. It answers "when, how ready, what do I do":

- **Countdown** as the big number ("עוד 14 ימים", "מחר", "היום!") in `pageTitle`, ink.
- **Ring** for the whole trip (both lists): brand arc on `ground` track, "6/24" inside. Orange is allowed: it's progress.
- **"אצלך"** line in `brandStrong` when I hold items (existing rule).
- **One CTA**: tonal pill "חסרים 18: מנגל, אוהלים, קפה…" that switches to the list with the _missing_ filter on (lift the filter into the URL: `?filter=missing`).
- States: _before_ (countdown), _during_ ("יום 1 מתוך 2"; later the Phase 7 arrivals link), _after_ (settle-up summary from `transfers`), _all covered_ (ring full, check, #8).
- Tile: the trip's `TripTile` at the start. Option (Q1): an 88px `Cover` band on top as an Illustrated card.

```
Phone, RTL (start = right)
┌──────────────────────────────────────────┐
│                       Camping, Kinneret ▣│  ← TripTile + pageTitle stays above
│              Sat–Sun 7–8 Nov · 3 people  │
├──────────────────────────────────────────┤
│  ╭────╮                      in 14 days  │  ← pageTitle-size countdown
│  │6/24│                 ●●● Dana, Avi +1 │  ← AvatarStack
│  ╰────╯ ring (brand)         yours: grill│  ← brandStrong
│ [ 18 missing: tent, coffee, ice… ›     ] │  ← tonal pill, opens ?filter=missing
└──────────────────────────────────────────┘
│  Bring·16 │ Buy·8 │ People │ Money       │  ← SegmentedControl (unchanged)
```

### 2. Next-trip hero card on home

The soonest upcoming trip gets a bigger card; other upcoming trips keep `TripCard`, now with the countdown moved to the top line and a missing-count chip. The hero card is an Illustrated card: the template's `Cover` scene bleeds across the top (the scenes already exist for all five templates), with the countdown set on it in a `card` pill.

```
Phone                                      Desktop (≥1024): hero spans 2 cols
┌──────────────────────────────────────┐   ┌───────────────────────────┬───────────┐
│ ░░░ Cover scene (camp) ░░░ [in 14d] │   │ ░░ Cover ░░░░░░ [in 14d]  │ Waiting   │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   │ Camping, Kinneret      ▣  │ for you   │
├──────────────────────────────────────┤   │ ╭────╮ 6/24 covered       │ · grill   │
│ Camping, Kinneret                ▣ │   │ ╰────╯ missing: tent,     │ · ice     │
│ ╭────╮ 6/24 covered     ●●● +1     │   │        coffee, ice        │ ₪120 to   │
│ ╰────╯ missing: tent, coffee, ice  │   │ yours: grill    ●●● +1    │ Dana      │
│ yours: grill                        │   ├─────────────┬─────────────┼───────────┤
└──────────────────────────────────────┘   │ TripCard    │ TripCard    │ New trip: │
┌ TripCard (next upcoming) ───────────┐   │             │             │ ▣ ▣ ▣ ▣   │
└──────────────────────────────────────┘   └─────────────┴─────────────┴───────────┘
```

"Waiting for you" (desktop/tablet side column) aggregates `mine` and `transfers` across trips, both already in `GET /trips`. The "new trip" card is four `TemplateTile`s that open `/trips/new?template=…` (one-line change in `new.tsx`).

### 3. Recent-activity strip

The last 3 events under the hero (phone/tablet) or 5 in the side panel (desktop). One row each: avatar, sentence, relative time. A "הכול" link stays hidden until Phase 6's activity screen exists.

```
┌──────────────────────────────────────────┐
│ Lately                                   │  ← card title (caption bold, inkMuted)
│ (D) Dana is bringing the grill · 5 min   │
│ (A) Avi added "ice ×2" to Buy · 1 h      │
│ (D) Dana paid ₪180 for meat · yesterday  │
└──────────────────────────────────────────┘
```

- API: `GET /trips/:id/activity?limit=` (members only), newest first. Ship it as the first slice of the Phase 6 feed endpoint, same shape, so Phase 6 adds paging and filters, not a new route. Payloads need item name and quantity at write time (check `claim_set`, `item_added`, `expense_added` carry them; add if not) so deleted items still render.
- Show only `claim_set`, `item_added`, `expense_added`, `payment_confirmed`, `member_approved`/join. Collapse bursts (3 items added in a minute = one row).
- Realtime already invalidates the trip query; invalidate this key on the same events.
- Hidden when there's nothing from _other_ people yet (no "you created the trip" filler).

### 4–10, briefly

- **4. Solo nudge.** While I'm the only member, the hero's CTA becomes "לבד פה בינתיים · הזמנת חברים" (tonal, `userPlus`). Goes to the People tab now, the Phase 2 invite sheet later.
- **5. Desktop trip panel.** Sticky side column: hero (#1) → activity (#3) → "מי מביא מה": one row per member, avatar + "4 פריטים" (from claims) → money card (always shown; "עוד לא הוצאתם כלום" + "הוספת הוצאה" link when empty). On desktop the hero moves from above the tabs into the panel, so the list starts higher.
- **6. Wide home layout.** Hero spans two columns, side column "מחכה לך" + new-trip tiles; past trips as a compact 3-column row grid. With zero trips on desktop, put the steps card and the template tiles side by side under the illustration, not next to it.
- **7. Empty states with content.** Home empty: the four template tiles under the steps ("מתחילים מ…") so the first tap picks a template. Blank-template trip / empty category: `SuggestionChip`s from TEMPLATES items for that list plus "הוספת הכול" (single-item adds now, bulk add after Phase 4). Filter empty states ("אצלי" = 0): one line + a "לקחת משהו" link to _missing_.
- **8. Celebrations.** Exactly three (research "don't build" list): all items covered, everyone settled, trip day morning. A one-line Hebrew toast-card ("הכול מכוסים. יאללה!") and a short burst of Check-Y marks in `brand` and `illo-*` colors (illustration palette, not UI). Once per milestone per trip per device; respects reduced motion.
- **9. Micro-interactions.** Status ring fills on claim (200ms), progress bar and ring animate to the new value, counts tick, avatars pop in on realtime join, a light haptic on claim and on "packed" (native only). Reanimated is already a dependency.
- **10. Sample trip.** "טיול לדוגמה" tonal button on the empty home (it's already in the brand book) opens a read-only, clearly labelled demo trip built client-side from the camp template with example people and some claims. Nothing written to the API; "פותחים כזה" at the bottom goes to `/trips/new?template=camp`.

Not proposed here: invite sheet, packed state, carpool, recap (other plans / roadmap phases). Rejected: streaks, badges, per-claim push, invented social proof.

## v2 additions

The brand book allows all of the above except where listed. Each needs a line in `DESIGN.md` and `tokens.json` when built.

| Kind      | Name                                    | Why                                                                                                                                       |
| --------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Token     | `size.ring` = 72 (hero), 56 (cards)     | Progress ring sizes                                                                                                                       |
| Token     | `motion.fast` 150 / `motion.base` 250 / `motion.celebrate` 1200 ms, one ease-out curve | v2 has no motion tokens                                                                                     |
| Rule      | `brand` for the progress _ring_         | Extends "progress bars" to rings; same meaning                                                                                           |
| Rule      | `illo-*` in the celebration burst       | It's an illustration; keeps the "illustrations only" rule true                                                                           |
| Rule      | Countdown pill on a `Cover`             | A `card` pill over an illustration, the same treatment as the new-trip preview                                                           |
| Component | `ProgressRing`                          | SVG ring, `brand` on `ground`, label inside; `accessibilityRole="progressbar"`                                                           |
| Component | `ReadinessHero`, `NextTripCard`, `ActivityRow`, `TemplateTile`, `Celebration` | Feature components, built from Card, Avatar, PillButton, TripTile, Cover                                  |
| Strings   | relative time ("לפני 5 דק׳", "אתמול"), activity sentences (gendered: "מביא/ה" as today) | `i18n/he.ts`                                                                                 |

No new colors, type styles or shadows. Countdown uses `type.pageTitle`; the ring label uses `type.itemTitle`.

## Implementation plan

| PR  | Title                                                    | Scope                                                                                                                         | Size |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `feat(app): trip readiness hero`                         | `ProgressRing`, `ReadinessHero` (#1), solo nudge (#4), `?filter=` in the URL, drop per-tab `ProgressCard`; tokens + DESIGN.md | M    |
| 2   | `feat(app): richer home`                                 | `NextTripCard` (#2), countdown/missing on `TripCard`, wide layout + "מחכה לך" (#6), `TemplateTile` + `?template=` (#7 home); API: `missingNames` on `GET /trips` | M    |
| 3   | `feat(api,app): recent activity on the trip`             | `GET /trips/:id/activity`, payload check, `ActivityRow` strip (#3), desktop side panel (#5)                                   | M    |
| 4   | `feat(app): suggestions in empty lists, celebrations, motion` | #7 list empty states, #8, #9, `motion` tokens, `expo-haptics`                                                            | M    |
| 5   | `feat(app): sample trip` (optional, see Q2)              | #10                                                                                                                           | M    |

PRs 1, 2 and 3 are independent and can run in parallel; 4 builds on the ring from 1. Each adds unit tests for the derive logic (countdown phase, missing names, activity collapsing) and updates the e2e smoke where selectors change.

## Open questions

| #   | Question                                                                                     | Recommendation                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | v2 removed the illustrated cover from the trip screen. Bring back a thin (88px) band in the hero? | **Home hero card yes, trip screen no.** Home is where trips need telling apart; on the trip screen the tile is enough and space is precious. |
| Q2  | Sample trip: client-only demo, or a real trip created with example members?                  | **Client-only, read-only.** No fake people in the database, no cleanup, no invented social proof.                                     |
| Q3  | Pull the activity endpoint forward from Phase 6 now?                                         | **Yes**, as the first slice of the same route. It's the single biggest "alive" signal and the table is already written.               |
| Q4  | Celebrations: confetti-like burst, or just the copy and the ring filling?                    | **Burst of Check-Y marks, three milestones only**, under 1.2s, off with reduced motion. Kill it if testers find it childish.          |
| Q5  | Hero on desktop: above the tabs (like phone) or in the side panel?                           | **Side panel**, so the panel stops being empty and the list starts higher.                                                             |
| Q6  | Add `expo-haptics` (new native dep, needs a new APK build)?                                  | **Yes**, small and Expo-maintained; ship it with PR 4.                                                                                 |
