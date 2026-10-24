# Onboarding, content and brand

Design plan, 2026-10-24. Scope: everything outside home and trip. That means login, the join page a friend opens from WhatsApp, new trip, profile, and the loading/error/empty states. It also covers the **content layer**: templates, illustrations, copy, tips and celebration lines. Home and trip are in [home-and-trip.md](home-and-trip.md) (PR #63), and this plan supplies content for several of its proposals: #7 template tiles and suggestion chips, #8 celebrations and #10 the sample trip. It stays inside [design system v2](../DESIGN.md), and anything new is listed under [v2 additions](#v2-additions).

Inputs: the live dev site at phone width (login and join viewed signed out, new trip, profile), the code, `@yallist/domain` TEMPLATES, research PR #51 (#11 seasonal templates, #1 OG previews, #6 invite social proof) and the Israel and engagement notes.

## Diagnosis

The app is _correct but generic_. The brand shows up on login and the cover illustrations, then disappears. The content is thin (4 templates, 14–24 items, no hints). Every waiting or failing moment is a bare spinner or a grey sentence.

| Screen                  | What a user sees today                                                                                                                                                                                                                                                                            | Why it feels empty                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Login                   | Lockup, "מי מביא מה?", a static sample card, "מתחילים עם שם", Google. **The best screen in the app.**                                                                                                                                                                                                   | The sample card never moves. Nothing about the season.                                                 |
| Join (`/j/:token`)      | Grey kicker "הוזמנת לטיול", a white card with the name, dates, "משתתף אחד", "24 פריטים חסרים" and a comma list of 6 items, then a name field and the button. **No logo, no illustration, no organizer, no faces.**                                                                                    | It's the first screen a friend ever sees, and it reads like a form. It doesn't say who invited them or why it's fun. |
| Join pending / invalid  | One sentence and a button. "הקישור לא תקף" is a header on a blank page.                                                                                                                                                                                                                               | A dead end with no brand and no illustration.                                                          |
| New trip                | A big cover preview that changes with the template (good). Five tiles with an icon, a name and "24 פריטים". Name, dates and place. The preview lists highlights.                                                                                                                                     | Five generic choices that ignore the date: in October it still opens on "קמפינג" with summer-camp items. The count says how many items, not what they are. |
| Profile                 | Avatar and colors, name, phone, guest warning, **three disabled switches marked "בקרוב"**, sign out.                                                                                                                                                                                                 | A third of the screen is visibly unfinished. Nothing about _you_ (trips, items brought).               |
| Loading                 | A centered `ActivityIndicator` on every screen (home, trip, profile, join).                                                                                                                                                                                                                          | No brand, and the layout jumps when content lands.                                                     |
| Errors / not found      | "לא הצלחנו לטעון…" as caption text with a "לנסות שוב" link. `+not-found` is 5 lines.                                                                                                                                                                                                                  | Fine text, no warmth, no picture.                                                                      |
| Content                 | 4 templates (camp, grill, zimmer, beach) plus blank. Quantities are fixed with no hint why. `QUICK_SUGGESTIONS` has 5 per list. Only one illustration uses the `illo-*` tokens: grill, zimmer and beach hard-code hex values.                                                                       | Nothing Israeli-seasonal (Pesach, Sukkot, Lag BaOmer, winter zimmer). No tips, no humor beyond "יאללה".                             |

Root causes: (1) **content is the product's personality, and there's very little of it**; (2) the join page, the growth loop, got the least design; (3) system states (loading, error, invalid) were never designed; (4) placeholders for future features ("בקרוב") make the app look half-built.

## Proposals, ranked

Ranked by impact ÷ effort. Effort: S ≤ 2 days, M ≈ 1 week, L more.

| #   | Proposal                                    | Where                         | Data / API                                                                                                                       | Effort | New components / tokens                                 |
| --- | ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| 1   | **Seasonal template catalog v2**            | Domain, new trip, home tiles  | 6 new `TemplateId`s + `TEMPLATE_META` (scene, season, tagline); `note` hints on template items; DB check-constraint migration     | M      | none (content)                                          |
| 2   | **Join page as an invitation**              | `/j/:token`, pending, invalid | Preview adds `template`, `placeText`, `organizerName` (first name), `members` (≤5 initials + colors)                              | M      | `StateCard`                                             |
| 3   | **Designed system states**                  | All screens                   | none                                                                                                                             | S–M    | `Loader` (Check-Y draw), `Skeleton`, `StateCard`        |
| 4   | Season-aware new-trip picker                | New trip                      | `TEMPLATE_META.season` + a static `HOLIDAYS` table in domain                                                                     | M      | none (reuses tiles, `Chips`)                            |
| 5   | Scenes for the new templates + illo tokens  | `Cover`                       | none                                                                                                                             | M      | `illustration.scenes.*` tokens                          |
| 6   | Microcopy pass + library                    | `he.ts`                       | none                                                                                                                             | S      | none                                                    |
| 7   | "כדאי לדעת" tips                            | New trip, money, join pending | Static content; dismissed ids in local storage                                                                                   | S      | `TipCard` (a Text card variant)                         |
| 8   | Profile: something about you, nothing "בקרוב" | Profile                      | `GET /me` adds `stats` (trips, items brought), counted from existing tables                                                      | S      | none                                                    |
| 9   | Login sample card comes alive               | Login                         | none                                                                                                                             | S      | uses agent 1's `motion` tokens                          |
| 10  | Celebration and sample-trip content         | Feeds home-and-trip #8, #10   | none                                                                                                                             | S      | none (content only)                                     |

Not proposed: an onboarding carousel (the login sample card already shows the product, and carousels get skipped), a forced "what are you planning?" quiz before home (agent 1's template tiles on the empty home do that job with one tap), badges or streaks (on the research "don't build" list).

### 1. Seasonal template catalog v2

Templates are the cheapest way to make the app feel full: the first trip opens with 20–30 real Israeli items instead of a blank form. Add six templates and enrich the existing four. The full outline is in the [content plan](#templates).

- **IDs:** `pesach`, `sukkot`, `bonfire` (Lag BaOmer), `beachCamp`, `winterZimmer`, `nahal` (a water hike), alongside `camp`, `grill`, `zimmer`, `beach`, `blank`. They are real IDs, so the trip remembers its scene (Q1).
- **`TEMPLATE_META`** in `@yallist/domain`: `{ scene, tagline, season?: { from: 'MM-DD', to: 'MM-DD' } | { holiday: HolidayId, before: days } }`. `Cover` takes `scene` from it, so two templates can share a scene until their own art lands.
- **Quantity hints as notes.** `TemplateItem` gets `note?`, copied into the item's existing `note` on create, for example "בערך 300 גרם לאדם" or "שק לכל 5 אנשים בערך". Users see the reasoning without the D3 decision being reversed (no automatic scaling, Q4).
- **API:** extend `TEMPLATE_IDS` and the `trips_template_check`/`template_items` enum (migration), add the `template_items.note` column, and copy it in `dal/items.ts`. `migrate.ts` already reloads the seed from TEMPLATES.
- **Tile counts:** the new-trip grid goes from 5 to 11 tiles, so #4 groups them.

```
New trip, phone (RTL: start = right)
┌──────────────────────────────────────┐
│  טיול חדש                          ›  │
│ ┌──────────────────────────────────┐ │
│ │   [Cover: scene of the template] │ │
│ │  ┌────────────────────────────┐  │ │
│ │  │ קמפינג בסוכות               │  │ │
│ │  │ חמישי–שבת, 1–3 באוקטובר     │  │ │
│ │  └────────────────────────────┘  │ │
│ └──────────────────────────────────┘ │
│  עכשיו בעונה                         │  ← section title; from season/holiday
│ ┌───────────────┐ ┌───────────────┐  │
│ │ [tent] קמפינג │ │ [home] צימר   │  │  ← existing tile, + tagline line
│ │    בסוכות     │ │ בחורף. קמין,  │  │
│ │ סוכה? לא. גשם? │ │ מרק, משחקים    │  │
│ │ אולי.  26 פר׳  │ │ 22 פריטים     │  │
│ └───────────────┘ └───────────────┘  │
│  כל הסוגים                       ‹   │  ← Chips row, horizontal scroll:
│  (קמפינג)(על האש)(חוף)(מסלול מים)…   │     selecting one swaps the cover
│                                      │
│  מה נכנס לרשימות                     │
│  (אוהלים ×4)(יריעה לגשם)(גזייה)(+23)  │  ← real item chips, not prose
│                                      │
│  שם הטיול  [ קמפינג בסוכות        ]  │  ← placeholder = template name
│  מתי  [1 באוק׳] – [3 באוק׳]          │
│       חול המועד סוכות · כולל שבת      │  ← holiday caption (#4)
│  איפה (לא חובה) [                 ]  │
│         ( + יצירת הטיול )            │  ← floating primary
└──────────────────────────────────────┘
```

(`[tent]`, `[home]` = the existing `Icon` set; no emoji in the UI.)

### 2. Join page as an invitation

For most friends this page _is_ Yallist: they tap a link in a WhatsApp group and decide in five seconds. It should feel like an invitation from a person, show the trip's picture, and make joining feel like taking part, not like signing up.

- **Illustrated card** (existing Card variant): the trip's `Cover` scene bleeds across the top, with the trip name, dates and place underneath.
- **Who's inviting:** "נועה מזמינה אותך" (organizer first name, gendered with the "/ה" fallback when gender is unknown). Below it an `AvatarStack` of up to 5 members in their own colors, plus "ועוד 3". Only real data, never invented social proof.
- **What's missing as chips** (the same chip style as the trip filters), with a line under them: "מצטרפים ולוקחים משהו". This turns the missing list into the reason to join.
- **A small lockup at the bottom** with "רשימה אחת לכל הטיול". This is the only brand moment for someone who has never heard of Yallist.
- **Pending:** a `StateCard` with an illustration (the scene with a small tent door), "דפקת בדלת", "נועה תאשר בקרוב. הדף מתעדכן לבד." and the existing "בדיקה עכשיו". Add one tip (#7) so the wait isn't blank.
- **Invalid / removed:** `StateCard`s with copy from the [library](#microcopy-library).
- **API:** `GET /invites/:token` adds `template`, `placeText`, `organizerName` (first word of the display name) and `members: { initial, color }[]` (≤5, active only). No full names or phones: the link is a bearer capability, and initials are enough (Q2). The same fields feed the Phase 2 OG card, so do this before or with `feat(infra): OG link previews`.

```
Join, phone
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │      [Cover: camp scene]         │ │  ← Illustrated card
│ ├──────────────────────────────────┤ │
│ │ נועה מזמינה אותך                  │ │  caption, inkMuted
│ │ קמפינג בכנרת                      │ │  pageTitle
│ │ שבת–ראשון, 7–8 בנובמבר · צאלון    │ │  caption
│ │ (נ)(א)(מ)(ש) ועוד 3 כבר בפנים      │ │  AvatarStack + caption
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ עוד חסרים 24                      │ │  itemTitle
│ │ (מנגל)(פחמים)(גזייה)(צידניות)(+20)│ │  chips
│ │ מצטרפים ולוקחים משהו               │ │  caption
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ איך קוראים לך?                    │ │
│ │ [                              ] │ │
│ └──────────────────────────────────┘ │
│        ( הצטרפות לטיול )             │  floating primary, as today
│  בלי הורדה ובלי סיסמה.               │
│        [Y]allist · רשימה אחת לכל הטיול │  small lockup, 24px tall
└──────────────────────────────────────┘
```

### 3. Designed system states

Every screen has a loading, an error and sometimes a "not here" state. Design them once and reuse them everywhere.

- **`Loader`:** the Check-Y mark (`yallist-mark.svg`, `brand`) drawing its check stroke in a loop. It's for full-screen waits only (app boot, join preview) and appears after 300ms so fast loads never flash it. After 2s, one line from the [library](#microcopy-library) fades in ("סופרים פיתות…"). The brand book already lists the mark for loaders.
- **`Skeleton`:** grey (`line` at 40%) blocks shaped like the real content: the TripCard on home, category and item rows on the trip, profile cards. It replaces `ActivityIndicator` inside screens, so the layout doesn't jump. A gentle pulse, off with reduced motion.
- **`StateCard`:** an Illustrated card with a small (160px) scene, a `sectionTitle`, one `body` line and up to two buttons (tonal plus quiet). It's used for load failed, trip not found, `+not-found`, invite invalid/removed and join pending. Agent 1's filter empty states can use it too.

```
Load failed (any screen)               404
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ ┌──────────────────────────┐ │       │ ┌──────────────────────────┐ │
│ │ [tent, antenna, no bars] │ │       │ │ [signpost, two arrows]   │ │
│ ├──────────────────────────┤ │       │ ├──────────────────────────┤ │
│ │ אין קליטה, כמו בנחל        │ │       │ │ השביל הזה לא מסומן         │ │
│ │ בודקים את החיבור ומנסים    │ │       │ │ אולי הקישור ישן, אולי טעות │ │
│ │ שוב.                     │ │       │ │ הקלדה.                    │ │
│ │       ( לנסות שוב )       │ │       │ │     ( לטיולים שלי )        │ │
│ └──────────────────────────┘ │       │ └──────────────────────────┘ │
└──────────────────────────────┘       └──────────────────────────────┘
```

### 4–10, briefly

- **4. Season-aware picker.** The "עכשיו בעונה" row shows the 2 templates whose season contains today or whose holiday is within the next 30 days. Everything else sits in a chips row ("כל הסוגים"). The default selection is the first in-season template instead of always `camp`. Under the dates, a caption names the holiday or "כולל שבת" from a static `HOLIDAYS` table (Q3); it's information only, no blocking. Picking a template fills the name placeholder ("קמפינג בסוכות"), and the fallback name becomes the template name instead of "הטיול שלנו".
- **5. Scenes.** Six new scenes in the existing flat, layered 390×300 style, plus three spot illustrations for `StateCard` (no signal, signpost, tent door). The hard-coded hexes in grill, zimmer and beach move into `illustration.scenes.<id>` tokens. See the [illustration list](#illustrations).
- **6. Microcopy pass.** Apply the [library](#microcopy-library): toasts after claim and release, errors, invalid link, pending, loaders, the 404. Keep the voice rules (plural present, short). Add dry humor only where nothing is at stake (waiting, empty, done), never on errors that lose data or on money.
- **7. Tips ("כדאי לדעת").** A one-line Text card with a quiet "הבנתי" dismiss. At most one per screen, in three places only: new trip (below the preview), the empty money tab, join pending. The content is static (see [tips](#tips-כדאי-לדעת)), and the dismissed ids live in local storage. The tips are useful facts, not feature ads.
- **8. Profile.** (a) Replace the three disabled switches with one Text card, "התראות בדרך", and a one-line explanation, then bring the switches back in Phase 6. (b) Add a stats line on the identity card, "4 טיולים · הבאת 31 פריטים", from real counts (a `stats` field on `GET /me`), hidden while 0. (c) Add an "על Yallist" ListGroup: version, "שיתוף Yallist עם חברים" (system share sheet with the site URL), and terms/privacy once Phase 3 lands.
- **9. Login sample card.** A 4s loop: the "מצננת" row's "עליי" presses itself, the ring fills, the caption becomes "את/ה מביא/ה" and the header meta ticks to "15 מתוך 20". It runs once on load, then every 8s, and stays static with reduced motion. Optional seasonal swap of the sample trip name ("קמפינג בפסח" in spring) from the same `TEMPLATE_META`.
- **10. Content for agent 1.** The celebration lines (home-and-trip #8) and the sample-trip fixture (#10) are below, so those PRs only wire them in.

## Content plan

### Templates

`→` marks a `note` hint. The quantities follow today's fixed style (D3). Only the six new templates are outlined in full. The existing four gain notes only:

- `camp`: meat "בערך 300–400 גרם לאדם לארוחה", water "3 ליטר לאדם ליום, יותר בחום", charcoal "שק לכל 5 אנשים בערך".
- `grill`: the same meat and charcoal notes, plus quantities for pita (40) and ice (2 שקים).
- `beach`: sunscreen "מורחים שוב כל שעתיים", plus a new item "אוהל צל לתינוקות?" under "כללי". It only shows on the trip, and you can delete it.
- `zimmer`: unchanged, apart from adding its "ערב" quantities.

| ID / name                      | Season                          | Bring (categories: items)                                                                                                                                                                                                                                       | Buy (categories: items)                                                                                                                                                     |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pesach` · קמפינג בפסח          | Pesach −21 days to the end      | **בישול:** מנגל, פחמים ×2 שקים, גזייה ובלון גז, סיר ומחבת → "כשרים לפסח, למי שמקפיד", צידניות ×2, קרש וסכין · **לינה:** אוהלים ×4, שק שינה (each), מזרן (each), פנס ראש (each), כיסאות ×8, צילייה · **כללי:** ג׳ריקן מים, ערכת עזרה ראשונה, שקיות זבל, רמקול | **מצות ועוד:** מצות → "חבילה לכל שניים ליום, בערך", ממרחים, ביצים (30) · **על האש:** בשר (4 ק״ג) → per-person note · **ירקות ופירות:** ירקות לסלט, פירות · **שתייה:** מים (6 שישיות), יין, קפה וחלב |
| `sukkot` · קמפינג בסוכות        | Sukkot −21 days to the end      | As `camp`, plus **לינה:** יריעה לגשם → "אוקטובר, למקרה", שמיכה נוספת (each) → "הלילות כבר קרירים", חבלים ויתדות נוספים                                                                                                                                              | As `camp`, plus **פירות העונה:** רימונים, תמרים                                                                                                                              |
| `bonfire` · מדורה בל״ג בעומר    | Lag BaOmer −14 days to the day  | **מדורה:** עצים למדורה → "רק עצים יבשים, ומדליקים רק במקום מותר", מצית וגפרורים, עיתונים להצתה, דלי מים לכיבוי → "מכבים עד הסוף לפני שהולכים", מקלות לקלייה · **ישיבה:** כיסאות ×8, מחצלת, שמיכות · **כללי:** פנסים, רמקול, שקיות זבל                          | **על האש:** תפוחי אדמה → "שניים לאדם", נייר כסף, נקניקיות, פיתות · **מתוק:** מרשמלו, אבטיח · **שתייה:** שתייה קלה, מים                                                       |
| `beachCamp` · קמפינג בחוף       | Jun–Sep                         | **לינה:** אוהלים ×4, יתדות לחול → "יתדות רגילות לא מחזיקות בחול", שק שינה (each), פנס ראש (each), צילייה · **ישיבה:** מחצלות ×2, כיסאות חוף ×6 · **על האש:** מנגל, פחמים ×2, צידניות ×2 · **כללי:** מטקות, קרם הגנה, מגבת (each), שקיות זבל                        | **אוכל:** בשר לעל האש, פיתות (40), אבטיח, ביצים, לחמניות · **שתייה:** מים (8 שישיות) → "בחוף שותים יותר", קרח (3 שקים), בירות                                             |
| `winterZimmer` · צימר בחורף     | Dec–Feb                         | **ערב בפנים:** משחקי קופסה, רמקול, סיר גדול למרק · **אישי:** נעלי בית (each), פיג׳מה חמה (each), מעיל גשם (each)                                                                                                                                                  | **ארוחת בוקר:** לחמים ומאפים, גבינות וממרחים, ביצים, ירקות · **ערב:** ירקות למרק, יין אדום ליין חם, תפוזים וקינמון, גבינות קשות · **מתוק:** שוקו, מרשמלו                    |
| `nahal` · מסלול מים             | May–Oct                         | **אישי:** נעלי מים (each) → "לא כפכפים", שקית אטומה לטלפון (each), בגד להחלפה (each), מגבת (each), כובע (each) · **כללי:** ערכת עזרה ראשונה, צידנית, שקיות זבל                                                                                                       | **אוכל:** כריכים, פירות, חטיפי אנרגיה · **שתייה:** מים → "לפחות 3 ליטר לאדם", קרח                                                                                          |

Later candidates (not in v2): Shavuot picnic, Yom HaAtzmaut (featured `grill`, with no new template), class trip and youth movement, reservists. `QUICK_SUGGESTIONS` grows from 5 to 10 per list, with seasonal ones first (from `TEMPLATE_META.season`): bring "יתדות לחול", "שמיכה נוספת", "דלי מים"; buy "מרשמלו", "נייר כסף", "רימונים".

### Illustrations

All flat, layered and 390×300 like the existing scenes. Each scene has at most 6 colors, drawn from its `illustration.scenes.<id>` tokens, with one warm light source (sun, fire or lamp) so the orange logo stays at home beside them.

| Asset           | Used by                        | Picture                                                                     |
| --------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `pesach`        | Cover, tiles                   | Spring green hills with red כלניות dots, a tent, a pale sun                  |
| `sukkot`        | Cover                          | Dusk sky, a small sukkah with palm-frond roof and string lights, first cloud |
| `bonfire`       | Cover                          | Night (deep `hillDeep`), a bonfire with sparks, silhouettes of chairs        |
| `beachCamp`     | Cover                          | Sunset sea (`water`), sand, a tent and a lantern                             |
| `winterZimmer`  | Cover                          | A cabin with a smoking chimney, rain lines, a warm lit window                |
| `nahal`         | Cover                          | A stream between rocks, reeds, a small waterfall                            |
| `noSignal`      | `StateCard` load failed        | A tent with a little antenna and empty bars                                  |
| `signpost`      | `StateCard` 404, invalid link  | A trail signpost with two arrows, a path that fades out                      |
| `tentDoor`      | `StateCard` join pending       | A tent with its flap half open and a light inside                            |

### Microcopy library

Plural present, short, warm. The jokes only go where nothing is at stake. Gendered forms use "/ה" as the app does today.

| Moment                   | Today                                   | Proposed                                                                       |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| Loader (after 2s, one)   | spinner                                 | "סופרים פיתות…" · "מחממים את המנגל…" · "מותחים את האוהל…"                         |
| Load failed              | לא הצלחנו לטעון. בודקים את החיבור…      | **אין קליטה, כמו בנחל** / בודקים את החיבור ומנסים שוב.                            |
| Not found (404)          | (bare)                                  | **השביל הזה לא מסומן** / אולי הקישור ישן, אולי טעות הקלדה.                        |
| Trip not found           | הטיול לא נמצא                           | **הטיול הזה לא כאן** / אולי הוסרת ממנו, או שהוא נמחק.                             |
| Invite invalid           | הקישור לא תקף                           | **הקישור הזה כבר לא עובד** / כנראה שלחו חדש בקבוצה. שווה לגלול למעלה.             |
| Join pending             | הבקשה נשלחה                             | **דפקת בדלת** / {organizer} יאשר/תאשר בקרוב. הדף מתעדכן לבד.                        |
| Join, invited by         | הוזמנת לטיול                            | {organizer} מזמין/ה אותך                                                        |
| Join, social proof       | משתתף אחד                               | "{n} כבר בפנים" (only when n ≥ 2), otherwise nothing                           |
| Claim toast              | (none)                                  | "רשמנו: {item} עליך"                                                           |
| Release toast            | (none)                                  | "{item} חזר לרשימה. מישהו יתפוס"                                               |
| Fallback trip name       | הטיול שלנו                              | the template name ("קמפינג בסוכות"); blank keeps "הטיול שלנו"                    |
| Profile notifications    | 3 disabled switches                     | **התראות בדרך** / בינתיים, הטיול מתעדכן בזמן אמת כשהוא פתוח.                      |
| Guest warning            | (keep; it's clear and honest)           | unchanged                                                                      |

**Celebrations** (for home-and-trip #8): all covered "**הכול מכוסה.** נשאר רק לצאת."; trip-day morning "**היום יוצאים!** הפחמים כבר באוטו?"; everyone settled "**כולם סגורים.** החברות ניצלה."

**Sample trip fixture** (for home-and-trip #10): "קמפינג בכנרת", the same trip as the login card so the story is continuous. Eight people (איתי, נועה, מאיה, שירה, דור, יעל, רון, עומר), 14 of 20 covered, the `camp` template trimmed to 20, one expense ("פחמים וקרח, ₪86, איתי") and a banner "טיול לדוגמה · אפשר ללחוץ, שום דבר לא נשמר".

### Tips ("כדאי לדעת")

Static, at most one per screen, and each says something true:

- New trip: "פריט 'לכל אחד' כמו שק שינה: כל אחד מסמן שיש לו, בלי לריב מי."
- New trip (Pesach/Sukkot in season): "בחניוני הלילה של רשות הטבע והגנים מזמינים מקום מראש, ובחגים הם מתמלאים מהר."
- Empty money tab: "מוסיפים טלפון בפרופיל, וחברים יוכלו להעביר לך בביט בלי לשאול 'מה המספר?'."
- Join pending: "בזמן שמחכים: אפשר להוסיף את הקישור לשולחן העבודה, וחוזרים לטיול בלחיצה."

## v2 additions

| Kind      | Name                                    | Notes                                                                                                               |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Token     | `illustration.scenes.<id>` (6 colors each) | Formalizes the hexes already hard-coded in `Cover` and adds the new scenes. The base `illustration` set stays as the camp scene. Illustrations only. |
| Component | `Loader`                                | The Check-Y mark with an animated check stroke; the brand book already names the mark for loaders                    |
| Component | `Skeleton`                              | `line` at 40%, `radius-input`; shapes per screen                                                                    |
| Component | `StateCard`                             | An Illustrated card variant with a 160px scene, title, line and ≤2 buttons                                           |
| Component | `TipCard`                               | A Text card variant with a caption and a quiet dismiss                                                               |
| Rule      | Humor                                   | Only in waiting, empty, done and 404 states. Never on money, data loss or permissions                               |

No new colors outside illustrations, no new type styles, no new shadows. Motion uses agent 1's `motion` tokens.

## Implementation plan

| PR  | Title                                                     | Scope                                                                                                                                                                       | Size | Depends on                                                                                       |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| A   | `feat(domain,api): seasonal template catalog`             | 6 templates, enriched notes, `TEMPLATE_META`, `HOLIDAYS` table, `QUICK_SUGGESTIONS` ×10; migration (enum check + `template_items.note`); copy notes in `dal/items.ts`; tests | M    | none. Land before agent 1's PR 2, so `TemplateTile` reads `TEMPLATE_META`                       |
| B   | `feat(app): scenes for every template, state illustrations` | 6 scenes + 3 spots in `Cover`, `illustration.scenes` tokens (theme + `docs/design/tokens`), DESIGN.md; a gallery in `/dev/components`                                     | M    | A (IDs). Until then new IDs fall back to the base scene via `TEMPLATE_META.scene`                |
| C   | `feat(app): season-aware new trip`                        | In-season row, chips row, taglines, item chips preview, holiday caption, name placeholder, new-trip tip                                                                     | M    | A, B                                                                                             |
| D   | `feat(api,web): join page as an invitation`               | Preview fields, illustrated join, pending/invalid `StateCard`s, small lockup                                                                                                | M    | B for scenes (falls back to camp). Coordinate with the Phase 2 OG PR, which uses the same fields |
| E   | `feat(app): designed states and microcopy`                | `Loader`, `Skeleton`, `StateCard` everywhere, `+not-found`, the copy library, tips, profile cleanup + stats, login card loop                                               | M    | Agent 1's PR 4 for `motion` tokens (or adds them first). Celebration copy goes to agent 1's PR 4 |

A, D and E can start in parallel; B follows A; C follows both. Each PR adds unit tests (template integrity: unique names per list, every template has a scene; season and holiday lookup; preview payload has no full names) and updates e2e selectors where text changes.

## Open questions

| #   | Question                                                                           | Recommendation                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | New templates as real `TemplateId`s (DB migration), or "variants" of the base 4?   | **Real IDs.** The migration is small, the trip keeps its own scene and name, and later analytics can tell them apart.                                               |
| Q2  | How much may the join page show a stranger holding the link?                       | **Organizer first name and member initials and colors, nothing more.** Anyone with the link can join anyway, so this is safe, and it's what makes the invite feel personal. |
| Q3  | Holiday dates: a static table, or `Intl` Hebrew calendar?                          | **Static table for 2026–2029**, checked against hebcal once. Hermes' `Intl` calendar support is unreliable, and a test can fail when the table runs out.            |
| Q4  | Quantity hints: notes, or scaling by headcount (research #8)?                      | **Notes now.** They're content-only and keep D3. Scaling is a separate feature decision.                                                                            |
| Q5  | Kashrut / Shabbat tags on templates?                                               | **No tags in v2.** One kashrut-for-Pesach note on the Pesach pots, and Shabbat shows as an informative "כולל שבת" caption. Food notes per member are their own feature. |
| Q6  | Humor in loaders: fun or annoying on the tenth time?                               | **Only after 2s, one line, picked at random.** Most loads never show it. Drop it if testers roll their eyes.                                                      |
| Q7  | Who draws the scenes?                                                              | **Hand-written SVG in the existing style**, reviewed in `/dev/components` at phone and desktop sizes. Get a designer only if the testers find them flat.           |
| Q8  | Ship the in-season row before agent 1's home template tiles?                       | **Yes, via A first.** Both surfaces then read the same `TEMPLATE_META`, so home and new trip always suggest the same thing.                                        |
