# Group Trip App — Implementation Spec

> **Note (2026-10-24):** This spec was written around Supabase. The tech stack, security enforcement, realtime/notification plumbing, sign-in providers and build-plan details in §1, §2, §5, §6 and §11 are superseded by [tech-decisions.md](tech-decisions.md). Product behavior, data semantics, domain rules and design remain authoritative here.

A mobile + web app for planning a group trip together: a shared **bring list** (gear people already own) and **buy list** (things someone purchases), where everyone claims what they'll bring, marks what they bought and what it cost, and the app shows who owes whom. Israel-first: Hebrew, right-to-left, WhatsApp-native sharing, Bit/PayBox for settling up. A later phase helps the group choose a place.

The look is design system v2 in `design/` (tokens, brand, reference screens; see §9). The 17 v1 mockups in `design/v1/screens/` are superseded for look but remain the reference for layout and copy where v2 has no screen. This document is the source of truth for behavior, data and architecture.

---

## 1. Product decisions already made

These were decided during design. Do not re-open them without asking.

- **Members are individual people**, not households.
- **Two lists per trip:** `bring` and `buy`. Items are grouped into categories inside each list.
- **Three item kinds:**
  - `single` — one person takes it (e.g. מנגל).
  - `qty` — a total quantity, people claim parts (e.g. 8 chairs: Michal 3, Shira 2).
  - `each` — every member brings their own (e.g. sleeping bag); each member ticks "יש לי".
- **Anyone in the trip can add and delete items.** Organizers additionally manage members, settings, and can delete the trip.
- **Joining needs no account.** A friend opens the invite link in a browser, types a name, and is in (anonymous auth). Installing the app is offered, never required.
- **Optional organizer approval:** per-trip switch. When on, link-joiners land in a pending state until an organizer approves.
- **Invite link can be rotated;** the old link stops working immediately.
- **Sign-in for app users:** Google and Apple (Apple's App Store rules require an equivalent privacy-focused option when offering Google sign-in). Anonymous users can later link Google/Apple without losing data.
- **Costs split equally** among an expense's participants. By default every active member participates; each expense can exclude people (e.g. beer only for those who drink). No per-household or weighted splits.
- **Settling up:** the app computes the minimal set of transfers. Payment happens outside the app (Bit / PayBox). The payer marks "סומן כשולם"; the receiver can confirm "קיבלתי את הכסף". The receiver can send a reminder.
- **Trip-day mode:** during the trip dates, a "מה הגיע?" checklist lets people mark what physically arrived. Must work offline (campsites often have no reception) and sync later.
- **After the trip:** summary with settle-up progress, stats, and "שכפול לטיול הבא" (duplicate people + lists with new dates).
- **Currency:** ILS only for now. Store money as integer agorot.

---

## 2. Tech stack

| Concern       | Choice                                                          | Notes                                                                                                                      |
| ------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Client        | **Expo** (React Native) + **Expo Router**, TypeScript strict    | One codebase for iOS, Android, and the web join link. Use the latest stable Expo SDK.                                      |
| Backend       | **Supabase**: Postgres, Auth, Realtime, Storage, Edge Functions | Local dev via Supabase CLI (Docker). Schema lives in `supabase/migrations`.                                                |
| Server state  | **TanStack Query** with persisted cache                         | Offline: persisted queries + paused mutations that resume on reconnect.                                                    |
| Auth          | Supabase anonymous sign-in; Google + Apple via ID-token sign-in | Follow the current Supabase docs for native Google/Apple sign-in on Expo. Use identity linking to upgrade anonymous users. |
| Styling       | Typed theme tokens (`src/theme`)                                | RTL-safe: use start/end, never left/right.                                                                                 |
| Fonts         | Rubik 400/700/800, via `@expo-google-fonts/rubik`               | Covers Latin and Hebrew.                                                                                                   |
| Glass effects | None                                                            | Design system v2 is flat: cards on `ground`, one shadow on the floating button.                                            |
| Illustrations | `react-native-svg` components                                   | Trip cover scenes, see Appendix B.                                                                                         |
| Push          | Expo Notifications                                              | Tokens stored in Supabase; sent from an Edge Function.                                                                     |
| Tests         | Unit tests for domain logic; database tests for RLS and RPCs    | Pure domain functions in `src/domain` with no React or Supabase imports.                                                   |

Language: the UI is Hebrew-only for v1 but keep every string in a single `he` locale file so another language can be added later. Force RTL on native (`I18nManager`) and set `dir="rtl"` on web.

---

## 3. Data model (Postgres)

Write these as migrations. Column names are suggestions; keep the semantics.

**profiles** — `id` (= `auth.users.id`), `display_name`, `avatar_color`, `payment_phone` (nullable; shown to friends so they can pay via Bit/PayBox), notification prefs (`notify_updates`, `notify_day_before`, `notify_settle`, all default true), timestamps.

**trips** — `id`, `name`, `starts_on`, `ends_on`, `place_text` (nullable, "עוד לא נבחר"), `template` (`camp|grill|zimmer|beach|blank`, also selects the cover scene), `currency` default `'ILS'`, `require_approval` bool default false, `invite_token` (unique, ≥128 bits of randomness, URL-safe), `status` (`planning|ended|archived`), `created_by`, timestamps.

**trip_members** — PK (`trip_id`, `user_id`), `role` (`organizer|member`), `status` (`pending|active|removed`), `display_name` (snapshot at join, editable), `joined_at`. The creator is an active organizer.

**trip_categories** — `id`, `trip_id`, `list` (`bring|buy`), `name` (unique per trip and list, ignoring case), `position`, `created_at`. Any active member adds, renames, reorders or deletes them; deleting one makes its items uncategorized. A trip made from a template starts with the template's categories.

**items** — `id`, `trip_id`, `list` (`bring|buy`), `category_id` (nullable: uncategorized, shown last), `position`, `name`, `kind` (`single|qty|each`), `quantity_needed` int (1 for single; ≥2 for qty; ignored for each), `unit` (nullable, e.g. "שקים"), `display_qty` (nullable free text for buy items, e.g. "4 ק״ג", "30"), `note`, `created_by`, `created_at`, `deleted_at` (soft delete).

**claims** — PK (`item_id`, `user_id`), `quantity` int > 0, `arrived_at` (nullable; set in trip-day mode), `created_at`. For `each` items a claim means "I have mine".

**expenses** — `id`, `trip_id`, `item_id` (nullable; links a purchase to a buy-list item), `description`, `amount_agorot` int > 0, `paid_by`, `created_by`, `receipt_path` (nullable, Storage), `created_at`.

**expense_shares** — PK (`expense_id`, `user_id`). The participants an expense is split between.

**payments** — `id`, `trip_id`, `from_user`, `to_user`, `amount_agorot`, `status` (`marked|confirmed`), `marked_at`, `confirmed_at`, `reminded_at` (nullable). A recorded settle-up transfer.

**activity** — `id`, `trip_id`, `actor` (nullable for system events), `type`, `payload` jsonb, `created_at`. Written by triggers, never by clients directly.

**template_items** — seed data for templates (Appendix A): `template`, `list`, `category`, `position`, `name`, `kind`, `quantity_needed`, `unit`, `display_qty`.

**push_tokens** — `user_id`, `token`, `platform`, `updated_at`.

**trip_member_prefs** — per-member per-trip notification overrides: `on_claims`, `day_before`, `daily_digest`.

---

## 4. Domain rules

Implement these as pure TypeScript functions in `src/domain` with thorough unit tests. Where the database must enforce a rule, also enforce it there.

**Coverage**

- `single` / `qty`: covered when the sum of claim quantities ≥ `quantity_needed`.
- `each`: covered when every active member has a claim.
- A buy item counts as **bought** when an expense links to it.

**Item status shown in lists** (Hebrew labels):

| State                               | Label                          | Color     |
| ----------------------------------- | ------------------------------ | --------- |
| Nobody took it                      | `חסר`                          | missing   |
| Partially claimed (qty)             | `חסר 1` / `חסרים N`            | missing   |
| `each`, not everyone                | `N מתוך M`, detail `עוד לא: …` | missing   |
| Claimed by me (single)              | `אצלך`                         | accent    |
| Covered by others (bring)           | `מכוסה`, detail `אצל רון`      | secondary |
| Claimed by others, not bought (buy) | `בטיפול`, detail `אצל רון`     | secondary |
| Bought                              | `נקנה`, detail `₪450, דנה`     | success   |

**Claiming**

- Over-claiming is rejected server-side: claim changes go through an RPC that locks the item row and checks the cap in one transaction.
- Claim actions: single → "אני אביא" / "אני אקנה" (claims the full quantity) and "ביטול"; qty → +/− stepper for my share; each → "יש לי" toggle.

**Money**

- Each expense is split equally among its share participants. Split agorot deterministically: integer division, then distribute the remainder one agora at a time to participants in a stable order (e.g. by user id).
- Balance(user) = paid − owed + payments sent − payments received. Positive means the group owes them.
- Suggested transfers: repeatedly match the largest debtor with the largest creditor (stable tie-break). Recompute from current balances, so recorded payments shrink the remaining suggestions.
- Display amounts as `₪90` (sign before number, no decimals when whole, one decimal otherwise in per-person previews).

**Filters on the list tabs:** `הכול` / `חסר` / `אצלי`, each with a count.

**Progress bar ("pegs"):** one segment per item, covered first, so it reads as a progress bar.

---

## 5. Security

Treat the invite link as a bearer capability and the database as the enforcement point.

- **RLS on every table.** Use stable `SECURITY DEFINER` helpers `is_active_member(trip_id)` and `is_organizer(trip_id)`; policies call them. Pending and removed members see nothing of the trip through normal table access.
- **All multi-step or privileged writes go through RPCs** (security definer, explicit checks, `search_path` pinned):
  - `create_trip(name, starts_on, ends_on, place_text, template)` → creates trip, organizer membership, items from `template_items`, random invite token.
  - `trip_preview(token)` → only name, dates, member count, missing count, and up to ~6 missing item names. Callable by anon. Used by the join page and link previews.
  - `join_trip(token, display_name)` → creates membership `active` or `pending` depending on `require_approval`. Idempotent for the same user.
  - `rotate_invite(trip_id)` → organizer only.
  - `set_claim(item_id, quantity)` → 0 deletes the claim; enforces the cap.
  - `set_arrived(item_id, arrived bool)`.
  - `approve_member`, `decline_member`, `remove_member`, `set_role` → organizer only. An organizer cannot remove the last organizer.
  - `mark_payment(trip_id, to_user, amount)`, `confirm_payment(payment_id)` (receiver only), `remind_payment(...)` (receiver only, rate-limited, e.g. once per 24h).
  - `duplicate_trip(trip_id, starts_on, ends_on)` → copies items (no claims, expenses, or payments) and re-invites the same members.
- **Invite tokens:** generated server-side with a CSPRNG, never derived from ids. Rotation replaces the token atomically. Rate-limit `join_trip` per IP/user in the Edge layer if abuse appears.
- **Storage:** receipts bucket is private (one per stage); object key `trips/{trip_id}/receipts/{expense_id}/{uuid}.{ext}`; images only (JPEG, PNG, WebP, HEIC), at most 10 MB, enforced by the presigned POST policy and checked again before the API attaches it. Only active members of that trip get upload forms or (5-minute) view links; deleting a receipt or its expense takes whoever added or paid it, or an organizer. The app shrinks photos on the device (long edge 2000px, JPEG 0.8) before uploading.
- **Anonymous users** are real users with full RLS; link Google/Apple to keep their data across devices.
- **Link previews** (WhatsApp shows OG tags): served by an Edge Function for `/j/{token}`, using only `trip_preview` data.
- Never put tokens, phone numbers, or other personal data in analytics or logs.

---

## 6. Realtime, offline, notifications

**Realtime.** On the trip screen, subscribe to changes for that trip on `items`, `claims`, `expenses`, `payments`, `trip_members` and invalidate the matching queries. Optimistic updates for claims and toggles.

**Offline (required for trip-day mode, nice everywhere).**

- Persist the query cache (AsyncStorage on native, localStorage on web).
- Mutations pause when offline and resume in order on reconnect. Show a "ממתין" chip on rows with queued changes and a dark "אין קליטה" banner with the queued count (see `OfflineV2`).
- On resume, a rejected claim (cap exceeded) rolls back and shows a short Hebrew message.

**Notifications** (Expo push, sent by an Edge Function triggered from `activity` inserts):

- Claims and new expenses (respect `notify_updates` and per-trip `on_claims` / `daily_digest`).
- Day-before reminder to everyone with what's still missing and what's on you (scheduled job, e.g. `pg_cron`).
- Settle-up reminders after the trip, and receiver-initiated "תזכורת".
- Pending join request → organizers.

---

## 7. Integrations

- **WhatsApp share:** `https://wa.me/?text=<encoded message + link>`. Default message: `מצטרפים לקמפינג בכנרת? כאן רואים מה כל אחד מביא ומה עוד חסר:` (trip name substituted). Also "העתקת קישור" and a QR code.
- **Bit / PayBox:** no public peer-to-peer API is assumed. Show the amount and the receiver's `payment_phone`, offer "copy amount", and an "תשלום ב-Bit" button that opens the app if a supported deep link exists (verify before shipping; otherwise hide the button and keep copy + mark-as-paid).
- **Sign in with Google / Apple:** the mockup buttons have dashed placeholder squares. Use each provider's official button assets and branding rules.

---

## 8. Screens and routes

Routes use Expo Router. Modal routes use sheet presentation. Every screen maps to a v1 mockup in `design/v1/screens/`; login, home and trip also have v2 references (`design/README.md`).

| Screen             | Route                                          | Mockup           | Notes                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login              | `/(auth)/login`                                | `LoginV2`        | Google, Apple, link to "מצטרפים בלי חשבון" (join page), terms/privacy links.                                                                                                                                                                        |
| My trips           | `/(app)/`                                      | `HomeV2`         | Upcoming trips as illustrated cards with countdown, progress pegs, missing count, avatars, "אצלך: …". Past trips list (opens summary). Floating "טיול חדש".                                                                                         |
| My trips, empty    | same route, empty state                        | `FirstHomeV2`    | 3-step explainer, "הדבקה" for an invite link from the clipboard, "פתיחת טיול ראשון".                                                                                                                                                                |
| Profile            | `/(app)/profile`                               | `ProfileV2`      | Stats, payment phone, notification switches, language, sign out, delete account.                                                                                                                                                                    |
| New trip           | `/(app)/trips/new`                             | `NewTripV2`      | Live cover preview updates with name and template; template tiles; name, dates, optional place; preview of what goes into the lists.                                                                                                                |
| Trip               | `/(app)/trips/[tripId]`                        | `TripV2`         | Cover with back, activity (unread dot), settings, invite. Status card: big missing count, covered text, avatar stack, pegs. Floating glass tab bar: להביא / לקנות / אנשים / כסף with missing badges. FAB per tab → add item / invite / add expense. |
| Item sheet         | `/(app)/trips/[tripId]/items/[itemId]` (modal) | `ItemSheetV2`    | Status, release/claim, price entry (creates/updates the linked expense), who shares (chips), live per-person amount, note, mark bought, delete.                                                                                                     |
| Add item           | `/(app)/trips/[tripId]/items/new` (modal)      | `AddItemV2`      | List segmented control, name + quick suggestions, kind (אחד / כמות / לכל אחד) with quantity stepper, category chips, "אני אביא את זה" switch.                                                                                                       |
| Add expense        | `/(app)/trips/[tripId]/expenses/new` (modal)   | `AddExpenseV2`   | Amount, description with shortcuts from the buy list, who paid, who shares, receipt photo.                                                                                                                                                          |
| Invite             | `/(app)/trips/[tripId]/invite` (modal)         | `InviteV2`       | WhatsApp preview card, editable message, share / copy / QR, approval switch, rotate link.                                                                                                                                                           |
| Activity           | `/(app)/trips/[tripId]/activity`               | `ActivityV2`     | "מחכה לך" to-dos (unpriced purchases, money you owe), filter הכול / פריטים / כסף, timeline grouped by day.                                                                                                                                          |
| Trip settings      | `/(app)/trips/[tripId]/settings`               | `TripSettingsV2` | Details (place shows "בקרוב: עזרה בבחירת מקום"), money, permissions, per-trip notifications, participants row with pending badge, invite link, leave / delete trip.                                                                                 |
| Participants       | `/(app)/trips/[tripId]/participants`           | `ParticipantsV2` | Pending requests (approve / decline), member list with expandable actions (make organizer, remove).                                                                                                                                                 |
| Trip day           | `/(app)/trips/[tripId]/arrivals`               | `OfflineV2`      | "מה הגיע?" checklist split into "עוד בדרך" and "הגיעו"; offline banner and queued state. Linked from the trip screen during trip dates.                                                                                                             |
| After the trip     | `/(app)/trips/[tripId]/summary`                | `TripSummaryV2`  | Settle-up progress, transfers with status, reminder / confirm actions, stats, highlights, duplicate trip, archive.                                                                                                                                  |
| Join (web)         | `/j/[token]`                                   | `JoinV2`         | Public. Cover, who's in, what's missing, name field, "הצטרפות לטיול".                                                                                                                                                                               |
| Join pending (web) | `/j/[token]/pending`                           | `JoinPendingV2`  | Three-step progress, missing preview, app download prompt; updates live when approved.                                                                                                                                                              |

---

## 9. Design system

Design system v2: [`design/DESIGN.md`](design/DESIGN.md) is the brand book and [`design/tokens/`](design/tokens/) the token source; the app's tokens are `apps/mobile/src/theme`. [`design/README.md`](design/README.md) maps reference screens to routes, lists where the app's token names differ, and what changed from v1. Every touch target ≥ 44×44; screen side padding 16.

**Hebrew copy rules**

- Gender-neutral by construction: first-person future for actions ("אני אביא", "אני אקנה"), possession phrasing for status ("אצל רון", "אצלך"), noun phrases for events ("מנגל אצל רון", "אלון בפנים", "נקנה: בשר לעל האש"), plural for unknown third parties ("ביקשו להצטרף"). Use the slash form only for role labels ("מארגן/ת").
- Use `״` and `׳` for gershayim/geresh (ק״ג, סכו״ם).
- Pluralize counts correctly: `חסר 1` vs `חסרים 3`, `פריט אחד עוד חסר` vs `11 פריטים עוד חסרים`.

---

## 10. Design reference

`design/reference/screens/*.html` are static v2 screens; open them at 390px wide. `design/v1/screens/*.dc.html` are the 17 v1 mockups, superseded for look. They use a small templating layer that won't run standalone; read them for Hebrew copy, sample data and interaction details. Do not port the markup; rebuild with React Native components and the theme tokens.

---

## 11. Build plan

Each phase should land as one or a few small PRs and leave the app working.

**Phase 0 — Foundation.** Expo + Router + TypeScript strict, lint/format/test tooling, CI. Theme tokens, fonts, RTL setup (native + web). Supabase local project. Shared components from section 9 with a simple preview screen. Cover scenes from Appendix B.
_Done when:_ the app boots on iOS, Android and web in RTL with both fonts, and component previews match the mockups.

**Phase 1 — Data layer.** Migrations for section 3, RLS, the RPCs in section 5, `template_items` seed (Appendix A), activity triggers. Database tests for every policy and RPC, including: non-member cannot read, pending member cannot read, over-claim rejected, rotated token rejected, last organizer cannot be removed.
_Done when:_ all database tests pass locally and in CI.

**Phase 2 — Auth and profile.** Anonymous sign-in, Google and Apple sign-in, linking an anonymous account, profile screen.

**Phase 3 — Trips.** New trip (with live cover preview), My trips (both states), trip screen with lists, status card, filters, tab bar, read-only first.

**Phase 4 — Claiming and realtime.** All claim interactions, optimistic updates, realtime sync between two devices.

**Phase 5 — Items.** Add item sheet, item sheet, delete, quick suggestions.

**Phase 6 — Invite and join.** Invite sheet, WhatsApp share, QR, rotation, approval switch; web join page and pending page with OG previews; participants screen.

**Phase 7 — Money.** Add expense, price from the item sheet, shares, balances, suggested transfers, mark paid / confirm / remind. Domain unit tests for splitting and transfers (including remainders and exclusions).

**Phase 8 — Activity and push.** Activity feed and to-dos, push tokens, Edge Function sender, day-before reminder.

**Phase 9 — Offline and trip day.** Persisted cache, paused mutations, offline banner, "ממתין" chips, arrivals checklist.

**Phase 10 — After the trip.** Summary, highlights, duplicate trip, archive.

**Later.** Help choosing a place (the settings screen already teases it), more templates, more languages.

---

## 12. Open questions

Ask before deciding these:

- App name and domain (mockups use placeholders like "[הדומיין של האפליקציה]").
- Whether Bit and PayBox offer usable deep links for payment.
- Default quantities: fixed per template (Appendix A) or scaled by member count?
- Account deletion: what happens to the user's claims and expenses in shared trips (anonymize vs. remove)?
- Terms of use and privacy policy content.

---

## Appendix A — Template contents

`kind` defaults to `single`. Quantities are defaults the organizer can edit.

**camp (קמפינג)**

- bring / בישול ועל האש: מנגל; פחמים (qty 2, unit שקים); גזייה ובלון גז; צידניות (qty 2); מלקחיים; קרש חיתוך וסכין; סיר ומחבת
- bring / לינה וישיבה: אוהלים (qty 4); שק שינה (each); מזרן (each); פנס ראש (each); כיסאות מתקפלים (qty 8); צילייה
- bring / כללי: רמקול; ערכת עזרה ראשונה; שקיות זבל
- buy / בשר: בשר לעל האש (display 4 ק״ג); נקניקיות (display 2 חבילות)
- buy / לחם וסלטים: פיתות (display 40); סלטים ומטבלים
- buy / שתייה: מים (display 6 שישיות); בירות ושתייה קלה
- buy / ארוחת בוקר: ביצים (display 30); קפה וחלב

**grill (על האש)**

- bring / על האש: מנגל; פחמים (qty 2, unit שקים); מלקחיים; מפוח למנגל; צידניות (qty 2)
- bring / ישיבה: כיסאות מתקפלים (qty 8); מחצלת; צילייה
- bring / כללי: רמקול; שקיות זבל; צלחות וסכו״ם
- buy / בשר: בשר לעל האש; פרגיות
- buy / לחם וסלטים: פיתות; סלטים ומטבלים; ירקות
- buy / שתייה: שתייה; קרח

**zimmer (צימר)**

- bring / כללי: משחקי קופסה; רמקול; מגבת (each); בגד ים (each)
- buy / ארוחת בוקר: לחמים ומאפים; גבינות וממרחים; ביצים; ירקות; פירות; קפה וחלב
- buy / ערב: בשר לערב; פחמים; יין; נשנושים

**beach (יום בחוף)**

- bring / צל וישיבה: צילייה; מחצלות (qty 2); כיסאות חוף (qty 6)
- bring / כללי: צידנית; מטקות; רמקול; קרם הגנה; מגבת (each); שקיות זבל
- buy / אוכל: אבטיח; כריכים; חטיפים; פירות
- buy / שתייה: מים; שתייה קלה; קרח

**blank** — no items.

Quick-add suggestions in the add-item sheet: bring → מלקחיים, קרש חיתוך, צלחות וסכו״ם, מטקות, גפרורים; buy → קרח, לחמניות, ירקות לסלט, מרשמלו, חטיפים.

---

## Appendix B — Cover scenes

Flat layered illustrations, `viewBox="0 0 390 300"`, rendered with `preserveAspectRatio="xMidYMid slice"` (covers) so they crop instead of stretch. Build each as a `react-native-svg` component. Text over covers is white and sits on the darker lower part of the scene.

**camp** (Kinneret at dusk; also the default brand scene on login and join)

```svg
<rect width="390" height="300" fill="#FFB774"/>
<circle cx="268" cy="118" r="48" fill="#FFE39B"/>
<path d="M0 168 C70 138 128 152 190 136 C250 121 310 146 390 128 L390 300 L0 300 Z" fill="#B07CC6"/>
<path d="M0 196 C80 170 150 188 220 172 C290 157 340 182 390 170 L390 300 L0 300 Z" fill="#7A55B5"/>
<rect y="206" width="390" height="94" fill="#2F4FD8"/>
<path d="M232 222 h72 M246 236 h44 M256 250 h24" stroke="#FFE39B" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
<path d="M0 262 C90 248 170 272 260 256 C320 246 360 258 390 252 L390 300 L0 300 Z" fill="#1F1752"/>
<path d="M44 264 L84 214 L124 264 Z" fill="#FFCF3F"/>
<path d="M84 264 L84 232 L100 264 Z" fill="#E8590C"/>
```

**grill** (forest with a grill)

```svg
<rect width="390" height="300" fill="#BDE5CF"/>
<circle cx="110" cy="96" r="38" fill="#FFF1B8"/>
<path d="M0 190 C80 160 160 180 240 160 C300 146 350 168 390 158 L390 300 L0 300 Z" fill="#5FAF84"/>
<path d="M40 232 L70 150 L100 232 Z M250 226 L285 132 L320 226 Z M312 234 L340 166 L368 234 Z" fill="#1F6B4A"/>
<path d="M0 236 C100 220 200 244 300 228 C340 222 370 230 390 226 L390 300 L0 300 Z" fill="#123F2C"/>
<path d="M168 212 h60 l-8 16 h-44 z" fill="#0E1726"/>
<path d="M184 228 l-6 18 M212 228 l6 18" stroke="#0E1726" stroke-width="4" stroke-linecap="round"/>
<path d="M188 200 c-8 -12 8 -18 0 -30 M208 196 c-8 -12 8 -18 0 -30" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.85"/>
```

**zimmer** (Galilee hills with a house and cypresses)

```svg
<rect width="390" height="300" fill="#FFCDB2"/>
<circle cx="300" cy="90" r="34" fill="#FFF0C2"/>
<path d="M0 170 C90 140 170 160 250 140 C320 124 360 140 390 134 L390 300 L0 300 Z" fill="#D9936A"/>
<path d="M0 214 C100 190 190 210 280 192 C330 182 370 192 390 188 L390 300 L0 300 Z" fill="#A8613F"/>
<path d="M150 216 L150 178 L185 152 L220 178 L220 216 Z" fill="#FFF6EC"/>
<path d="M140 182 L185 146 L230 182 L222 186 L185 157 L148 186 Z" fill="#E8590C"/>
<rect x="176" y="192" width="18" height="24" fill="#7A3E12"/>
<path d="M100 218 C96 198 98 178 104 164 C110 178 112 198 108 218 Z M262 212 C258 192 260 174 266 160 C272 174 274 192 270 212 Z" fill="#3F5E3A"/>
<path d="M0 246 C120 232 230 254 390 236 L390 300 L0 300 Z" fill="#5E3423"/>
```

**beach** (sea, sand, umbrella)

```svg
<rect width="390" height="300" fill="#A8DBF7"/>
<circle cx="90" cy="88" r="40" fill="#FFE39B"/>
<rect y="160" width="390" height="70" fill="#1E88D6"/>
<path d="M20 180 q15 -8 30 0 t30 0 M220 194 q15 -8 30 0 t30 0 M120 210 q15 -8 30 0 t30 0" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.85"/>
<path d="M0 222 C100 210 220 232 390 214 L390 300 L0 300 Z" fill="#F2C879"/>
<path d="M270 262 L282 194" stroke="#0E1726" stroke-width="4" stroke-linecap="round"/>
<path d="M232 196 C246 158 318 158 332 196 Z" fill="#E8590C"/>
<path d="M266 196 C270 166 294 166 298 196 Z" fill="#FFF6EC"/>
```

**blank**

```svg
<rect width="390" height="300" fill="#DDE3F8"/>
<rect x="110" y="70" width="170" height="26" rx="13" fill="#FFFFFF"/>
<rect x="110" y="110" width="130" height="26" rx="13" fill="#FFFFFF"/>
<rect x="110" y="150" width="150" height="26" rx="13" fill="#FFFFFF" opacity="0.6"/>
```

The beach scene's sand is light, so on that cover put the title on a dark glass panel (as `NewTripV2` does) instead of directly on the scene.
