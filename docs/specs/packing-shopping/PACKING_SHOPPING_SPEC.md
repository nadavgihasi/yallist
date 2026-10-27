# Yallist — Packing & shopping runs

Implementation spec for two features on top of the existing app. It extends the original `SPEC.md`; where the two disagree, this file wins for these features.

Design references are in `design/`. The live, clickable canvas is at https://claude.ai/artifact/9vmhKwasFxhuYx8PBVKwP3 (page "Packing & shopping"). This document is the source of truth for behavior and data; the mockups are the source of truth for layout, copy and look.

---

## 0. Before you start

- **Read the repo first.** Look at the schema/migrations, the claims and expenses code, the Bring/Buy list screens, the theme tokens and the `he` strings file. Table, column and operation names in this spec are descriptive: map them onto what already exists and keep the semantics.
- **The backend is whatever the repo uses.** "Server operation" below means one transactional server-side write, such as a Postgres function/RPC or an API route that runs a single transaction. Never build these out of several client writes.
- **Copy is final Hebrew** and gender-neutral, following the conventions in `SPEC.md`. Put every string in the `he` locale file.
- **Money** is stored in agorot. Display it per `SPEC.md` (`₪90`, no decimals when whole).

---

## 1. What we're building

1. **Packing.** People commit to bring things ("עליי"), but nothing tracks whether those things are actually in their bag, and personal stuff (sunscreen, a charger) has no home at all.
   **Solution:** a _packed_ step on every claim, plus **התיק שלי** (My bag), one checklist per person of everything they physically need to bring.
2. **Shopping.** One person usually buys many items in a single supermarket trip. Today that means claiming each item and entering a price per item.
   **Solution:** a **shopping run**. You claim many buy items in one tap, check them off in the store, and enter one total at the till.

Each was chosen from three alternatives. The rejected shopping alternatives are in `design/alternatives/` for context only. **Do not build them.**

---

## 2. Decisions

**Packing**

- Packed is a state on a claim, not a separate list. A claim goes from _claimed_ to _packed_.
- Only the claim's owner can mark it packed or unpacked.
- Packed covers the whole claim, not each unit. Claiming 3 chairs means one tick.
- Raising a claim's quantity clears packed. Lowering it keeps packed. Deleting the claim removes the state with it.
- A bought buy item lands in the buyer's bag as unpacked, because bought does not mean packed.
- The existing `claims.arrived_at` (trip-day mode in `SPEC.md`) stays as specified and is independent of packed. Don't change it here (see open question 1).

**My bag**

- My bag has two sections, split by visibility:
  - **"לקבוצה"** holds all my claims on shared items: bring items of every kind, plus buy items once they're bought.
  - **"רק שלי"** holds my private items.
- **Private items** are visible only to their owner, and this is enforced at the data layer. They never count toward coverage, progress, filter counts, activity, previews or notifications.
- Private items are created only from My bag.
- **הקבועים שלי** (my essentials) is a per-user list. It is copied in as private items to every trip the user creates or joins.

**Shopping run**

- There is at most one active run per user per trip.
- A finished run creates exactly one expense, linked to every item bought in it.
- Items not checked off when the run finishes go back to the list, unclaimed.
- The run's expense uses the trip's default split, the same default the add-expense flow uses. It can be changed with the existing share picker before saving.

---

## 3. Data model changes

**claims**

- `packed_at timestamptz null`
- `run_id uuid null` references `shopping_runs(id)` on delete set null
- `in_cart_at timestamptz null`, which only has meaning while the run is active

**items**

- `private_owner_id uuid null` references the user. Null means a shared item.
- When it is set, the item must have `list = 'bring'`, `kind = 'single'` and `quantity_needed = 1`. Add a check constraint for this.

**shopping_runs** (new)

- `id`, `trip_id`, `shopper_id`
- `status`: `active | done | cancelled`
- `started_at`, `finished_at` (null), `expense_id` (null, references `expenses`)
- A unique partial index allows only one `active` run per (`trip_id`, `shopper_id`).

**expense_items** (new)

- Primary key (`expense_id`, `item_id`), plus a unique constraint on `item_id` so an item can be bought only once.
- Backfill from `expenses.item_id`, then switch every "is bought" read to `expense_items`.
- If `expenses.item_id` is referenced in many places, keep writing it for single-item expenses in this work and drop it in a follow-up.

**user_essentials** (new)

- `id`, `user_id`, `name`, `position`, `created_at`
- Unique on (`user_id`, `lower(name)`)

**Access rules.** Enforce these in the data layer (RLS or API checks), not only in the UI.

- **Private items and their claims:** only `private_owner_id` can select, insert, update or delete them. This also applies to realtime: other members must never receive change events for private items.
- **`packed_at` and `in_cart_at`:** only the claim's user can change them, and only through the operations in section 4.
- **`shopping_runs`:**
  - Readable by active trip members, so everyone can see who is shopping.
  - Writable only through the operations below, and only by the shopper.
- **`user_essentials`:** owner only.

---

## 4. Server operations

Every operation runs in one transaction and checks that the caller is an active member of the trip.

| Operation                                                                     | Behavior                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_packed(item_id, packed)`                                                 | The caller must own a claim on the item. Sets or clears `packed_at`.                                                                                                                                                                                              |
| `set_claim` (existing)                                                        | Add one rule: if the new quantity is greater than the old one, clear `packed_at`.                                                                                                                                                                                 |
| `add_private_item(trip_id, name, save_as_essential)`                          | Inserts an item with `private_owner_id = caller` and a claim (quantity 1) for the caller. If `save_as_essential` is true, upserts the name into `user_essentials`.                                                                                                |
| `start_shopping_run(trip_id, item_ids[])`                                     | Reuses the caller's active run in this trip, or creates one. Locks each item row, then claims every **eligible** item: quantity = `quantity_needed`, with `run_id` set. Returns the run plus `skipped[{item_id, claimed_by}]`. Emits activity `shopping_started`. |
| `add_to_run(run_id, item_id)`                                                 | Same eligibility check, for one item.                                                                                                                                                                                                                             |
| `set_in_cart(item_id, in_cart)`                                               | The caller owns the claim and the claim is in an active run.                                                                                                                                                                                                      |
| `finish_shopping_run(run_id, amount_agorot, share_user_ids[], receipt_path?)` | See below.                                                                                                                                                                                                                                                        |
| `cancel_shopping_run(run_id)`                                                 | Deletes the run's claims and sets the run to `cancelled`.                                                                                                                                                                                                         |
| `set_essentials(names[])`                                                     | Replaces the caller's essentials. Array order sets `position`.                                                                                                                                                                                                    |

**Eligible item:** a shared buy item that is not deleted, not bought, and has no claims.

**`finish_shopping_run`**

1. Requires at least one in-cart claim. Requires `0 < amount_agorot ≤ 10,000,000`. Every user in `share_user_ids` must be an active member.
2. Creates one expense:
   - `paid_by` = the shopper
   - `description` = `"קניות · {n} פריטים"`
   - the given amount, shares and receipt
3. Inserts an `expense_items` row for every in-cart item that isn't already bought. Clears `in_cart_at` on those claims and keeps the claims, because the shopper now brings those items.
4. Deletes the run's claims that are not in the cart, so those items return to the list.
5. Sets the run to `done` with `finished_at` and `expense_id`, and emits activity `shopping_finished` (count, amount).

**Changes to existing flows**

- **Removing a member:** also cancel that member's active runs.
- **`create_trip` and `join_trip`:** for each of the user's essentials, create a private item and its claim in the trip. Skip names the user already has as a private item there (case-insensitive).
- **`duplicate_trip`:** never copies private items.

---

## 5. Domain logic

Write these as pure functions in `src/domain`, with no React or backend imports, and unit-test them.

**`packingStatus(item, claims, activeMemberIds)`**

- `missing`: not covered, using the existing coverage rules.
- `covered`: covered, but not every claim is packed.
- `packed`: covered and every claim has `packed_at`.
- Also returns `packedCount` and `claimCount`, for "ארזו 2 מתוך 3" on `qty` and `each` items.

**`myBag(userId, items, claims, boughtItemIds)`** returns `{ group, mine, packed, total }`.

- `group`:
  - includes the user's claims on shared bring items of every kind, plus the user's claims on buy items that are bought
  - excludes unbought buy claims, which stay on the Buy tab until bought
- `mine`: the user's private items.
- **Order** within each section: unpacked first, then by item position.
- **Source label** per entry:

| Entry                    | Label                   |
| ------------------------ | ----------------------- |
| bring `single` / `qty`   | `עליך · מהרשימה`        |
| `each`                   | `אחד לכל אחד · מהרשימה` |
| bought                   | `קנית · מהקניות`        |
| private, from essentials | `מהקבועים שלך`          |
| other private            | no label                |

Append ` · ארוז` to the label when the entry is packed.

**Other functions**

- **`listProgress(items, claims)`** (Bring tab) returns `{ covered, total, packed }` and ignores private items.
- **`runSummary(claims, items)`** returns `{ inCart, notInCart }`.
- **`perPersonPreview(amountAgorot, shareCount)`** reuses the existing agorot split and returns the largest share.
- **`suggestions(currentTripItems, pastPrivateItemNames)`** returns up to 3 names:
  - taken from the user's private items on past trips
  - excluding names already in this trip or in essentials (case-insensitive)
  - most frequent first

---

## 6. Screens

Use the existing theme tokens. Color rules from the design system:

- Blue means tappable.
- An orange check means packed or bought.
- Never use an orange button.
- Touch targets are at least 44px.

### 6.1 Shared lists (Bring and Buy tabs)

**Leading circle on each item**, from `packingStatus`:

- **Dashed ring:** missing.
- **Solid ring:** covered or claimed, but not packed.
- **Orange filled check:** packed.

**On my own claim**, the circle is a 44px toggle button with `aria-pressed`. Its label is "סימון כארוז" or "סימון כלא ארוז". On anyone else's item it is not interactive.

**Detail line**

- My claims: `עליך` or `עליך · ארוז`.
- Others' claims: the existing `אצל רון`, plus ` · ארוז`.
- Partly packed: ` · ארזו 2 מתוך 3`.

**Progress and status**

- **Bring tab progress card:** keep the existing "14 מתוך 20 מסודרים" and add a line "9 ארוזים".
- **Buy tab:** a bought item shows ` · ארוז` once it's packed.

### 6.2 התיק שלי — `design/PackMyBag.dc.html`

- **Switcher:** add a third segment to the list switcher: `מביאים · N | קונים · N | התיק שלי`.
- **Progress card:** `ארזת {packed} מתוך {total}` with the orange bar. The trailing text is `יוצאים {day} ב־{time}` when the trip has a start time; otherwise it shows the date.
- **"לקבוצה" card**, captioned `הקבוצה רואה מה ארוז`. Each row has the toggle circle, the name (with `×{q}` for `qty` claims) and the source label.
- **"רק שלי" card**, with a lock icon and the caption `גלוי רק לך`. Rows look the same. Deleting uses the app's existing delete pattern.
- **"אולי גם" chips**, under "רק שלי":
  - up to 3 tonal chips, each `+ {name}`, from `suggestions`
  - tapping one calls `add_private_item`
  - the row is hidden when there are no suggestions
- **Essentials row**, last: `הקבועים שלי · {n}`, opens 6.4.
- **FAB:** `פריט לתיק`, opens 6.3.
- **Empty state:** `עוד לא לקחת כלום. בוחרים מהרשימה או מוסיפים משהו אישי.`

### 6.3 Add-to-bag sheet — reference: the lower half of `design/PackInline.dc.html`

- **Field** `מה לארוז?`: required, trimmed, 1–60 characters.
- **Switch** `להוסיף לקבועים שלי`, captioned `ייכנס לבד לכל טיול הבא`. Off by default.
- **Primary button:** `הוספה`.
- **Not in scope:** the mockup's `לכל הקבוצה / רק לי` segmented control. This sheet always creates private items.

### 6.4 הקבועים שלי — reference: the essentials card in `design/PackMode.dc.html`

- A simple list screen titled `הקבועים שלי`, captioned `נכנסים לבד לכל טיול חדש`.
- Rows can be deleted and reordered.
- An input and a `הוספה` button sit at the bottom.
- Edits don't touch existing trips.

### 6.5 Going-shopping sheet — `design/ShopRunPick.dc.html`

**Entry points on the Buy tab**

- A tonal button `יוצאים לקנות` at the top, shown when there is at least one eligible item and I have no active run.
- If I do have an active run, a banner `הקניות שלך פתוחות · {n} פריטים` replaces the button and opens 6.6.

**Sheet header**

- Title `יוצאים לקנות`, caption `מסמנים מה לוקחים, וכולם רואים שזה עליך.`
- `פנויים · {k} מתוך {n} נבחרו`, with a text button that reads `בחירת הכול` or `ניקוי`.

**Lists**

- Every eligible item is preselected. Rows are checkboxes showing the name and `display_qty`.
- `כבר של מישהו`: buy items someone else claimed but hasn't bought yet. They are disabled and show the claimer's avatar and name.

**Primary button:** `עליי · {k} פריטים`.

- When `k = 0` it is disabled and reads `בוחרים לפחות פריט אחד`.
- Tapping it calls `start_shopping_run` and opens 6.6.
- If any items were skipped, show a toast: `{item} כבר אצל {name}`.

### 6.6 In the store — `design/ShopRunCart.dc.html`

- **Header:** title `בסופר`, with the trip name as the subtitle. A pill with an orange dot reads `כולם רואים שהקניות האלה עליך`.
- **List card:**
  - shows `{c} מתוך {n} בעגלה` with a bar
  - rows are full-width buttons, at least 52px tall, that call `set_in_cart`
  - an in-cart row shows the orange check
- **Live additions:** while the run is active, new eligible items that others add appear as cards.
  - Each card reads `נוסף עכשיו ע״י {name}`, then the item and its quantity.
  - A tonal `גם עליי` button calls `add_to_run`.
  - Show the newest 3; each can be dismissed.
- **Deleted items:** items deleted by others drop out of the list.
- **FAB:** `סיימתי, לקופה`, opens 6.7.
- **Overflow menu:** `ביטול הקניות`, confirmed with `כל הפריטים יחזרו לרשימה`.
- **Offline:** this screen must work offline. `set_in_cart` goes through the existing offline mutation queue.

### 6.7 Finish sheet — `design/ShopRunDone.dc.html`

- **Title:** `כמה יצא בקופה?`. Field label: `סכום אחד לכל הקנייה`.
- **Amount input:** large, decimal, LTR, with a ₪ prefix. Accept both `,` and `.` as the decimal separator.
- **Receipt:** a tonal `צילום קבלה · לא חובה` button that uses the existing receipt upload.
- **Summary rows:**
  - Orange check: `{c} פריטים יסומנו כנקנו`, followed by the item names.
  - Dashed ring: `{names} חוזרים לרשימה` with `מישהו אחר יכול לקחת`. Shown only if something wasn't checked off.
  - Split: `₪{x} לכל אחד` with `מתחלק שווה בין {n} בטיול`, and a `שינוי` link that opens the existing share picker.
- **Primary button:** `שמירה`, calls `finish_shopping_run`.
  - If `c = 0`, show a disabled `אין פריטים בעגלה` and a text button `ביטול הקניות` instead.
  - While offline, queue the save like other mutations and label the run `ממתין לחיבור` until it syncs.

### 6.8 What others see

- **Buy tab banner:** the shopper's avatar and `{name} בסופר עכשיו · {n} פריטים`.
- **Items in someone's active run:** the detail line reads `{name} קונה עכשיו`.
- **Activity feed:**
  - `יציאה לקניות של {name} · {n} פריטים`
  - `הקניות של {name} הסתיימו · {n} פריטים · ₪{x}`

### 6.9 Notifications

- **Day before the trip:** if the recipient has unpacked bag entries, the existing `day_before` push says `מחר יוצאים · {n} דברים שלך עוד לא ארוזים`. Otherwise keep the existing text.
- **No push** for other people's packing, or for shopping starting or finishing. Those appear in the activity feed only.

---

## 7. Edge cases

**Shopping runs**

- **Two people start runs that include the same item at once.** The row lock gives the item to one of them. The other gets it back in `skipped`.
- **An item in a run is deleted.** Its claim cascades away and the item disappears from the store screen. If it was the only in-cart item, the finish sheet shows the `c = 0` state.
- **An in-cart item was already bought** through the single-item expense flow. `finish_shopping_run` skips it, because `expense_items` is unique per item.
- **A run stays open for days.** The banner stays for the shopper. There is no auto-expiry in v1.
- **The shopper is removed from the trip.** Their active runs are cancelled and the items return to the list.

**Packing**

- **`each` items:** `packedCount` counts active members' claims only.
- **Offline:** `set_packed` and `set_in_cart` are queued. The last write wins per claim.

**Private items**

- **Same name as a shared item:** allowed.
- **Leaving and rejoining a trip:** essentials are not duplicated, because the name check skips existing ones.

---

## 8. Build order

Ship each step as a small PR.

1. **Packed state:** migration, `set_packed`, the `set_claim` rule, `packingStatus`, `listProgress`, the circles, labels and Bring progress line.
   _Done when_ toggling my claim persists and reaches other members in realtime, other members can't toggle it, and raising the quantity clears packed.
2. **My bag and private items:** the `private_owner_id` and access rules, `add_private_item`, `myBag`, the third segment, and screens 6.2 and 6.3.
   _Done when_ another member can't read private items through any query or realtime channel, and private items affect no counts.
3. **Shopping runs:** `shopping_runs`, `expense_items` with its backfill, the run operations, `runSummary`, `perPersonPreview`, screens 6.5 to 6.8, and offline queueing.
   _Done when_:
   - concurrent starts never double-claim
   - finishing creates one expense linked to N items and balances update
   - unchecked items return unclaimed
   - cancelling releases everything
4. **Essentials, suggestions and the nudge:** `user_essentials`, `set_essentials`, the copy step in `create_trip` and `join_trip`, `suggestions`, screen 6.4 and the day-before text.
   _Done when_ a new trip arrives with my essentials in "רק שלי".

---

## 9. Tests

**Domain unit tests**

- Every function in section 5.
- Quantity-increase reset.
- The agorot split preview.
- `each` items with members joining and leaving.

**Data-layer tests**

- A member can't read or modify someone else's private items or their claims, including through realtime.
- A member can't set packed or in-cart on someone else's claim.
- Two concurrent `start_shopping_run` calls with overlapping items produce no double claims.
- `finish_shopping_run` creates exactly one expense and N `expense_items` rows, releases unchecked claims, and the balances reflect it.
- `cancel_shopping_run` releases all claims.

**UI:** check the RTL layout of My bag and the three run screens on a phone width and on web.

---

## 10. Open questions

Ask Nadav about these; don't guess. Use the default until he answers.

1. Keep `arrived_at` (trip-day mode) alongside `packed_at`, or drop it? _Default:_ keep both, independent.
2. Keep the `אצלי` list filter now that My bag exists? _Default:_ keep it.
3. Add a store name to runs (for example "רמי לוי") and use it in the expense description? _Default:_ no.
4. Should unbought buy claims appear in My bag? _Default:_ no.

---

## Appendix — design files

The `.dc.html` files are source from a design tool, not runnable pages. Use them like this:

- The markup and inline styles are the layout.
- `{{name}}` values come from `renderVals()` in the script block at the bottom of each file.
- `<sc-for>` is a loop and `<sc-if>` is a conditional.
- For the clickable version, open the canvas link at the top of this file.

| File                                      | Shows                        | Scope                                                           |
| ----------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| `design/PackMyBag.dc.html`                | התיק שלי tab                 | Build (6.2)                                                     |
| `design/PackInline.dc.html`               | Bring list with an add sheet | Only the sheet's name field, essentials switch and button (6.3) |
| `design/PackMode.dc.html`                 | Full-screen packing mode     | Only the "הקבועים שלי" card, as a style reference for 6.4       |
| `design/ShopRunPick.dc.html`              | Going-shopping sheet         | Build (6.5)                                                     |
| `design/ShopRunCart.dc.html`              | In the store                 | Build (6.6)                                                     |
| `design/ShopRunDone.dc.html`              | Finish sheet                 | Build (6.7)                                                     |
| `design/alternatives/ShopBaskets.dc.html` | Baskets by store             | Not chosen; context only                                        |
| `design/alternatives/ShopReceipt.dc.html` | Receipt matching             | Not chosen; context only                                        |
