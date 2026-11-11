# My bag (התיק שלי)

What a person always has at home, kept once in their profile, so every trip marks it by itself and all that's left is packing. The design is the "Yallist — My Bag" canvas (seven phone screens: profile, the bag, a trip's per-person and common items, and the end of a trip).

## Rules

1. The bag lives in the profile (פרופיל › התיק שלי): items with a name and a quantity (at least 1). At 1, the minus button removes the item.
2. A bag item matches a trip's bring item by exact name.
3. **Per-person items** (`each`) in my bag are mine without any action: the row says "בתיק שלך" and has no "יש לי" button; tapping the ring packs it. The list's top says how many the bag marked and that only packing is left.
4. Per-person items not in my bag: "יש לי" marks them for this trip only; the bag doesn't change.
5. **Common items** (`single`, `qty`) are never assigned by themselves. When some are in my bag and nobody brings them yet, one card offers them: "הכול עליי" takes all, "בוחרים" opens a sheet with a checkbox per item (all checked), and X hides the card for this trip (on this device). An item anyone took, even in part, is never offered. A `qty` item takes as many as the bag has, up to what's needed ("יש לך 2 מתוך 4").
6. Once taken, they read "עליך · מהתיק", and a toast offers to undo.
7. **End of the trip:** a card offers to add what I brought (per-person items I marked "יש לי", common items I took) that isn't in my bag yet, one checkbox each, all checked; "לא עכשיו" hides it. Only ever a suggestion.
8. Editing the bag updates open trips, but never unpacks an item already packed. A trip that ended keeps what the bag held on its last day.

## How it's built

- `bag_items` (per user; removing sets `deleted_at`). API: `GET/POST /me/bag`, `PATCH/DELETE /me/bag/:id`. Adding skips names already in the bag; a change that adds or removes an item publishes a realtime event to each of the user's trips.
- Rule 3 isn't stored: loading a trip adds a claim with `fromBag: true` for each active member on each per-person bring item in their bag that they haven't claimed (`apps/api/src/dal/bag.ts`). So everyone sees them covered, and editing the bag changes every open trip at once. Packing stores a real claim; unpacking drops it again, back to the bag.
- Rules 5 and 7 are computed in the app from the bag and the trip (`bagSuggestions`, `broughtNotInBag` in `@yallist/domain`); taking items is an ordinary claim.
- Not built: the design's "יש לך X מתוך Y" for a per-person item the trip needs more of than the bag has. Per-person items have no quantity today, so it only applies to common `qty` items (rule 5).
