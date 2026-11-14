# Yallist UX review (interaction, flows, usability)

How I tested it: I ran the full stack locally (API `src/dev.ts` on Postgres 16 and a web export of the current tree) because the PR-156 preview returned CloudFront 502. Two guests, "דנה" (organizer) and "רון", went through these steps at 390x844: login, create trip, claim, add item, add expense, money, mark paid, invite, join, ניהול, profile, shopping run. The numbers in brackets refer to its 45 screenshots, kept out of the repo. Google sign-in was not configured locally, so I couldn't test it.

## 1. Top usability problems (ranked)

1. **The invite shares only a bare link.** (`features/trip/PeopleTab.tsx` `shareLink`, `lib/invite.ts`) "שיתוף הקישור" sends `{url}` and nothing else. Until M3's OG previews exist, the WhatsApp group gets `https://…/j/9mmW…` with no trip name and no explanation. SPEC §7 calls for "מצטרפים ל{trip}? כאן רואים מה כל אחד מביא ומה עוד חסר:". **Fix:** send the message and the link together (Android: `message` includes the url; iOS/web: `message` + `url`). Also add a separate "העתקת קישור" button. Today the link text in ניהול is truncated and can't be copied (15).
2. **Re-joining creates duplicate people.** (`app/j/[token].tsx`, guest sign-in) If you open the same link in a second browser (WhatsApp's in-app browser vs Chrome, another phone), you get a new guest. The trip then shows "דנה, רון ורון", "עוד לא: דנה, רון, רון", and in money "רון ← רון ₪40" with "להעביר לרון" (24, 39). You can't tell who owes whom. **Fix:** on join, if an active member already has the same name, ask "זה את/ה? / אני מישהו אחר". Organizers need a "merge/remove duplicate" action. Show something that tells people apart (avatar colour, "(הצטרף היום)").
3. **"הזמנת חברים" doesn't open an invite.** The trip has three invite affordances (header pill, hero pill, share icon), and the two invite pills only switch to the ניהול tab (`?tab=people`, 16). The user then has to find and tap "שיתוף הקישור". The share icon does something different: it opens WhatsApp in the same tab on web and navigates away from the app (16-shareMissing). **Fix:** the header and hero should open the share sheet directly (the M3 invite sheet later). On web, open `wa.me` in a new tab.
4. **The expense split defaults to only the payer when the form opens before trip data loads.** (`SharePicker.useShares` uses `useState(() => view.activeIds)`) Opening `/expenses/new` by reload or deep link gave "₪300 לכל אחד" / "1 מתחלקים". The money tab then said "כולם מסודרים" (34–36). **Fix:** derive the default once members load (or gate the form on `view`), and always show the split count next to the save button ("מתחלק בין 3").
5. **Expenses can't be opened and have an inline "מחיקה".** Rows aren't tappable (no edit, no detail), yet each row has a delete pill. An organizer can delete someone else's ₪120 with a two-tap inline confirm (40). **Fix:** tap a row to open a detail/edit sheet and move delete in there. Only the payer or an organizer should be able to delete, and the actor should be recorded.
6. **Settle-up stops at "סימון כשולם".** There's no payment phone of the receiver, no copy-amount button and no Bit/PayBox link on the debt card (39, 41). The phone field exists only in the profile. That's M1's "no copy-paste guessing", and it isn't done.
7. **New trip hides the name field.** The name is the 4th section, below the fold. Tapping the sticky "יצירת הטיול" silently creates "הטיול שלנו" (07, 08). **Fix:** put the name first, autofocus it, and make the sticky button say "יצירת 'הטיול שלנו'" when the name is empty.
8. **The login demo card has a fake "עליי" button.** It's styled exactly like the real claim pill but does nothing (02). **Fix:** make it a non-button tag (outline/dashed), or let it animate the demo claim.
9. **Two progress numbers that don't agree.** The hero ring says "0/24" (whole trip) and the tab card says "0 מתוך 16 מסודרים". The "אצלי 3" filter is non-zero before you've claimed anything, because per-person items count toward it (09). **Fix:** label the ring "בכל הטיול". Only count per-person items in "אצלי" once they're marked "יש לי", or show them as "לכל אחד".
10. **No feedback after "הוספה לרשימה".** The sheet closes and the new item lands out of sight under "ללא קטגוריה" (32). In the sheet, the "אני אביא את זה" switch is half hidden behind the sticky CTA (30). **Fix:** show a toast with "הצגה", scroll to the item and add bottom padding. Quick suggestions should skip names that are already on the list ("קרש חיתוך" vs "קרש חיתוך וסכין").
11. **Packing has no visible affordance.** The only way to pack is tapping the ring (aria "סימון כארוז"). The item sheet has no "ארזתי" (11). Also, "ביטול" on a claimed row means "release the item" and is easy to read as "cancel". Rename it "לשחרר".
12. **Small items.** The FAB covers the last row's action button (10). The text "את/ה המארגן/ת היחיד/ה" uses slashes where neutral phrasing would read better ("אין עוד מארגנים בטיול"). The version line renders bidi-scrambled ("dev • dev-0.0.0").

## 2. Friction for newcomers (first run and join from invite)

- **The link arrives with no context** (problem 1). That's the biggest growth leak before M3.
- **The join page (21) is good:** cover, missing items, a name field, and "בלי הורדה ובלי סיסמה". It's missing **who invited you** and **who's already in** (the avatars it has data for). It shows "משתתף אחד" where "דנה מחכה לך" would be warmer.
- **The guest identity is tied to the browser, and nobody tells the newcomer.** The warning appears only in the profile ("הטיולים שמורים רק במכשיר הזה"). A newcomer who joined inside WhatsApp's browser will later open Chrome and land on the login page as a stranger, which causes problem 2. After join, show a one-time sheet: "שמרו את הטיול: הוספה למסך הבית / חיבור Google / פתיחה באפליקציה".
- **There's no orientation after join (22).** The newcomer lands on the trip with the hero showing "חסרים 23". Add a dismissible card: "שלום רון! קחו משהו מהרשימה" with the filter set to "חסר".
- **On first run:** "דרכים אחרות להיכנס" in the name step just goes back to the first screen when Google is unavailable (06). Hide it when there's nothing else to show. The empty home (05) lacks the planned "הדבקת קישור הזמנה", which matters for people who installed the app first. The FAB covers the template tiles.

## 3. UX requirements for upcoming milestones

**M2 – login/Google**

- Google linking must keep the guest's trips. Say so on the button ("הטיולים שלך יישמרו").
- Handle cancel, no network, and an account that's already linked to another guest (merge or choose; never silently lose trips).
- Busy state on the button. Errors shown inline, not just as a toast.
- Prompt to link at moments of value: after creating a trip, after the first expense, before sign-out (already there).
- The terms/privacy links must be reachable before signing in.

**M3 – invite sheet + join page**

- Sheet: an editable message with a live WhatsApp card preview, share/copy/QR, the approval switch explained in one line, and "rotate link" with a confirm that warns old links stop working.
- Join page:
  - who invited you, avatars, top 3 missing items and a name field.
  - "Open in app" only when the app is likely installed.
  - name prefilled for signed-in users, plus "not you?".
- States:
  - invalid or rotated link (exists, 23).
  - removed (exists).
  - trip ended ("הטיול הסתיים").
  - trip full or deleted.
  - offline with retry.
  - slow API: show a skeleton, not a spinner (20).
- Pending page: live approval, "שליחת תזכורת למארגן" via WhatsApp, safe to close and come back.
- OG card: name, dates, missing count, and no private data.

**M4 – activity/push**

- The permission ask comes after a meaningful action ("להודיע לך כשמישהו לוקח את המנגל?"), never on launch. Show a denied state with a path to settings.
- Per-trip mute, quiet hours, and batched claims ("רון לקח 4 פריטים").
- Every push deep-links to the exact item, debt or request, with a fallback when it no longer exists.
- Activity screen: an unread dot, the "מחכה לך" section first, plus empty ("עוד שקט פה") and loading states.
- Day-before reminder lists _your_ unpacked items, not the whole trip.

**M5 – offline, arrivals, summary**

- Offline state:
  - a persistent "אין קליטה · 3 ממתינים" banner.
  - a "ממתין" chip on each queued row.
  - never block the UI.
- Conflicts on reconnect (two people claim the last item) resolve with a visible "מישהו הקדים אותך" and no silent overwrite.
- Arrivals: one-tap toggles, large targets for outdoor use, and sort "עוד בדרך" by person. Show it only during trip dates, with the entry point in the hero.
- Summary: settle-up progress, one-tap reminders, and confirm received. "שכפול לטיול הבא" preselects people and lists, with new dates required. Duplicating with a guest or removed member must not re-add them silently.

## 4. Quick wins for M1 (S effort)

1. Put the message and link in the invite share. Add "העתקת קישור" and make the link text selectable.
2. Header and hero "הזמנת חברים" open the share directly. On web, `wa.me` opens in a new tab.
3. Fix the expense split default when data loads late, and show the split count on the save button.
4. Debt card: the receiver's phone, "העתקת סכום", and a nudge to add your own phone when someone owes you.
5. Duplicate-name warning on join ("כבר יש רון בטיול – זה את/ה?").
6. Turn the login demo "עליי" into a non-button.
7. Put the name field first in the new-trip form.
8. Toast after adding an item, and fix the bottom padding under the FAB and the sticky CTA.
9. Rename the claimed-row "ביטול" to "לשחרר". Add "ארזתי" to the item sheet.
10. One-time "save this trip" sheet after a guest joins.
