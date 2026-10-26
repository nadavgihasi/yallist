# UI tests: Maestro on web, Android and iOS

**Status:** web flows run on every PR ([ui-tests.yml](../../.github/workflows/ui-tests.yml)). Native runs are planned, not built.

## Choice: Maestro, for now

One set of YAML flows in [`apps/mobile/e2e`](../../apps/mobile/e2e) drives the web app (Chrome), the Android app and the iOS app. The table compares the options. "Measured" means on this repo; everything else is from the tools' docs or is our estimate.

|                     | **Maestro** (chosen)                                                                            | Playwright                                                                                                    | Playwright (web) + Maestro (native)       | Detox                                                   | Appium / WebdriverIO                                 |
| ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Web / Android / iOS | Chrome (beta) / yes / yes                                                                       | Chromium, Firefox, **WebKit** / no / no                                                                       | all three                                 | no / yes / yes                                          | browsers / yes / yes                                 |
| One test source     | Yes                                                                                             | Web only                                                                                                      | No: each flow written twice, same testIDs | No: web needs a second tool                             | Mostly; per-platform capabilities and some branching |
| Maturity            | Native is mature. **Web is beta** (see below)                                                   | Mature, the web standard                                                                                      | Both mature for their part                | Mature, but tied to RN/Expo versions                    | Mature, many moving parts (server, drivers)          |
| Speed in CI         | Measured: 5 flows in 2m30s, serial, a new Chrome per flow; the job is about 3.5 min             | Fastest: parallel workers; likely under a minute for these 5 (estimate)                                       | Web as Playwright; native as Maestro      | Native only; fast once built, but needs its own build   | Slowest (WebDriver round trips)                      |
| Debugging           | Screenshot and view hierarchy of the failing step; Maestro Studio                               | **Best**: trace viewer (DOM, network, console per step), UI mode, codegen                                     | Two toolsets                              | Logs, screenshots, video                                | Logs, screenshots; Appium Inspector                  |
| RTL / Hebrew        | testIDs avoid it. Web types Hebrew; **Android `inputText` can't type Hebrew**, so we type Latin | Full Unicode text and role/name queries in Hebrew                                                             | As each tool                              | `replaceText` handles Unicode                           | Unicode through the driver's keyboard settings       |
| Effort to adopt     | Measured: CLI zip plus Java; no app changes beyond testIDs                                      | `pnpm add -D @playwright/test` and a browser download                                                         | Both                                      | Native test build config, a Detox runner per platform   | Appium server plus drivers per platform, WDIO config |
| Our 5 flows         | Done: about 150 lines of YAML                                                                   | About 150 lines of TS, about half a day; `getByTestId` already works (react-native-web renders `data-testid`) | Playwright port plus the YAML above       | Native port of about 150 lines, plus Playwright for web | About 200 lines of TS, 1–2 days with setup           |

Expo has no test runner of its own. Its docs run Maestro, through EAS Workflows, which is paid, and we don't use EAS (see [tech-decisions.md](../tech-decisions.md)).

**What Maestro web being beta risks:**

- **Chrome only, no Safari.** iPhone users use the web app until the iOS app ships, and nothing here tests WebKit. Playwright does.
- **Rough edges we hit:**
  - It doesn't scroll to an element before tapping it, so we use a tall 500×1400 window.
  - Chrome won't make the window narrower than about 500px, so true 390px phone widths aren't tested.
  - The `url` + `appId` flow header isn't documented.
- **It can change between releases.** The CLI is pinned to 2.11.0.

**Why Maestro now:** it's the only option where the five flows are written once for web, Android and iOS. Android is the next platform, and the flows will run there unchanged. It ran this app reliably and reproduced #70 on the first try.

**What would make us switch web to Playwright:**

- We need Safari coverage.
- Maestro web turns out flaky or breaks on an upgrade.
- We need two-user or realtime web flows; Playwright opens two browser contexts in one test.
- The web job outgrows the 5-minute budget.

**Switch cost:** about half a day. The testIDs stay, and Playwright finds them through `data-testid`. `scripts/e2e-web.sh` and the CI job stay; only the runner step changes. Maestro would keep running the native flows, which is the hybrid column above.

## How tests find elements

- **testIDs, not text.** Hebrew strings change; testIDs don't. Names are kebab-case `<screen>-<element>`: `login-start`, `trip-add`, `item-delete`, `trip-tab-money`.
- Set them with `{...testId('name')}` ([lib/testId.ts](../../apps/mobile/src/lib/testId.ts)). It sets `testID` (Android, iOS) and the DOM `id`, because on web Maestro reads `id` before `aria-label`.
- Only what a flow touches gets a testID. Text the flow typed itself (item names) is found by text.
- Typed text is Latin ("Tent"): Maestro can't type Hebrew on Android.

## Run locally

Needs Docker Postgres (`yallist-pg`), Chrome and the [Maestro CLI](https://docs.maestro.dev) (Java 17+).

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres pnpm e2e:web
# one flow:
DATABASE_URL=… pnpm e2e:web apps/mobile/e2e/flows/item-delete.yaml
```

[scripts/e2e-web.sh](../../scripts/e2e-web.sh) creates a fresh database, starts the API on it (`:3100`), exports the web app against it, serves it (`:8180`), runs the flows in a 500×1400 headless Chrome (phone layout), then drops the database. Results go to `$E2E_OUT`: a video of every flow (`maestro/*/<flow>/startRecording/<flow>.mp4`), `junit.xml`, screenshots on failure, and the API and web logs. In CI each shard uploads them as `ui-tests-web-<run>-shard-<n>` (a rerun replaces it), and the `web` job's summary links them along with each flow's result. Recording needs Chrome 145–147, which Maestro 2.11.0 supports, so the script has Selenium download Chrome for Testing 147. CI caches it and the Maestro CLI, and shard reruns reuse the `build` job's export.

## Flows

Each flow starts from a clean browser as a new guest with its own blank trip, so flows don't depend on each other.

| Flow          | Covers                                                                |
| ------------- | --------------------------------------------------------------------- |
| `item-edit`   | Sign in, create a trip, add an item, rename it.                       |
| `item-delete` | Delete an item, back on the trip's list. The regression test for #70. |
| `claim`       | Claim an item, release it.                                            |
| `expense`     | Add an expense on the money tab, see it listed.                       |
| `profile`     | Open the profile.                                                     |

Shared steps are in `e2e/common/` (sign in, new trip, add item).

## CI

- **Web, every PR and `main`:** `ui-tests.yml` exports the app once (`build`), then two shards each run the script against their own `postgres:17` service (`E2E_SHARD=1` runs the flows tagged `shard-1`, `2` the rest; `E2E_PREBUILT=1` reuses the export). The `web` job collects both results and fails unless both shards passed, so it's the one check to make required (a GitHub setting).
- **Android (proposed):** a `ui-tests-android` workflow on `workflow_dispatch`, nightly on `main`, and before promoting to `production`. It builds a debug APK with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3100` (the emulator's host), boots an emulator with `reactivecircus/android-emulator-runner` (KVM on ubuntu), and runs `maestro test apps/mobile/e2e` against the same local API. Expect 15–25 minutes, too slow for every PR. Locally: an emulator, the app installed, then the same command.
- **iOS (deferred):** iOS isn't built yet. When it is: a macOS runner and a simulator build, run before releases only (macOS minutes cost 10×).
- **Live AWS stage:** the same flows replace the Playwright `web` project in [e2e-live-environments.md](e2e-live-environments.md), with `WEB_URL` set to the stage's site. When that runs is still its open question Q1.

## Deferred

- Native runs (above). The flows haven't been run on a device yet; expect small fixes (keyboard covering buttons: `hideKeyboard`).
- Two-user and realtime flows (invite and join, live claims). Maestro drives one device per flow, so the second user would act through the API (`runScript` + `http`).
- Desktop and tablet layouts on web; only the phone layout runs.
