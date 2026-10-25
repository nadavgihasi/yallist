# UI tests: Maestro on web, Android and iOS

**Status:** web flows run on every PR ([ui-tests.yml](../../.github/workflows/ui-tests.yml)). Native runs are planned, not built.

## Choice: Maestro

One set of YAML flows in [`apps/mobile/e2e`](../../apps/mobile/e2e) drives the web app (Chrome), the Android app and the iOS app.

| Option               | Web + Android + iOS from one source  | Notes                                                                                                                           |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Maestro** (chosen) | Yes. Web is beta (Chrome only).      | The E2E tool Expo's docs use. Waits for the UI to settle, so no sleeps. Free CLI, no app instrumentation. Flows are plain YAML. |
| Playwright + Maestro | No: two suites over the same testIDs | Best web tooling, but every flow is written twice.                                                                              |
| Detox + Playwright   | No                                   | Detox has no web, needs a custom native build, and is the flakiest to keep running on Expo.                                     |
| Appium / WebdriverIO | Yes                                  | One API for all three, but slow, heavy setup (Appium server, drivers) and flaky waits.                                          |

The risk is Maestro's web support being beta. It ran this app reliably (it caught #70 on the first try). If it stops keeping up, the flows' testIDs carry over to Playwright for web unchanged.

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

[scripts/e2e-web.sh](../../scripts/e2e-web.sh) creates a fresh database, starts the API on it (`:3100`), exports the web app against it, serves it (`:8180`), runs the flows in a 500×1400 headless Chrome (phone layout), then drops the database. Debug screenshots and logs go to `$E2E_OUT`.

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

- **Web, every PR and `main`:** `ui-tests.yml` runs the script against a `postgres:17` service. About 2 minutes of flows plus setup. Not a required check; that's a GitHub setting.
- **Android (proposed):** a `ui-tests-android` workflow on `workflow_dispatch`, nightly on `main`, and before promoting to `production`. It builds a debug APK with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3100` (the emulator's host), boots an emulator with `reactivecircus/android-emulator-runner` (KVM on ubuntu), and runs `maestro test apps/mobile/e2e` against the same local API. Expect 15–25 minutes, too slow for every PR. Locally: an emulator, the app installed, then the same command.
- **iOS (deferred):** iOS isn't built yet. When it is: a macOS runner and a simulator build, run before releases only (macOS minutes cost 10×).
- **Live AWS stage:** the same flows replace the Playwright `web` project in [e2e-live-environments.md](e2e-live-environments.md), with `WEB_URL` set to the stage's site. When that runs is still its open question Q1.

## Deferred

- Native runs (above). The flows haven't been run on a device yet; expect small fixes (keyboard covering buttons: `hideKeyboard`).
- Two-user and realtime flows (invite and join, live claims). Maestro drives one device per flow, so the second user would act through the API (`runScript` + `http`).
- Desktop and tablet layouts on web; only the phone layout runs.
