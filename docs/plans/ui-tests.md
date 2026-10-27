# UI tests: Maestro on web, Android and iOS

**Status:** web flows run on every PR ([ui-tests.yml](../../.github/workflows/ui-tests.yml)) and against its preview, plus a few [preview-only Playwright tests](#preview-only-tests-playwright) for what Maestro can't drive. Native runs are planned, not built.

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
- We need two-user or realtime web flows; Playwright opens two browser contexts in one test. (We did, for the preview only: see [Preview-only tests](#preview-only-tests-playwright).)
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

| Flow            | Covers                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| `item-edit`     | Sign in, create a trip, add an item, rename it.                                  |
| `item-delete`   | Delete an item, back on the trip's list. The regression test for #70.            |
| `claim`         | Claim an item, release it.                                                       |
| `expense`       | Add an expense on the money tab, see it listed.                                  |
| `profile`       | Open the profile.                                                                |
| `trip-delete`   | Delete the trip, typing its name to confirm; home without it. #121.              |
| `invite-member` | Open the invite link to your own trip: straight to the trip, no join page. #125. |

Shared steps are in `e2e/common/` (sign in, new trip, add item).

Photos (receipts, profile photos) aren't here: Maestro can't pick a file on web. The preview-only tests cover them, through the real file input.

## Preview-only tests (Playwright)

Some things only a deployed preview has, or Maestro web can't drive. [`e2e/preview`](../../apps/mobile/e2e/preview) tests them with Playwright (pinned, `@playwright/test` 1.64.1), against each PR's preview only.

**Why Playwright for these.** Maestro 2.11.0's web driver can't pick a file: it has no file upload (Selenium's `sendKeys` with a path, `setInputFiles`), `addMedia` does nothing on web, and it has no command that runs JavaScript in the page. `runScript` and `evalScript` run in Maestro's own JS engine, not the browser. The only way into the page is that `launchApp` arguments are pasted into a script unescaped, which is a bug to rely on. Maestro also drives one browser per flow, so two people would need two Maestro processes coordinated through shared files. Playwright picks files through the browser's real file chooser (`filechooser` + `setFiles`), opens two isolated sessions in one test (`browser.newContext`), and records a video of each. The Maestro flows stay the cross-platform suite; these are web-only and preview-only.

| Test                       | Covers                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `receipts`                 | A 3000×4000 photo through the receipt's file input, shrunk on the device to 1500×2000, a presigned POST to the PR's S3 bucket (its CORS), attached, shown through a presigned GET, deleted, then added again from the expense's receipt sheet. |
| `profile-photo`            | A photo through the profile's file input, cropped to 512×512, uploaded to S3, shown from it, removed.                                                                                                                                          |
| `two-members` (join, hero) | Dana's trip requires approval; she copies the invite link from the people tab (`/pr-<n>/j/<token>`); Noa opens it in a second session, asks to join; Dana approves; Noa lands on the trip; Dana's hero now offers the missing list.            |
| `two-members` (realtime)   | As above, then Dana's page subscribes to the trip's AppSync Events channel with her session, Noa claims the Tent, and the event arrives, and the app's own subscription updates Dana's list without a reload.                                  |
| `two-members` (delete)     | As in join, then Dana deletes the trip; Noa, still on it, is sent home with a message by the realtime event's refetch (a 404).                                                                                                                 |
| `auth`                     | Guest sign-in and an authorized call (`/me`, with its preflight) from the CloudFront origin to the real API Gateway, with CORS headers.                                                                                                        |

Each test signs in its own new guests, so they share the preview's database and run in parallel (4 workers). Every page records a video (two per test for two people) and a failed test keeps a trace (DOM, network and console per step, `playwright show-trace`).

Run them against any preview (`E2E_API_URL` and `E2E_REALTIME_HOST` are the stage's `api` and `realtime` outputs; without them the two-member tests skip):

```sh
cd apps/mobile && pnpm exec playwright install chromium-headless-shell ffmpeg
E2E_WEB_URL=https://<router>/pr-<n>/ E2E_API_URL=https://<api>/pr-<n> E2E_REALTIME_HOST=<host> \
  pnpm exec playwright test
```

**Where each test runs:**

| Tests                                               | Local (`pnpm e2e:web`) and `ui-tests.yml` | PR preview (`preview.yml`) |
| --------------------------------------------------- | ----------------------------------------- | -------------------------- |
| Maestro flows (`e2e/flows`)                         | Yes                                       | Yes                        |
| Maestro flows tagged `test-route` (`crash`)         | Yes                                       | No: test-only routes       |
| Playwright `e2e/preview` (photos, two people, CORS) | No                                        | Yes (`preview-only` job)   |

## CI

- **Web, every PR and `main`:** `ui-tests.yml` exports the app once (`build`), then two shards each run the script against their own `postgres:17` service (`E2E_SHARD=1` runs the flows tagged `shard-1`, `2` the rest; `E2E_PREBUILT=1` reuses the export). The `web` job collects both results and fails unless both shards passed, so it's the one check to make required (a GitHub setting).
- **Android (proposed):** a `ui-tests-android` workflow on `workflow_dispatch`, nightly on `main`, and before promoting to `production`. It builds a debug APK with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3100` (the emulator's host), boots an emulator with `reactivecircus/android-emulator-runner` (KVM on ubuntu), and runs `maestro test apps/mobile/e2e` against the same local API. Expect 15–25 minutes, too slow for every PR. Locally: an emulator, the app installed, then the same command.
- **iOS (deferred):** iOS isn't built yet. When it is: a macOS runner and a simulator build, run before releases only (macOS minutes cost 10×).
- **PR previews:** the same flows run against each PR's live preview (`WEB_URL=https://<router>/pr-<n>/`), see [e2e-live-environments.md](e2e-live-environments.md). Then the `preview-only` job runs the Playwright tests against it (no AWS role), caching the browser per Playwright version, and uploads `preview-only-tests-<run>-<attempt>`: JUnit, a video per page and a trace per failure.

## Deferred

- Native runs (above). The flows haven't been run on a device yet; expect small fixes (keyboard covering buttons: `hideKeyboard`).
- Desktop and tablet layouts on web; only the phone layout runs.
