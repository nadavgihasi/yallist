# Phase 0 — Foundation

SPEC Phase 0, adapted to [tech-decisions.md](../tech-decisions.md): AWS backend instead of Supabase, Android + web first.

**Built (#5–#9), with these changes since:** the SST apps live in [infra/](../../infra) (#18), not a root `sst.config.ts`; the API is behind an API Gateway HTTP API (#14), not a Function URL behind CloudFront; design system v2 (#36, #37) replaced Fredoka with Rubik only and the glass tab bar and FAB with segmented tabs and one floating button. [deploy.md](../deploy.md) and [design/](../design/README.md) describe the current setup.

**Done when:** the app boots on Android and web in RTL with both fonts, component previews match the mockups, and CI is green.

## PR 1 — `chore: workspace and tooling`

- pnpm workspace:
  - `apps/mobile`: Expo app
  - `apps/api`: Hono
  - `sst.config.ts` at the repo root
  - `packages/*` added in Phase 1, when shared domain code and Zod schemas exist
- `tsconfig.base.json` with strict mode and `noUncheckedIndexedAccess`.
- ESLint flat config (with `eslint-config-expo` for the app), Prettier, Vitest for non-RN code.
- `.npmrc` with `node-linker=hoisted` for Expo/Metro compatibility.
- Root scripts: `typecheck`, `lint`, `test`, `format:check`. GitHub Actions runs them on PRs and on `main`.
- Extend `.gitignore` for Expo, SST and env files.

## PR 2 — `feat(app): expo app shell with theme, fonts, RTL`

- Expo SDK 58 with Expo Router, TypeScript strict, `asyncRoutes: false`.
- `src/theme/`: typed tokens from [SPEC §9](../SPEC.md#9-design-system) and RTL-safe start/end helpers.
- Fonts: Fredoka 600/700 and Rubik 400/500/600 via `@expo-google-fonts/*`, loaded behind the splash screen.
- RTL:
  - Native: `I18nManager` plus `expo-localization` with `supportsRTL`/`forcesRTL`.
  - Web: single-page output (`web.output: "single"`, for S3 + CloudFront) with `public/index.html` setting `<html lang="he" dir="rtl">`.
- `src/i18n/he.ts`: the single locale file, with a `t()` helper and plural helpers (`חסר 1` / `חסרים 3`).
- Route skeleton:
  - `(auth)/login`, `(app)/index`, `j/[token]`: placeholders
  - `dev/components`: preview screen, dev only

## PR 3 — `feat(ui): design-system components and cover scenes`

- Build the [SPEC §9](../SPEC.md#9-design-system) components in `src/components/`:
  - `Avatar`, `AvatarStack`, `Pegs`, `ListGroup`, `ItemRow`, `StatusCard`
  - `PillButton`, `Chip`, `FilterChip`, `SegmentedControl`, `Switch`
  - `GlassTabBar`, `Fab`, `Sheet`, `OfflineBanner`, `EmptyState`, `Cover`
- Glass:
  - Android: translucent `rgba(255,255,255,0.92)`.
  - Web: CSS `backdrop-filter`.
  - iOS: `expo-blur`, or a Liquid Glass module if one exists by then.
- Five `react-native-svg` cover scenes from SPEC Appendix B, with `preserveAspectRatio="xMidYMid slice"`. The beach cover puts its title on a dark glass panel.
- Exact values come from the mockups (TripV2, HomeV2, ItemSheetV2, NewTripV2).
- The `dev/components` screen shows every component in each of its states.

## PR 4 — `feat(api): SST + Hono skeleton`

- `sst.config.ts`, region eu-central-1: a Hono Lambda on a Function URL behind CloudFront, and an S3 + CloudFront static site for the web export.
- DSQL and Drizzle are not in this PR; they come in Phase 1.
- `apps/api`: Hono app with `GET /health` and a typed `AppType` export for `hc`.
- A Vitest test calls the app through `app.request()`.
- No `sst deploy` without explicit approval, since it creates billable AWS resources.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check` pass locally and in CI.
- Web: run the dev server and compare the preview screen against the mockups in Chrome (RTL, fonts).
- Android: run on an emulator or device when one is available.
- `npx expo export -p web` produces a single bundle.
