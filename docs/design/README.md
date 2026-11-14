# Design

The current design is **design system v3**: warm paper, night ink, sunset violet for what you tap and orange for what's done, set in Rubik. It keeps v2's logo, components and layout, and changes what they are drawn with. The source of truth for values is `apps/mobile/src/theme`; [DESIGN.md](DESIGN.md) explains the rules.

| Path                                           | What it is                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [DESIGN.md](DESIGN.md)                         | The brand book: voice, logo, color roles, type, layout, icons, component specs (v3)               |
| [HANDOFF.md](HANDOFF.md)                       | The v2 handoff's task list, including the bring-list item states                                  |
| [tokens/](tokens/)                             | Tokens as JSON, TypeScript and CSS, at their v3 values. The app's copy is `apps/mobile/src/theme` |
| [brand/](brand/)                               | Logo lockups, icon tile, mark, and ready-made app icons (wired in `apps/mobile/app.json`)         |
| [icons/](icons/)                               | UI icons on a 24px grid (also in `apps/mobile/src/components/Icon.tsx`)                           |
| [reference/screens/](reference/screens/)       | Static HTML of the target screens, in v2 colors. Open them in a browser at 390px wide             |
| [reference/components/](reference/components/) | Static previews of Logo, Header, Button, Card, Steps and Avatar                                   |
| [v1/](v1/)                                     | **Superseded.** The 17 v1 mockups (`*.dc.html`); still the reference for copy and behavior        |

## Screens → routes

| Reference                      | Route                   | Notes                                                                                    |
| ------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| `reference/screens/login.html` | `/(auth)/login`         | Lockup, “מי מביא מה?”, a sample list card, sign-in at the bottom                         |
| `reference/screens/trips.html` | `/(app)/` (home)        | Trip cards with icon tile, progress and avatars; past trips as rows; floating “טיול חדש” |
| `reference/screens/trip.html`  | `/(app)/trips/[tripId]` | Back + invite header, title, segmented tabs, progress card, one card per category        |

Screens without a v2 reference (new trip, item sheet, add item, add expense, join, people and money tabs) keep their v1 layout and copy, restyled with the current tokens and components: outlined cards on `ground`, no dividers, ink for anything tappable.

Wide layouts (tablet ≥ 600, desktop ≥ 1024, `src/theme/breakpoint.ts`) aren't in the handoff. Single-column screens cap at the handoff's `content-max` (448); the home grid and the trip screen's side panel keep their wide layouts, built from the same cards.

## Token names in the app

The app follows the token names, except:

- The page background is `colors.ground` (`surface`), so `surface` can't silently change from “card” to “page” in code written against v1. In the app, `surface` is the card's style object (fill, radius and hairline), spread into any view that is a card.
- `size-*` → `size`, `space-*` → `space`, `radius-*` → `radius`, `shadow-float` → `shadow.float`, text styles → `type`.
- App additions: `inkFaint` (placeholders), `scrim`, `type.bigNumber`, `space[2]`, `radius.input`, `accents` (`accentAt(i)`).

## What changed from v2

v2 read as a generic blue app on a cold gray page, and the brand hardly appeared in the product. v3 takes its colors from the brand's own sunset: paper, violet and orange.

- **Color.** The page is warm paper (`#F6F2EA`, was the cold `#F4F5F8`). `primary` is sunset violet (`#5B3DE0`, was blue `#425AF4`), taken from the covers' evening hills, so buttons, selected chips and tabs, and links are violet and `primary-tint` is pale violet. Orange stays for done checks and progress. `brand-strong` is a shade deeper (`#B8370B`) so it passes on paper as well as on cards.
- **Category accents.** Each category card on a list gets a hue (violet, teal, orange, berry, gold, sky, in order): a dot by its name and its items' icons. The money balance is set in violet.
- **Type.** Rubik as before; the large button label drops from 800 to 700.
- **Cards** have a 1px `hairline` outline and a 20px radius (was 24, no outline). Unselected filter chips, the tabs' track and round header buttons are outlined the same way.
- **Buttons.** The floating button is 56px tall (was 60). The row buttons are pale violet with violet labels.
- **Unchanged.** The logo, the illustrations and covers, the icons, the status ring, the spacing scale, the 44px touch target, the layouts and every string.

Before and after: [screenshots/v3/](screenshots/v3/). The other screenshots under `screenshots/` and the HTML under `reference/` were made in v2 and still show its colors.

## What changed from v1 (in v2)

- **Brand.** The Check-Y logo, new app icon, adaptive icon (orange), splash and favicon.
- **Type.** Rubik 400/700/800 only; Fredoka is gone.
- **Avatars** are one color (`primary`) unless the person picked one.
- **No glass.** The floating glass tab bar and FAB are replaced by top segmented tabs and one bottom-centered floating button; sheets are plain white cards.
- **Trip screen** loses the illustrated cover; trips are marked by an icon tile in an illustration color instead. Cover scenes remain for the first-run card and the new-trip preview.
- **Lists** are cards per category with a status ring per item, instead of white groups with dividers.
