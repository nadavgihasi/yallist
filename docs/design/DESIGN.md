# Yallist

![Yallist](brand/logo/yallist-lockup.svg)

Yallist is a group-trip app for Israel: one shared list for who brings what and what still needs buying. It is Hebrew-first and right-to-left, warm, quick, and a little playful, like the WhatsApp group it replaces.

**The look in one line.** Warm paper, night ink, and one orange spark: the app looks like its own logo (an orange mark beside ink letters) and like the sunset in its illustrations, not like a blue web app.

## Voice

- **Hebrew first, said the way friends say it.** Plural present tense, not commands: “פותחים טיול, שולחים קישור לחברים”, not “פתח טיול”. Buttons are nouns of action: “פתיחת טיול ראשון”.
- **Short.** Titles run to four words, and explanations take one line. The three-step explainer is the model: a bold item-title, then one caption.
- **Real trip stuff in examples.** Hummus ×3, a tent, a speaker, ice. Never lorem ipsum.
- **English mirrors the same tone**: “Who’s bringing what?”, not “Manage your trip inventory.”

## Logo

The Check-Y is a Y whose arms form a checkmark, and it *is* the Y of the name. The lockup reads “[mark]allist”. Never set the mark next to the full word “yallist”, which doubles the y.

| Use | File |
|---|---|
| Light backgrounds | `yallist-lockup.svg`: orange mark, ink letters |
| Dark backgrounds | `yallist-lockup-reversed.svg`: orange mark, white letters |
| In-app and web favicon | `yallist-icon.svg`: orange tile, white mark |
| App Store / Play Store | `yallist-app-icon-fullbleed.svg`: square, because the OS applies its own corner mask |
| Tight spots, avatars, loaders | `yallist-mark.svg` |

- **Clear space.** Keep at least half the mark’s height free on every side of the lockup.
- **Minimum sizes.** The icon works down to 24px. Keep the lockup at least 24px tall.
- **Live reference.** The Logo card below shows both lockups, the icon at real sizes and the clear-space zone, all drawn from the files in Logos.
- **Don’ts.** Don’t recolor the mark, add shadows, or retype the letters. The wordmark is Rubik Bold, outlined in the files.

## Color

Three roles, each with one job:

- **Paper (`surface`, `primary-tint`, `line`, `hairline`) is the place.** The page is warm paper, cards are white on it with a `hairline` outline, and sand (`primary-tint`) is the quiet fill for tonal buttons, step circles and tips. No cold grays.
- **Night ink (`ink`, `primary`) means *read this* and *do something*.** It is one color: headings, solid buttons, selected chips and tabs, links. What tells a button from text is its shape, never a second hue.
- **Brand orange (`brand`) is the spark.** It is the logo, a done check, progress, and the icon on the floating button: orange on night, the same pair as the mark beside the wordmark. One spark per view is enough. Never an orange button fill, and never orange text; `brand-strong` is the orange that can be read (“אצלך”, errors, delete).
- **Illustration.** The `illo-*` sunset palette is for illustrations, trip tiles and covers only. With the UI down to paper, ink and orange, they carry the color.

**Contrast to watch.** `brand` on white is 3.1:1, which is fine for the logo and icons but not for text; use `brand-strong` (5.9:1 on card, 5.2:1 on paper). `brand` on `primary` is 5.5:1. Placeholders (`ink-faint`) are 3.3:1 on card and are never the only label.

## Type

Two families. **Suez One** sets the titles (`page-title`, `section-title`): one weight, a warm slab with Hebrew and Latin, and the part of the type that is recognizably Yallist. **Rubik** sets everything else: 800 for numbers and stats, 700 for item titles, labels and buttons, 400 for reading. Numbers are always Rubik, with tabular digits where they change: Suez One has old-style digits, which read badly in counts and prices. Load both with `@expo-google-fonts`, one file per weight.

## Layout

- **One column, at most `content-max` (448px)**, centered on web. The screen is a stack of cards on `surface` with `space-4` between them.
- **Cards** use `card` on `surface`, `radius-card`, `space-5` padding, a 1px `hairline` outline, and no shadow.
- **One floating primary action per screen**, bottom-centered, `space-6` from the edge, with `shadow-float`. Only what floats has a shadow (this button and the toast).
- **RTL is the default.** Lay out with start/end, never left/right (`paddingStart`, `marginInlineStart`). The page title sits at the start (right) and the avatar at the end.
- **Touch targets** are at least 44px (`size-avatar`, `size-button-sm`).

## Iconography

Icons are a rounded stroke on a 24px grid (Lucide), in the color of the text beside them. The one exception is the icon on the floating button, which is `brand`. Icons sit before their label, so they land on the right in RTL. No emoji as icons.

## Components

Logo, Header, Button, Card, Steps and Avatar are specified below, and each has a static preview in `reference/components/`. The empty-state illustration is a separate asset to export from the code. It is not reproduced here.

### Logo

The Yallist logo: the orange Check-Y mark standing in for the Y, followed by “allist” in outlined Rubik Bold.

| Where | File | Notes |
|---|---|---|
| Light grounds (`surface`, `card`) | `yallist-lockup.svg` | Orange mark, `ink` letters |
| Dark grounds (`ink` or photos) | `yallist-lockup-reversed.svg` | Orange mark, white letters |
| In-app tile, web favicon | `yallist-icon.svg` | `brand` tile, `radius-icon` corners, white mark |
| App Store / Play Store | `yallist-app-icon-fullbleed.svg` | Square. Export it at 1024×1024 for iOS; on Android use the white mark as the adaptive foreground over a `brand` background |
| Loaders, tiny spots | `yallist-mark.svg` | The mark alone, `brand` only |

- **Clear space:** half the mark’s height on every side, shown as the dashed zone in the preview.
- **Minimums:** the icon at 24px, the lockup at 24px tall.
- **Never** set the mark beside the full word “yallist”, retype the letters, recolor the mark, or add shadows or outlines.
- The logo is the only place `brand` appears at full size. On screens it is a spark: a check, a ring, one icon.

The consumer provides only placement and size, because the files are final artwork.

### Header

The screen header: a page-title at the start edge and the account avatar at the end.

- Title in `page-title`, `ink`. One per screen and no subtitle; context goes in the first card.
- The avatar is the Avatar component at `size-avatar` and opens the account menu.
- The row is `space-between` with `space-4` above it and `space-4` down to the first card, inside the `content-max` column.
- In RTL the title is on the right. Build with start/end so it flips by itself.

The consumer provides the title text and the user’s initial.

### Button

Pill buttons in two strengths: the floating primary for the one main action on a screen, and the tonal pill for secondary actions inside cards.

| Variant | Height | Fill | Label | Use |
|---|---|---|---|---|
| Floating primary | `size-button-lg` | `primary` + `shadow-float` | `button-lg` in `on-primary`, icon in `brand` | The screen’s one main action, bottom-centered, `space-6` from the edge |
| Tonal | `size-button-sm` | `primary-tint` | `button-sm` in `primary-strong` | Secondary actions inside a card, such as “טיול לדוגמה” |

- Both use `radius-pill` and the Rubik label, with no border.
- The icon comes before the label (`space-3` gap), so it sits on the right in RTL. It is a rounded stroke in the label color; on the floating button it is `brand`.
- Labels are actions as nouns (“פתיחת טיול ראשון”), at most three words.
- Never more than one floating primary per screen, and never an orange fill.

The consumer provides the label, an optional leading icon, and the press handler.

### Card

The white card is Yallist’s only container: every block of content on a screen is one card on `surface`.

- `card` fill, `radius-card` corners, `space-5` padding, a 1px `hairline` outline, no shadow. Cards stack with `space-4` between them inside the `content-max` column.
- **Text card:** a `section-title` in `ink`, then `space-3`, then `body` in `ink-muted`.
- **Action row:** an `item-title` and `caption` at the start, with a tonal Button at the end, vertically centered.
- **Illustrated card:** the illustration bleeds to the card edges at the top, sharing the top `radius-card` corners, with the text card content below it. Illustrations use only `illo-*` colors.

The consumer provides the content. A card never nests another card.

### Steps

A numbered how-it-works list inside a card: a circled numeral at the start, then a bold title and a one-line caption.

- Circle is `size-step`, `primary-tint` fill, `radius-pill`. The numeral is `step-number` in `primary`, which passes as large text.
- Title in `item-title`/`ink`, caption in `caption`/`ink-muted`, with `space-1` between them. The circle sits `space-4` from the text.
- Rows are `space-6` apart. Use three steps; four at most.
- Write each step as a plural-present action plus its payoff: “שולחים קישור בוואטסאפ / החברים מצטרפים מהדפדפן”.

The consumer provides the ordered items (title and caption). Numbering is automatic.

### Avatar

A circular initial badge for a trip member, used in the header for the signed-in user.

- `size-avatar`, `radius-pill`, `primary` fill, the initial in `on-primary` at 18px/800.
- Show the first letter of the Google display name, in whatever script the name uses (Hebrew or Latin).
- As a button it needs an `aria-label` (“החשבון שלי”), because the letter alone says nothing.

The consumer provides the member’s display name.
