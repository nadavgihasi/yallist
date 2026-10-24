# Yallist design handoff

Apply the Yallist design system and the new Check-Y logo to the app. `DESIGN.md` explains every decision; this file is the plan.

## What's in here

| Path | What it is |
|---|---|
| `DESIGN.md` | The brand book: voice, logo rules, color roles, type, layout, icons, and specs for Logo, Header, Button, Card, Steps and Avatar |
| `tokens/theme.ts` | All tokens as a typed TypeScript object with React Native style values (`as const`) |
| `tokens/tokens.css` | The same tokens as CSS variables, plus one class per text style, for web |
| `tokens/tokens.json` | The source the other two were generated from |
| `brand/logo/` | Lockup (SVG, plus PNG at 64px tall in 1×/2×/3×), reversed lockup for dark grounds, rounded icon tile, full-bleed store icon, mark alone |
| `brand/app-icons/` | Ready-made app icons: `icon.png` (1024, no alpha, for iOS and the stores), `adaptive-icon.png` and `adaptive-icon-monochrome.png` (Android foreground: white mark inside the safe zone), `splash-icon.png`, `favicon.png` (48), `favicon.svg`, `apple-touch-icon.png` (180) |
| `icons/` | UI icons from the mockups on a 24px grid with a `currentColor` stroke: plus, check, chevron-right, user-plus, tent, mountain, sun. Lucide has the same names if you'd rather use the library. |
| `reference/screens/` | Static HTML of the target screens (`login.html`, `trips.html`, `trip.html`). Open them in a browser at 390px wide. |
| `reference/components/` | A static preview of each component, styled with `tokens.css` |

## Tasks

1. **Add the tokens.** Bring `theme.ts` into the app's theme module, following the repo's existing conventions. Load Rubik at 400, 700 and 800. With `@expo-google-fonts/rubik`, the names in `fontFamily` already match. Replace hard-coded colors, radii, spacing and font sizes with tokens.
2. **Reconcile sizes with the code.** The colors are exact samples, but sizes and spacing were measured from a screenshot. Where the code already uses a value within 2px of a token, keep the code's value and update the token to match.
3. **Swap the icons.** Replace the app icon, Android adaptive icon, splash and favicon. If the app uses Expo, wire them in `app.json` like this:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "monochromeImage": "./assets/adaptive-icon-monochrome.png",
        "backgroundColor": "#FF5A1F"
      }
    },
    "web": { "favicon": "./assets/favicon.png" },
    "plugins": [
      ["expo-splash-screen", { "image": "./assets/splash-icon.png", "imageWidth": 160, "backgroundColor": "#F4F5F8" }]
    ]
  }
}
```

4. **Login screen.** Match `reference/screens/login.html`: the lockup at 64px tall, the line “מי מביא מה?”, a sample list card, and the sign-in action at the bottom. Use Google’s official sign-in button. The blue button in the reference only marks where it goes.
5. **Trips and Trip screens.** Restyle them to match `trips.html` and `trip.html`. The color rule is strict:
   - **Orange (`brand`)** only for the logo, packed checks and progress bars.
   - **Blue (`primary`)** for everything you can tap.
   - **`primaryStrong`** for small labels on `primaryTint`.
6. **Right-to-left.** Hebrew is the default. Use start/end, never left/right. The back control is `chevron-right.svg` in RTL; mirror it for LTR.

## Item states in the bring list

| State | Check | Caption | End of row |
|---|---|---|---|
| Nobody bringing it | 28px dashed `inkMuted` circle | “עוד אין מי שמביא” in `inkMuted` | Tonal “עליי” button that claims it |
| Someone else bringing it | 28px solid `inkMuted` ring | “<name> מביא/ה” | That person’s avatar |
| You’re bringing it | Ring as a 44px button | “עליך” in `brandStrong`, bold | — |
| Packed | Filled `brand` circle with a white check | “… · ארוז” | Unchanged |

Progress on a trip counts items that someone is bringing out of the total.
