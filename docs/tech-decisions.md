# Tech decisions

Decisions made so far for the group-trip app. Where this file and [SPEC.md](SPEC.md) disagree, this file wins (see [Resolved conflicts with SPEC](#resolved-conflicts-with-spec-2026-10-24)).

## Product context

- Group trips, Israel-first: shared bring list, shared buy list, cost split. Later: help choosing a place.
- Anyone in a trip can add and delete items. Each member is one person, not a household.
- Design should look very modern. UI is Hebrew and right-to-left first.
- App name not final. Shortlist: Yallist, Mi Mevi, Packmates. Earlier prototypes used the placeholder "עליי".
- Code license: people must not be able to use or fork the code, but should be able to open pull requests. So no MIT/Apache; this needs a source-available license.

## Resolved conflicts with SPEC (2026-10-24)

| Topic      | SPEC.md said                                                | Decision                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend    | Supabase (RLS, triggers, pg_cron, Realtime, Edge Functions) | **Hono on Lambda + Aurora DSQL + SST.** RLS and `SECURITY DEFINER` RPCs become authorization checks and transactional handlers in the API. Activity rows are written in the same transaction as the change. Scheduled jobs (day-before reminder) run on EventBridge. |
| Cost split | Equal among each expense's participants, with exclusions    | **Same as SPEC.** The earlier "organizer picks equal or by shares" idea is dropped.                                                                                                                                                                                  |
| Sign-in    | Anonymous join by link + Google + Apple                     | **Anonymous + Google now; Apple added when iOS ships** (App Store rules require it then).                                                                                                                                                                            |
| Realtime   | Realtime sync on the trip screen                            | **Same as SPEC: realtime in v1.** Transport: AppSync Events, see below.                                                                                                                                                                                              |
| Platforms  | iOS, Android and web from Phase 0                           | **Android + web first, iOS later.** iPhone users use the web version until then.                                                                                                                                                                                     |

## Language

- TypeScript only, everywhere: app, backend and infrastructure.

## Client

- Expo (React Native) with Expo Router: one codebase for Android, iOS and web. Expo SDK 58, React Native 0.88, web via react-native-web.
- The web version matters: people open invite links from WhatsApp without the app installed.
- Data fetching: TanStack Query with a persisted cache and optimistic updates, so the app works with weak reception at campsites.
- The `expo-router` plugin is set to `asyncRoutes: false` so the web export is a single bundle.

## No paid Expo services (EAS)

- Builds: local (Gradle for Android; a Mac for iOS later) or GitHub Actions.
- Store upload: Play Console by hand, or Fastlane.
- Over-the-air updates: Hot Updater, self-hosted on S3 + CloudFront / Lambda@Edge.
- Push notifications: Expo's free push service.

## Backend

- API: Hono on AWS Lambda.
- Zod validates requests in the API routes (`apps/api/src/routes`); the app gets request and response types from them through Hono's typed RPC client (`hc`). Domain rules shared by the API and the app (coverage, claim caps, money, phone numbers) live in `@yallist/domain`.
- Web hosting: static Expo web export on S3 + CloudFront.
- Infrastructure as code: SST, in [infra/](../infra) ([deploy.md](deploy.md)). Production in eu-central-1 (Frankfurt), dev in us-east-2.

## Database

- Aurora DSQL: Postgres-compatible, billed per request, $0 when idle. Free tier is 100K DPUs + 1 GB per month, permanently.
- ORM: Drizzle, using the DSQL adapter (IAM auth, connection pooling, optional retries on write conflicts).
- Lambda runs outside a VPC, so no NAT gateway is needed.
- Constraints:
  - DSQL rejects conflicting concurrent writes, so writes need retries.
  - No triggers or extensions.
  - Max 3,000 rows changed per transaction (cascading foreign-key actions count too). One DDL statement per transaction, never mixed with DML.
  - Foreign keys, JSONB, identity columns and sequences are supported. Enum types are not (no `CREATE TYPE`); use text with a `CHECK`.
  - No local emulator: tests run against Postgres in Docker, staying within DSQL's subset.
- Store money as integer agorot.
- Rejected:
  - Aurora Serverless v2: slow cold resumes; no Data API in the Tel Aviv region, which forces a VPC and a NAT gateway.
  - DynamoDB: kept only as a fallback.

## Observability

- One platform only, with a free tier that has no time limit.
- Leaning New Relic: 100 GB/month, mobile + browser + Lambda + logs + unlimited ping monitors, about 8 days retention.
- Alternative: Sentry (better Expo crash debugging, 30-day retention, tighter free limits).
- Check that New Relic's React Native agent works with Expo SDK 58 before committing.

## Cost targets

- Android + web launch: Google Play $25 once, then about $1–3/month at 100 users.
- 10K users: about $2–3/month typical, $15–20/month in a heavy month.
- Using Lambda Function URLs behind CloudFront instead of API Gateway lowers this further.

## Decided 2026-10-24 (Phase 1)

- **Realtime transport:** AppSync Events. The API publishes a "trip changed" event to a per-trip channel after each write; clients invalidate the matching queries.
- **Auth library:** Better Auth, with the anonymous plugin and Google. Users live in our own database. It uses bearer tokens, because the API and the web app are on different domains.
- **API entry point:** API Gateway HTTP API in front of the Hono Lambda.

## Open decisions

- **Observability platform:** New Relic vs Sentry.
- **License:** which source-available license.
- **App name and domain**, and when to add iOS.
- Plus the open questions in [SPEC §12](SPEC.md#12-open-questions).
