# UI plan: from thin to full

Design plan, 2026-10-25. One plan for making Yallist feel full: home, trip, join, states, content and the system pieces under them. Replaces three overlapping drafts (#63 home and trip, #65 design system v2.1, #66 onboarding and content) and answers both reviews on #65. Inputs: [DESIGN.md](../DESIGN.md), `apps/mobile/src`, research #51, fix list #67, Maestro testIDs from #72.

![Overview: today vs. after the first three PRs](assets/ui-plan/overview.png)

## Why it feels empty

![Today's home, trip list and money tab, problems marked](assets/ui-plan/diagnosis.png)

| Cause                                                      | Fix                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Countdown, readiness and "my part" are buried in captions  | Readiness hero on the trip, next-trip hero on home (PRs 2, 3)     |
| Nothing shows other people acting                          | Activity strip, avatars in their own colors (PR 6)                |
| Empty states explain instead of offering one tap           | Template tiles, suggestion chips, illustrated `EmptyState` (1, 3) |
| Loading, errors and the join page were never designed      | Skeleton, Loader, state spots, join as an invitation (4, 5)       |
| Thin content: 4 templates, no season, "בקרוב" placeholders | Seasonal catalog, notes, microcopy, no "בקרוב" (4, 7, 8)          |
| Nothing reacts when you finish something                   | Three celebrations, ring/bar motion, haptics (9)                  |

## Where warmth comes from

No new UI hues, no gradients. Personality lives in five places only:

| Source                    | Where it shows                                                                       | Rule                                                       |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Illustration scenes/spots | Next-trip hero band, join card, `EmptyState` spot, new-trip preview, success `Toast` | `illustration.scenes.<id>` palette only, one warm light    |
| Per-person avatar colors  | `AvatarStack`, activity strip, join "already in", money                              | Pale `avatar.*` fill, `ink` initial (≥ 13:1)               |
| Orange progress           | `ProgressRing`, `Progress`, done checks                                              | Graphics only; the count text always carries the value     |
| Celebrations + haptics    | All covered, everyone settled, trip-day morning; light haptic on claim and "packed"  | Three milestones, once per device; off with reduced motion |
| Copy                      | Loader lines, empty/404/pending states, tips, celebration lines                      | Dry humor only where nothing is at stake; never money/data |

## Build order

Visible first, cleanup last. Every PR: lands after #72, runs unit tests + the Maestro flows, forwards `testID` through any new wrapper, and is accepted on **before/after screenshots** at 390px and 1280px of the scenes listed.

| #   | PR                                                         | You'll see                                                            | Needs        |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------- | ------------ |
| 1   | `feat(ui): progress ring, countdown, pills, empty states`  | Countdown + "חסרים 8" pills on trip cards; illustrated list empties   | —            |
| 2   | `feat(app): trip readiness hero`                           | Trip opens on "עוד 14 ימים", a 6/24 ring and one "what's missing" CTA | 1            |
| 3   | `feat(app,api): next-trip hero and template tiles on home` | Home leads with the next trip; empty home offers 4 one-tap templates  | 1            |
| 4   | `feat(app): designed loading, error and empty states`      | Skeletons instead of spinners; illustrated 404/offline; no "בקרוב"    | 1            |
| 5   | `feat(api,web): join page as an invitation`                | Join shows the scene, who invites, faces, what's missing              | 4            |
| 6   | `feat(api,app): recent activity strip`                     | "דנה מביאה את המנגל · לפני 5 דק׳" under the hero                      | 2            |
| 7   | `feat(domain,api): seasonal template catalog`              | 6 Israeli seasonal templates with quantity notes                      | — (any time) |
| 8   | `feat(app): scenes and season-aware new trip`              | "עכשיו בעונה" row, 11 scenes, real item chips in the preview          | 7            |
| 9   | `feat(app): celebrations, motion and haptics`              | Ring fills on claim; "הכול מכוסה. נשאר רק לצאת."                      | 2            |
| 10  | `refactor(ui): v2.1 tokens, no pixel changes`              | Nothing (by design); contrast test                                    | 1            |
| 11  | `refactor(ui): migrate screens to v2.1`                    | Unified fields, focus rings, 44px targets, contrast fixes             | 10           |
| 12  | `docs(design): DESIGN.md v2.1 and gallery`                 | Gallery on the dev stage, sections, states, 200% text                 | 11           |
| —   | `feat(app): sample trip` (optional, Q3)                    | "טיול לדוגמה" opens a read-only demo                                  | 3, 7         |

1 → 2 → 3 is the critical path; 4, 6, 7 and 10 can run beside it.

### 1. Progress ring, countdown, pills, empty states

![Trip card: caption lines become a countdown pill, ring, pills and a named avatar stack](assets/ui-plan/trip-card.png)

![Text-only empty state vs. EmptyState with a scene and action, and with suggestion chips and template tiles](assets/ui-plan/empty-states.png)

- **Scope:** `ProgressRing`, `Countdown` (+ phase logic in `lib/dates`), `Pill`, `Stat`, `EmptyState` v2 (spot, ≤ 2 actions, `children`). Tokens they need only: `size.ring`, `size.spot`, `type.stat`, `motion.*`, progress track `line`, `isRTL`, `lib/bidi`. TripCard gets countdown + missing pills; ListTab/MoneyTab empties use `EmptyState`.
- **Files:** `components/{ProgressRing,Countdown,Pill,Stat}.tsx`, `components/ListGroup.tsx`, `components/Cover.tsx` (spot crop), `theme/index.ts`, `docs/design/tokens/*`, `lib/{dates,bidi}.ts`, `features/home/TripCard.tsx`, `features/trip/{ListTab,MoneyTab}.tsx`, `app/dev/components.tsx`
- **testIDs:** None changed. New: `empty-state-action`.
- **Measure:** `expo export -p web` gzip size before/after in the PR body. Motion uses RN `Animated` (Reanimated is installed but not yet bundled).
- **Accept:** Home with 1 trip; trip with the "אצלי" filter empty.

### 2. Trip readiness hero

![Trip today vs. readiness hero (+ PR 6 activity strip) vs. solo trip](assets/ui-plan/hero.png)

- **Scope:** `ReadinessHero` above the tabs: countdown (`type.stat`), ring "3/16", `AvatarStack` with a spoken label, "אצלך: מנגל" (`brandStrong`), one tonal CTA "חסרים 18: אוהלים, קפה…" → list with `?filter=missing`. Phases: before / tomorrow / today / during ("יום 1 מתוך 2") / after (settle-up line) / all covered. Solo trip: CTA becomes "לבד פה בינתיים · הזמנת חברים". Desktop: hero moves into the existing side panel. Deletes `ProgressCard`.
- **Files:** `features/trip/ReadinessHero.tsx` (new), `features/trip/ProgressCard.tsx` (deleted), `app/(app)/trips/[tripId]/index.tsx`, `features/trip/{ListTab,derive}.ts(x)`, `components/Avatar.tsx`, `i18n/he.ts`
- **testIDs:** Keep `trip-title`, `trip-tab`, `trip-add`. New: `trip-hero-missing`, `trip-hero-invite`.
- **Accept:** Solo trip (phone); trip with 3 people (desktop).

### 3. Next-trip hero and template tiles on home

![Empty home today vs. template tiles; home with trips led by NextTripCard](assets/ui-plan/home.png)

![Desktop home: one lonely card vs. two columns of trip cards beside a template column](assets/ui-plan/desktop.png)

The desktop mockup is labelled `CardGrid`/`SidePanel`; build it with plain flex rows in `index.tsx`, no new layout components.

- **Scope:** `NextTripCard`: the template's `Cover` band (88px) + countdown `Pill` (onCover) + ring + top-3 missing names. Other trips: `TripCard` with countdown on the first line. Empty home: four `TemplateTile`s under the steps ("מתחילים מ…") opening `/trips/new?template=…`. Desktop: trip cards in two columns, side column with the template tiles and the invite `Callout` ("מחכה לך" across trips is a later follow-up). API: `missingNames` (top 3) on `GET /trips`. No `CardGrid`: the existing grid code handles columns.
- **Files:** `features/home/{NextTripCard,TripCard}.tsx`, `components/TemplateTile.tsx` (extracted from `trips/new.tsx`), `app/(app)/index.tsx`, `app/(app)/trips/new.tsx` (`?template=`), `apps/api` trips route + test
- **testIDs:** Keep `home-new-trip`, `home-profile`; `new-trip-template-<id>` moves into `TemplateTile` and must be forwarded. New: `home-template-<id>`, `home-next-trip`.
- **Accept:** Empty home (phone); desktop home with 1 trip.

### 4. Designed loading, error and empty states

![Bare states today vs. EmptyState with spots for load failed, 404 and join pending](assets/ui-plan/states.png)

![Spinner vs. skeleton; toast tones; Callout](assets/ui-plan/loading-feedback.png)

The toast with "ביטול" in this mockup is deferred: no undo API yet.

- **Scope:** `Skeleton` (home, trip, profile) replaces the `ActivityIndicator`s. `Loader` (Check-Y draw) for full-screen waits only: app boot and the join preview; appears after 300ms, one copy line after 2s. `EmptyState` with spots for load failed (`noSignal`), 404 and invite invalid (`signpost`), join pending (`tentDoor`). `Callout` for tips (new trip, empty money, join pending) and to replace profile's three "בקרוב" switches ("התראות בדרך"). `Toast` tones neutral/success/error, `polite` except errors. Microcopy library applied.
- **Files:** `components/{Skeleton,Loader,Callout,Toast}.tsx`, `components/Cover.tsx` (3 spots), `app/+not-found.tsx`, `app/(app)/{index,profile}.tsx`, `app/(app)/trips/[tripId]/index.tsx`, `app/j/[token].tsx`, `i18n/he.ts`
- **testIDs:** Keep `profile-title`. Loading screens get `loading` on the Skeleton container so flows can wait on its absence.
- **Accept:** Home loading; 404; profile.

### 5–9, briefly

![Join today vs. join as an invitation](assets/ui-plan/join.png)

![New trip in October today vs. season-aware picker](assets/ui-plan/new-trip.png)

| #   | Scope                                                                                                                                                                                                                                                                                                                                                                                                                            | testIDs                                    | Accept (before/after)      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------- |
| 5   | Join: Illustrated card with the scene, "נועה מזמינה אותך", `AvatarStack` (≤ 5 initials + colors, "{n} כבר בפנים" only when n ≥ 2), missing items as chips, small lockup. API: `GET /invites/:token` adds `template`, `placeText`, `organizerName`, `members` (no full names, no phones). Same fields feed the OG card.                                                                                                           | none today; new `join-name`, `join-submit` | Join (phone), join pending |
| 6   | `GET /trips/:id/activity?limit=5` (first slice of the Phase 6 route), `ActivityRow` strip: 3 rows under the hero, 5 in the desktop panel; bursts collapsed; hidden until someone _else_ did something.                                                                                                                                                                                                                           | new `trip-activity`                        | Trip with 3 people         |
| 7   | Templates `pesach`, `sukkot`, `bonfire`, `beachCamp`, `winterZimmer`, `nahal` + `note` hints, `TEMPLATE_META`, static `HOLIDAYS` 2026–2029, `QUICK_SUGGESTIONS` ×10; migration (enum + `template_items.note`). Item lists, notes, scenes, microcopy and tips: [#66 content plan](https://github.com/nadavgihasi/yallist/blob/49be4c90aec3dd235fa06dde7291c24892a32231/docs/design/plans/onboarding-and-content.md#content-plan). | none                                       | n/a (content; unit tests)  |
| 8   | 6 new scenes, `illustration.scenes.*` tokens for all 11, "עכשיו בעונה" row + "כל הסוגים" chips, item chips in the preview, holiday caption, name placeholder = template name.                                                                                                                                                                                                                                                    | `new-trip-template-<id>` kept              | New trip in October        |
| 9   | Ring/bar/StatusRing animate (`motion.base`), counts tick, `Celebration` (Check-Y burst in `illo-*`, ≤ 1.2s, 3 milestones), `expo-haptics` via `lib/haptics` (native only; needs a new APK).                                                                                                                                                                                                                                      | none                                       | All-covered moment (video) |

### 10–12, cleanup

![Four round buttons become IconButton; three field looks become one; orange delete becomes ink](assets/ui-plan/fields-buttons.png)

| #   | Scope                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Remaining tokens with old values kept, so no pixel moves: `well`, `selected`, `overlay`, `avatar.*`, `avatarSize`, `size.icon`, `radius.chip/inner`, `type.label/micro/input`, `opacity.*`, `layout.column/page/sidePanel`, `focusRing`. `theme.contrast.test.ts` reads `tokens.json` and asserts the pairs below; the four token copies stay in sync.                     |
| 11  | Per-screen migration: `IconButton` (44 only; replaces back ×2, `sheet-close`, category edit), `SectionHeader`, `Stepper` (ClaimStepper + qty row), `radius.input` 16→20, inputs 17px, darker `inkFaint`, opacity tokens, focus rings, a11y fixes table. Forward `sheet-close`, `item-form-name`, `item-form-save`, `item-claim`, `item-release` testIDs. Full Maestro run. |
| 12  | DESIGN.md v2.1 (motion, data viz, RTL, warmth, humor rule), README token table, gallery with sections + states + 200% font scale, reachable when `EXPO_PUBLIC_STAGE !== 'production'`.                                                                                                                                                                                     |

## One vocabulary

![Component sheet from #65; read StatCard as a Card of Stats and ActivityItem as ActivityRow](assets/ui-plan/summary-components.png)

### Components

| Name                                     | Is                                                                                                      | Replaces / merges                               | PR  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --- |
| `ProgressRing`                           | SVG ring, `hero` 72 / `card` 56; label inside; `progressbar` role with value                            | —                                               | 1   |
| `Countdown`                              | Formatter + Text; `hero` (`type.stat`) or `inline` (a `Pill`)                                           | countdown captions                              | 1   |
| `Pill`                                   | Non-interactive badge, `minHeight` 28, tones `neutral`/`primary`/`brand`/`onCover`                      | `[itemId]` status chip                          | 1   |
| `Stat`                                   | Value (`type.stat`) + label (`caption`); a row of them goes in a plain `Card`                           | `StatCard` (cut)                                | 1   |
| `EmptyState`                             | Optional spot (scene crop or state spot), title, one line, ≤ 2 actions, `children` (chips, tiles)       | `EmptyState` v2 (#65) **and** `StateCard` (#66) | 1   |
| `ReadinessHero`                          | Feature card on the trip                                                                                | `ProgressCard`                                  | 2   |
| `NextTripCard`, `TemplateTile`           | Feature card on home; tile = `TripTile` + name + meta                                                   | inline tiles in `trips/new.tsx`                 | 3   |
| `Skeleton`                               | `.Line`, `.Circle`, `.Card`; `well` fill; pulse off with reduced motion; one "טוען" label per container | `ActivityIndicator` in screens                  | 4   |
| `Loader`                                 | Check-Y check-stroke draw; full-screen waits only                                                       | spinner on boot and join                        | 4   |
| `Callout`                                | Card variant, `info` (`primaryTint`) or `brand`; optional dismiss "הבנתי"; one per screen               | `Callout` (#65) **and** `TipCard` (#66)         | 4   |
| `Toast`                                  | Tones `neutral`/`success`/`error`; `shadow.float`; no action until an undo API exists                   | `Toast` v2 action (dropped)                     | 4   |
| `ActivityRow`                            | Avatar `sm` + sentence + relative time                                                                  | `ActivityItem` (#65) = `ActivityRow` (#63)      | 6   |
| `Celebration`                            | Check-Y burst + success toast                                                                           | —                                               | 9   |
| `IconButton`, `SectionHeader`, `Stepper` | 44px only; header with optional text action (44px tall); merged stepper                                 | 4 round buttons, 3 headers, 2 steppers          | 11  |
| ~~`CardGrid`, `SidePanel`~~              | Cut: home and trip already lay out columns; revisit if a third screen needs them                        | —                                               | —   |

### Tokens

| Token                                      | Value                                                                                | PR           |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ------------ |
| `size.ring`                                | `hero` 72, `card` 56, `status` 28                                                    | 1            |
| `size.spot`                                | 160 × 120 (4:3 crop of a scene, or a state spot)                                     | 1            |
| `type.stat`                                | 28/32 extraBold, `tabular-nums`                                                      | 1            |
| `motion`                                   | `fast` 150, `base` 250, `slow` 400, `celebrate` 1200 ms; `easing.out` (0.2, 0, 0, 1) | 1            |
| `progress.fill` / `progress.track`         | `brand` / `line`                                                                     | 1            |
| `isRTL`                                    | `true` (constant; the app is Hebrew-only)                                            | 1            |
| `illustration.scenes.<id>`                 | ≤ 6 colors per scene; base `illustration` stays the camp scene                       | 4 (spots), 8 |
| `avatar.*`                                 | The 7 pale colors, moved from `@yallist/domain` (domain keeps an id)                 | 5            |
| `well`, `selected`, `overlay`              | = `ground`, = `primaryTint`, `rgba(16,23,37,0.55)`                                   | 10           |
| `avatarSize`                               | `xs 24, sm 28, md 32, lg 44, xl 56`; `size.avatar` stays 44 until PR 11 removes it   | 10           |
| `radius.input`                             | 16 → 20 in PR 11 (no `radius.field`); `radius.inner` 16; `radius.chip` = pill        | 10/11        |
| `type.label` / `type.micro` / `type.input` | 15/20 bold / 13/18 (metadata only) / 17/24                                           | 10           |
| `opacity`                                  | `disabled` 0.4, `pressed` 0.75, `hover` 0.85                                         | 10           |
| `focusRing`                                | 2px `primary`, offset 2, on the `focused` state                                      | 10           |
| `layout`                                   | `contentMax` 448, `column` 640, `page` 1160, `sidePanel` 340                         | 10           |
| `inkFaint`                                 | `#8B93A1` → `#687080`                                                                | 11           |

### Conflicts resolved

| Topic               | #63              | #65                         | #66                        | Decision                                                                              |
| ------------------- | ---------------- | --------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Empty / error card  | —                | `EmptyState` v2             | `StateCard`                | One `EmptyState` (keeps today's name, no rename churn)                                |
| Tip card            | —                | `Callout`                   | `TipCard`                  | `Callout` with optional dismiss                                                       |
| Skeleton fill       | —                | `well`                      | `line` @ 40%               | `well`: a named token, no alpha                                                       |
| Illustration tokens | —                | `illustration.<scene>.*`    | `illustration.scenes.<id>` | `illustration.scenes.<id>`; base set unchanged                                        |
| Spot size           | —                | 120 × 90                    | 160 px                     | `size.spot` 160 × 120                                                                 |
| Scenes              | 5                | 5                           | +6 scenes, +3 spots        | 11 scenes + 3 spots (`noSignal`, `signpost`, `tentDoor`)                              |
| Join loading        | —                | spinner (Q7)                | `Loader`                   | `Loader` (shape unknown until the invite loads)                                       |
| New type style      | none             | `type.stat`                 | none                       | Add `type.stat` only: the hero countdown at `pageTitle` (36) crowds the ring at 390px |
| New shadow          | none             | `shadow.raised`             | none                       | None: Toast reuses `shadow.float` (it floats too); side panel stays flat              |
| Ring track          | `ground`         | `line`                      | —                          | `line`: visible at 0%; the count text carries the value                               |
| Ring timing         | needs it in PR 1 | lands in PR 2               | —                          | Lands in PR 1, before any refactor                                                    |
| Animation lib       | Reanimated       | Reanimated                  | —                          | RN `Animated` first; Reanimated only if a measured need beats its web bundle cost     |
| Avatar colors       | —                | keep (Q2)                   | colors on join             | Keep, as `avatar.*` tokens                                                            |
| `danger` button     | —                | `ink` + trash icon          | —                          | `ink` + trash icon; orange stays brand/progress                                       |
| Gallery             | —                | breakpoint + motion toggles | gallery in B               | Sections, states, 200% font scale, stage gating; no toggles                           |
| Density             | —                | no compact mode             | —                          | No compact mode                                                                       |

## Rules

![Enter from the start, rings clockwise, bars from the start edge, numbers isolated](assets/ui-plan/rtl-motion.png)

- **RTL.** `I18nManager.isRTL` is `false` on react-native-web, so nothing reads it: use the `isRTL` constant from theme. Directional motion enters from the start: `translateX` sign = `isRTL ? 1 : -1` × distance. Bars fill from the start (flex already does). Rings fill clockwise from 12 o'clock (clocks don't mirror).
- **Icons.** Glyphs in `Icon.tsx` are drawn for RTL (`back` points right, `arrowEnd` points left). Never flip at runtime. Checkmark and the Check-Y never flip.
- **Numbers in Hebrew.** A bare "6/24" or "₪120" is fine (bidi rule W4). When a number run sits inside a Hebrew sentence with other neutrals ("6/24 מכוסים · 3 אנשים"), `lib/bidi.ltr()` wraps it in LRI…PDI (U+2066…U+2069). Unit-test the formatter's string output; nested `<Text>` does not isolate.
- **Text size.** Hints and errors use `caption` (14); `type.micro` (13) is for metadata only (timestamps, payer name). `maxFontSizeMultiplier` 1.3 on `bigNumber`, `stat`, `pageTitle`. Pills, chips, buttons use `minHeight`, never `height`.
- **Touch targets.** 44px real boxes (`minWidth`/`minHeight` or padding). `hitSlop` does nothing on web, so it never counts.
- **Motion.** One `useReducedMotion()` hook; reduced = durations 0, celebrations become copy only.
- **Screen readers.** `AvatarStack` has a name ("דנה, אבי ועוד 2"). `Skeleton` labels its container once. Check TalkBack and a web reader for Skeleton and the Toast `aria-live` mapping in PR 4.
- **Out of scope.** Dark mode (static `colors` in `StyleSheet.create` makes it a later migration), carousels, charts beyond ring and bar, streaks, badges, invented social proof.

## Accessibility fixes (PR 11 unless noted)

![Contrast before and after](assets/ui-plan/contrast.png)

| Pair                                                | Today       | Fix → result                                   |
| --------------------------------------------------- | ----------- | ---------------------------------------------- |
| FilterChip count `primaryStrong` @ 0.8 on tint      | 3.51        | No opacity → 4.93                              |
| FilterChip count white @ 0.8 on `primary`           | 3.95        | No opacity → 5.25                              |
| `brand` fill on `ground` / `line` track             | 2.86 / 2.21 | Count always shown next to the bar/ring (PR 1) |
| `inkFaint` placeholder on `ground` / `card`         | 2.84 / 3.09 | `#687080` → 4.57 / 4.98                        |
| Switch off track `line` on `card`                   | 1.41        | Track `inkFaint` (new) → 4.98                  |
| Cover caption: white @ 0.9 on 0.45 overlay over sun | **3.19**    | `overlay` 0.55, no text opacity → 4.74 (PR 3)  |
| `primary` on `primaryTint` (step numerals, 19/800)  | 4.44        | Keep (large text)                              |
| `brandStrong` on `ground`                           | 4.59        | Keep; "אצלך" stays on cards                    |

## Review points → where answered

| Review point (#65)                               | Answered in                     |
| ------------------------------------------------ | ------------------------------- |
| Reconcile with #63 and #66; one table            | One vocabulary, Conflicts       |
| Lead with what users see                         | Build order 1 → 2 → 3           |
| Warmth under-specified                           | Where warmth comes from         |
| Acceptance = screenshot set                      | Build order (each PR "Accept")  |
| Cut `CardGrid`/`SidePanel`, gallery toggles      | Components, Conflicts           |
| Toast action needs undo API                      | `Toast` row                     |
| `I18nManager.isRTL` false on web; icon flip      | Rules: RTL, Icons               |
| Bidi via LRI/PDI, tested                         | Rules: Numbers                  |
| 13px too small for hints/errors; tabular figures | Rules: Text size; `type.stat`   |
| Keep #72 testIDs                                 | Each PR's testIDs row; PR 11    |
| `hitSlop` on web                                 | Rules: Touch targets            |
| Font scaling                                     | Rules: Text size; PR 12 gallery |
| Split tokens vs migration                        | PRs 10 and 11                   |
| Token renames (`size.avatar`, `radius.input`)    | Tokens table                    |
| Reanimated web cost                              | PR 1 Measure; Conflicts         |
| Dark mode, focus ring, SR checks                 | Rules; `focusRing` token        |
| Cover caption 3.19                               | Accessibility fixes             |

## Open questions

| #   | Question                                                                               | Recommendation                                                      |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Q1  | Countdown on the hero: `type.stat` (28) or `pageTitle` (36)?                           | `type.stat`; the trip title keeps `pageTitle`                       |
| Q2  | Pull the activity endpoint (PR 6) ahead of Phase 6?                                    | Yes, as the first slice of the same route                           |
| Q3  | Sample trip: build it, client-only and read-only?                                      | Yes, after PR 3 and 7, only if testers still stall on an empty home |
| Q4  | `expo-haptics` (new native dep, new APK) in PR 9?                                      | Yes                                                                 |
| Q5  | Join page shows organizer first name + member initials/colors to anyone with the link? | Yes; nothing more                                                   |
| Q6  | Seasonal templates as real `TemplateId`s (DB migration)?                               | Yes                                                                 |
