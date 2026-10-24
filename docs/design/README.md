# Design

The current design is **design system v2**: the Check-Y logo, Rubik, and a two-hue color rule (blue to tap, orange for the brand). It came as a handoff; the files here are that handoff unchanged.

| Path                                           | What it is                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [DESIGN.md](DESIGN.md)                         | The brand book: voice, logo, color roles, type, layout, icons, component specs             |
| [HANDOFF.md](HANDOFF.md)                       | The handoff's task list, including the bring-list item states                              |
| [tokens/](tokens/)                             | Tokens as JSON (source), TypeScript and CSS. The app's copy is `apps/mobile/src/theme`     |
| [brand/](brand/)                               | Logo lockups, icon tile, mark, and ready-made app icons (wired in `apps/mobile/app.json`)  |
| [icons/](icons/)                               | UI icons on a 24px grid (also in `apps/mobile/src/components/Icon.tsx`)                    |
| [reference/screens/](reference/screens/)       | Static HTML of the target screens. Open them in a browser at 390px wide                    |
| [reference/components/](reference/components/) | Static previews of Logo, Header, Button, Card, Steps and Avatar                            |
| [v1/](v1/)                                     | **Superseded.** The 17 v1 mockups (`*.dc.html`); still the reference for copy and behavior |

## Screens → routes

| Reference                      | Route                   | Notes                                                                                    |
| ------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| `reference/screens/login.html` | `/(auth)/login`         | Lockup, “מי מביא מה?”, a sample list card, sign-in at the bottom                         |
| `reference/screens/trips.html` | `/(app)/` (home)        | Trip cards with icon tile, progress and avatars; past trips as rows; floating “טיול חדש” |
| `reference/screens/trip.html`  | `/(app)/trips/[tripId]` | Back + invite header, title, segmented tabs, progress card, one card per category        |

Screens without a v2 reference (new trip, item sheet, add item, add expense, join, people and money tabs) keep their v1 layout and copy, restyled with the v2 tokens and components: cards on `ground`, no borders or dividers, blue for anything tappable, Rubik.

Wide layouts (tablet ≥ 600, desktop ≥ 1024, `src/theme/breakpoint.ts`) aren't in the handoff. Single-column screens cap at the handoff's `content-max` (448); the home grid and the trip screen's side panel keep their wide layouts, built from the same cards.

## Token names in the app

The app follows the handoff names, except:

- The page background is `colors.ground` (handoff `surface`), so `surface` can't silently change from “card” to “page” in code written against v1.
- `size-*` → `size`, `space-*` → `space`, `radius-*` → `radius`, `shadow-float` → `shadow.float`, text styles → `type`.
- App additions: `inkFaint` (placeholders), `line` (switch track), `scrim`, `type.bigNumber`, `space[2]`, `radius.input`.

Sizes within 2px of what v1 already used keep the v1 value (handoff task 2): page title 36/40, section title 26/32, step numeral 19, large button label 17. The card radius moved from 28 to 24.

## What changed from v1

- **Brand.** The Check-Y logo, new app icon, adaptive icon (orange), splash and favicon.
- **Type.** Rubik 400/700/800 only; Fredoka is gone.
- **Color.** Blue is `#425AF4` (was `#3B5BFD`) and only for things you can tap. Orange (`brand`) marks progress and done checks. The green “success” and orange-red “missing” tones are gone; status text is `inkMuted`, “yours” is `brandStrong`.
- **Avatars** are one color (`primary`) instead of a per-person palette.
- **No glass.** The floating glass tab bar and FAB are replaced by top segmented tabs and one bottom-centered floating button; sheets are plain white cards.
- **Trip screen** loses the illustrated cover; trips are marked by an icon tile in an illustration color instead. Cover scenes remain for the first-run card and the new-trip preview.
- **Lists** are cards per category with a status ring per item, instead of white groups with dividers.
