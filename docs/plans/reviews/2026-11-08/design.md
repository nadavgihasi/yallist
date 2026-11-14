# Yallist design review (2026-11-08)

**How I checked it.** The PR-156 preview (`d1bocaacywm9vx.cloudfront.net/pr-156/`) returned CloudFront 502 "Failed to contact the origin" on every path, so I used the dev stage instead (`d14dyw021evejd.cloudfront.net`, built from main, v0.28.0). I signed in as a guest and captured every main screen at 390×844, 1×, next to the rendered mockups (screenshots kept out of the repo).

**Dark mode** isn't supported. `app.json` sets `"userInterfaceStyle": "light"`, the code never calls `useColorScheme`, and the body stays `#F4F5F8` under `prefers-color-scheme: dark`. Fine for M2; there are no dark tokens yet.

## 1. Where the app drifts from the mockups (most important first)

1. **Blue that can't be tapped.** In the item sheet, the status chip "אצלך" is filled with `primary` (`items/[itemId].tsx` `chipBg`, `mine: colors.primary`), which breaks the "blue = tap" rule. Fix: use `<Pill tone="brand">`. The UI plan already assigned `Pill` to this chip.
2. **Four ways to show "selected", all on one screen.** On the trip screen, the segmented tabs (`Controls.tsx`) and the filter chips (`Chips.tsx` `FilterChip`) are both solid `primary`, stacked about 100px apart, with a third tonal row ("יוצאים לקניות") between them. The add-item sheet adds outlined tiles and solid category chips. Fix: solid `primary` only for the segmented control; selected chips become `primaryTint` + `primaryStrong` label + check (what the theme comment already says).
3. **Too many control shapes at the row end.** Trip list rows end in four different controls: "אני אביא", "יש לי", "ביטול ×" and a − 0 + stepper. The mockup has one ("עליי"). Fix: one 44px tonal slot; pick "עליי" or "אני אביא" and update `HANDOFF.md`. Stepper only for qty > 1; "ביטול" moves into the sheet.
4. **Orange used for destructive actions.** "מחיקת הפריט", "מחיקת הטיול", "התנתקות" and the delete screens use `brandStrong`, so `brandStrong` now means "yours", "error", "danger" and "you owe" at once (`PillButton.tsx` `danger`, `Fields.tsx` error, `MoneyTab.tsx`, `PeopleTab.tsx`, `CategoryForm.tsx`, `delete*.tsx`). UI-plan PR 11 says delete becomes ink. Fix: add a `danger` token (deep red, at least 4.5:1) and keep `brandStrong` for "אצלך" only.
5. **Avatars no longer match the brand book.** DESIGN.md says avatars are `primary` with a white letter. The app uses 7 pale `AVATAR_COLORS` (`packages/domain/src/profile.ts`) with ink letters, including the header avatar (pale teal "ד"). The UI plan kept the colors (Q2), so the brand book is out of date. Fix: move the palette into `tokens.json` (`avatar.*`) and document it.
6. **Login.** The mockup has one primary button at the bottom ("המשך עם Google") and a terms line. The app has "מתחילים עם שם" (60px, 800 weight) above a white Google button (56px, 13px text, `GoogleButton.tsx`), plus a privacy link and the version line. For M2: put Google first, using Google's official asset at 48–56px, make guest a quiet button, and add the terms link once D5 is decided.
7. **The trip screen has a cover again.** The reference `trip.html` and README "What changed" say the trip screen has no cover. The app shows a cover band (a deliberate later PR). Fix the docs, not the app.
8. **Two section-title sizes.** `theme.type.sectionTitle` is 26/32, but `TripCard.tsx:120` and `EmptyState.tsx:76` override it to the handoff's 24/30, so cards and states don't match. Pick one size, ideally 24 to match the tokens, and delete the overrides.
9. **Back and close buttons are copied in four places.** `trips/new.tsx`, `[tripId]/index.tsx`, `shop/index.tsx` and `profile.tsx` each build their own back button. Category edit is 36px and the add ring is 28px (`ListTab.tsx`), both under the 44px minimum. Build `IconButton` as UI-plan PR 11 proposes.
10. **Sheets and footer.** Sheets open at full height even when short (the item sheet is mostly empty); size them to content. Show the version line only on profile, not under the home list.
11. **Mirroring is correct**: back chevron at the start pointing right, icons before labels, digits isolated.

## 2. Design-system debt (from grepping `apps/mobile/src`)

- **Literal values:** 27 `fontSize`, 39 `borderRadius` and 77 padding/margin/gap literals outside `theme`. The worst files are `features/trip/ItemForm.tsx` (radii 20/22, fonts 12/15/19/24), `components/Fields.tsx` (13/15/17/30/40), `items/[itemId].tsx`, `expenses/new.tsx` and `Sheet.tsx` (20/22).
- **Missing tokens:**
  - `type.label` (15/700), `type.micro` (12–13)
  - `type.input` (17)
  - `radius.inner/sheet/chip` (16/22/18)
  - `opacity.*` (12 literals)
  - `overlay` (`rgba(16,23,37,0.55)` in `new.tsx`, `rgba(0,0,0,0.35)` in `profile.tsx`)
  - `danger`, `avatar.*`
  - three stray hex colors in `stateSpots.tsx`
- **Duplicated components:** the item-sheet chip duplicates `Pill`. There are three field styles (`Input`, `DateTile`, the `whatInput` in add expense). Four back buttons and the sheet close button have no shared `IconButton`. `ClaimStepper` and the qty row in `ItemForm` are two steppers. Template tiles look different on home (horizontal) and in new trip (stacked) from the same data.
- **Spinners left over:** `ActivityIndicator` is still used in `profile.tsx` and `delete-account.tsx`, after PR 4 replaced the others.
- **Four token copies out of sync:** `docs/design/tokens/*` still say 34/24/18/18 for page title, section title, step and button-lg, while the app uses 36/26/19/17. The docs `theme.ts` sets `fontWeight`, which the app deliberately removed. There's no `theme.contrast.test.ts`. UI-plan PR 10–12 are unstarted; do PR 10 before M3 screens add more literals.

## 3. Design needed before each milestone can be built

`v1/*.dc.html` has unfilled templates (`{{headline}}`, `{{copyLabel}}`) for Invite, Join, JoinPending, Activity, Offline, TripSummary, TripSettings and Participants. They are v1 layout and copy, with no states. Each needs a v2 frame at 390px with empty, loading and error states.

- **M2:**
  - Login v2, with Google first, a quiet guest button and the terms line.
  - A terms page laid out like `/privacy`.
  - App icon is done. The splash is an orange mark on `ground`; check the Android 12 splash crops it correctly inside a circle.
  - A Play store listing set (section 4).
- **M3:**
  - **Invite sheet:** the WhatsApp preview card, an editable message, a `wa.me` button, copy link, QR code, the approval switch and "rotate link". Route today's three invite entry points (header pill, hero CTA, ניהול tab) to it.
  - **Join as an invitation (PR 5):** the scene, "דנה מזמינה אותך", faces, missing items as chips, a name field, the lockup, and an "פתיחה באפליקציה" button.
  - **Pending:** the tent-door spot and a live update when approved.
  - **OG preview card image:** 1200×630, safe for WhatsApp's square crop (about 600×600 in the middle). It needs the trip scene, the name, the dates and "8 כבר בפנים", plus a generic version for invalid links.
  - **Participants and settings:** make organizer, the approval switch, and the trip-settings list.
- **M4:**
  - **Activity screen:** a timeline grouped by day, filters (הכול / פריטים / כסף), "מחכה לך" to-dos, and an unread dot on a header bell. The UI-plan PR 6 activity strip comes first.
  - **Push notifications:** a monochrome Check-Y small icon at 24dp on transparent (the Android status bar shows it white only); the accent color `brand`; Android channels (claims, money, join requests, reminders). Copy in the "plural friends" voice, for example "אבי לוקח את המנגל · חסרים עוד 4" or "מחר יוצאים לכנרת: חסרים קרח וקפה. מי מביא?" A pre-permission explainer card for Android 13+.
  - **Payment reminder** and **edit expense** states.
- **M5:**
  - **Offline banner:** "אין קליטה · 3 שינויים ממתינים" pinned under the header, "ממתין" pills on rows, and a toast when a change is rolled back.
  - **Arrivals checklist:** "עוד בדרך" / "הגיעו".
  - **Trip summary:** settle-up progress, transfers with "קיבלתי" and copy actions, stats, highlights, "duplicate with new dates" and archive.
  - **Settle-up card** (M1): copy phone number and amount, no Bit buttons.
- **Across all milestones:** UI-plan PR 9 (celebration and motion) and a dark theme can wait until after M6.

## 4. Brand and store presence (M2, M6)

The repo has no store assets: no feature graphic, no screenshots, no OG image. Play needs:

- **Icon:** 512×512 32-bit PNG. Export `yallist-app-icon-fullbleed.svg` at that size; the existing `icon.png` is 1024 RGB and would only need resizing.
- **Feature graphic:** 1024×500. Use the sunset `illo-*` scene with the reversed lockup on the left and "מי מביא מה?" on the right. Keep text out of the outer 15%, because Play overlays a play button and crops the edges.
- **Phone screenshots:** 4–8, at 1080×1920 or larger, in Hebrew, framed on `ground` with a one-line caption in 800 weight above the device:
  1. "רשימה אחת לכל הטיול" (trip hero with 3 people)
  2. "כל אחד לוקח מה שהוא מביא" (list with claims)
  3. "שולחים בוואטסאפ, מצטרפים מהדפדפן" (invite)
  4. "יוצאים לקניות ומחלקים את החשבון" (shopping or money)
  5. "רואים מי כבר בפנים" (home)
  - Capture with the UI-plan fixture trip "קמפינג בכנרת" and seeded multi-member data, not a solo guest trip.
  - Hide the dev version line.
- **Store text:** a short description of up to 80 characters, for example "רשימה משותפת לטיול: מי מביא מה, מה חסר ומי שילם". The full description should be in Hebrew with English for M6.
- **Later:** 7" and 10" tablet screenshots (the app has wide layouts).
- **Brand consistency:** match the OG card, feature graphic and store screenshots to each other. Show the Check-Y large in only one place per asset, and never put it on blue.
