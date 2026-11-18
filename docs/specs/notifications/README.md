# Notifications (התראות)

Tell people when something on a trip needs them, remind them before the trip and after it, and keep a short list of everything in the app. This replaces the notification lines of SPEC §6 and the Phase 6 plan for push in [roadmap.md](../../plans/roadmap.md).

The design is the "Yallist notifications" canvas (four phone screens): the Android lock screen, the trips screen with the bell and the permission card, the in-app list, and the settings. It is a private claude.ai artifact; ask the owner for access.

## Decisions

| Question                          | Decision                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| In-app list in the first version? | **Yes.** iPhone users only have the web app until iOS ships, and the web has no push, so without it they get nothing.                 |
| Settings for each trip            | **Two switches per trip:** updates and reminders. What needs you always arrives.                                                      |
| Quiet hours                       | **Night only**, 22:00–08:00 by default, both ends editable. No Shabbat setting.                                                       |
| Day-before reminder time          | **Each person picks it**: 09:00, 13:00, 18:00 (default) or 20:00. An optional "morning of the trip" message at 08:00, off by default. |

## The three groups

Every notification belongs to one group. The group decides whether it can be turned off, whether it is batched, and which switches apply.

| Group                   | Can be turned off                                                   | Push timing                 |
| ----------------------- | ------------------------------------------------------------------- | --------------------------- |
| **מחכה לך** (needs you) | No: only by turning notifications off for the app in Android itself | Right away                  |
| **עדכונים** (updates)   | Profile switch, and each trip's own switch                          | Batched per trip, 3 minutes |
| **תזכורות** (reminders) | Profile switch per kind, and each trip's own switch                 | At their scheduled time     |

A push goes out only when the profile switch **and** the trip's switch are on. Whatever the switches say, every notification is written to the in-app list.

## What gets sent

The person who made a change is never notified about it.

### מחכה לך

| Trigger (activity type)             | Who                   | Text                                                 | Buttons              | Tap opens              |
| ----------------------------------- | --------------------- | ---------------------------------------------------- | -------------------- | ---------------------- |
| `member_requested`                  | The trip's organizers | נועה רוצה להצטרף לטיול                               | אישור · דחייה        | ניהול, pending members |
| `member_approved`                   | The person approved   | אושרת! הטיול בגולן מחכה לך                           | —                    | The trip               |
| `payment_marked`                    | The receiver          | רון סימן שהעביר לך ₪90 / בביט. הגיע? אפשר לאשר מכאן. | קיבלתי · עוד לא הגיע | Money tab              |
| Payment reminder (`remind_payment`) | The payer             | דנה מזכירה: ₪90 עבור הטיול בגולן                     | —                    | Money tab              |

The payment reminder depends on the receiver-only reminder in Phase 5 (`feat(api): edit expense, remind payment`), which isn't built yet.

### עדכונים

Sent to every active member except the actor, unless the row says otherwise.

| Trigger                                                               | Who                      | Text                                  |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------- |
| `claim_set`                                                           | Everyone                 | דנה לקחה מצננת                        |
| `claim_set` that assigns an item to someone (`userId`)                | The person it was put on | דנה שמה עליך מנגל                     |
| `claim_set` that moves an item from someone (`from`)                  | The person who had it    | איתי לקח ממך את המצננת                |
| Releasing a claim within 3 days of `starts_on`, so it's missing again | Everyone                 | הפחמים שוב חסרים                      |
| `expense_added`                                                       | Its participants         | איתי הוסיף ״סופר״ ₪450 · החלק שלך ₪90 |
| `trip_updated` with `starts_on`, `ends_on` or meetup fields           | Everyone                 | נקודת המפגש השתנתה: חניון גמלא        |
| `shopping_started`                                                    | Everyone                 | שירה בסופר עכשיו. צריך עוד משהו?      |
| `shopping_finished`                                                   | Everyone                 | שירה סיימה בסופר: 12 פריטים, ₪486     |
| `payment_confirmed`                                                   | The payer                | דנה אישרה שקיבלה ₪90                  |

**Batching.** Updates for the same person and trip that come within 3 minutes go out as one push. One update shows as is; several show a count and the first two: "4 עדכונים בטיול בגולן" / "דנה לקחה מצננת ופחמים · איתי הוסיף ״סופר״ ₪450, החלק שלך ₪90 · +2". Several claims by one person on one trip merge into one line ("דנה לקחה מצננת, פחמים ועוד 2").

### תזכורות

| Kind       | When                                                                | Who                                       | Text                                                                            | Switch                |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- | --------------------- |
| Day before | The day before `starts_on`, at the person's chosen time             | Everyone                                  | מחר יוצאים לגולן! / עליך: מנגל, 2 כיסאות · עוד חסרים 3: מצננת, פחמים, פיתות ×20 | `notify_day_before`   |
| Morning of | `starts_on` at 08:00                                                | Everyone who turned it on                 | היום יוצאים! / לקחת: מנגל, 2 כיסאות                                             | `notify_trip_morning` |
| Settle up  | The day after `ends_on` at 18:00, and again 3 days later; then stop | People who still owe a suggested transfer | נשאר לך להעביר ₪90 לדנה                                                         | `notify_settle`       |

The day-before push has the buttons "לרשימה" and "אני אביא …" for the first missing item, which claims it. A day-before reminder with nothing on you and nothing missing still goes out ("מחר יוצאים! הכול מסודר"). No reminders for a trip with no dates.

### Never sent

Category changes and reordering, item edits and additions, receipts, invite link rotation, role changes, members leaving or joining without approval, and deleted expenses or payments. They stay in the activity feed.

## Quiet hours

On by default, 22:00–08:00 Israel time, both ends editable. Pushes that would go out in that window, from any group, are held and sent together at its end, batched as above. They still appear in the in-app list right away. A day-before time inside the person's quiet hours waits until they end.

## Screens

1. **Push on Android.** Each notification shows the Yallist icon, "Yallist · <trip> · <time>", a bold title, one or two lines of text and up to two text buttons. The actor's avatar sits at the end. Android groups notifications by trip.
2. **The bell.** On the trips screen, next to the profile avatar: a 44px round button with a violet count of unread notifications. Each trip card shows a line with its newest unread one ("נועה מחכה לאישור · ועוד 2 עדכונים").
3. **The permission card.** Android 13+ asks before showing notifications. Instead of asking at launch, a violet-tint card on the trips screen explains first: "לדעת כשמשהו מחכה לך" / "מישהו שילם לך, מישהו רוצה להצטרף, ותזכורת יום לפני עם מה שעוד חסר.", with "הפעלת התראות" (then the Android prompt) and "לא עכשיו". It shows after the person's first trip exists, and again only after a week if dismissed. Not on the web.
4. **The notifications list** (`/notifications`, from the bell). Title "התראות", "סימון הכול" at the end. First a "מחכה לך · N" card whose rows have their button on the row (אישור, קיבלתי); a row leaves the card once it's handled. Then one card per day (היום, אתמול, then dates) with the actor's avatar or an icon, the text with the name in bold, "<trip> · <time>", and a violet dot when unread. Opening the list doesn't mark everything read; opening a row does. It keeps 30 days.
5. **Settings** (פרופיל › התראות):
   - **מה שולחים לי:** "מה שמחכה לך" (shown on, can't be changed); "עדכונים בטיול"; "תזכורת יום לפני" with the four times; "גם בבוקר היציאה"; "תזכורות להתחשבנות".
   - **שעות שקטות:** a switch and the two times.
   - **לכל טיול:** for each of my trips, "עדכונים" and "תזכורות".
   - A note: "הכול נשמר גם בפעמון בתוך האפליקציה, גם כשההתראות כבויות."
   - The two per-trip switches also show in the trip's ניהול tab.

## How it's built

**Data**

- `notifications`: `id`, `user_id`, `trip_id`, `group` (`needs_you|update|reminder`), `type`, `actor` (nullable), `payload` jsonb, `created_at`, `read_at`, `push_at` (nullable: null means no push), `pushed_at`, `handled_at` (for needs-you rows). Index on (`user_id`, `created_at`) and on `push_at` where `pushed_at` is null. Rows older than 30 days are deleted by the scheduled job.
- `push_tokens`: `user_id`, `token` (the device's FCM registration token, unique), `platform`, `updated_at`. Deleted when FCM answers `UNREGISTERED` (404) or `INVALID_ARGUMENT` for the token, on sign-out from that device, and on account deletion (D4).
- `profiles` gets `day_before_time` (default `18:00`), `notify_trip_morning` (default false), `quiet_hours` (default true), `quiet_start` / `quiet_end` (default `22:00` / `08:00`), next to the existing `notify_updates`, `notify_day_before` and `notify_settle`.
- `trip_members` gets `notify_updates` and `notify_reminders` (both default true), instead of the SPEC's separate `trip_member_prefs` table.

**From activity to notification.** Every write already logs activity in its transaction (`logActivity`). In the same transaction, a rules module (`apps/api/src/notify/rules.ts`, pure and unit-tested) turns the activity row into notification rows: who gets it, which group, the payload for the text, and `push_at` (now for needs-you; now + 3 minutes for updates; null when a switch is off). The text itself is built in the app for the list and in the sender for push, from `type` and `payload`, so it is never stored.

**Sending.** After commit, next to the realtime publish in `app.ts`, the API invokes the sender for rows due now. A sweeper Lambda runs every minute (EventBridge Scheduler) and sends whatever is due: batched updates and pushes held by quiet hours. For each person and trip it merges the due rows into one push, sends it to each of their tokens with FCM's HTTP v1 API (`POST https://fcm.googleapis.com/v1/projects/<project>/messages:send`, one call per token), marks the rows `pushed_at` and drops tokens FCM rejects. The Lambda signs in with a Firebase service account key kept as an SST secret, and caches the access token for its hour. Updates for a trip go out with the Android notification `tag` set to the trip, so a new batch replaces the previous one instead of stacking. Sending is best effort, like realtime: a failure is logged and retried by the next sweep, never fails the write.

**Reminders.** The same sweeper, on the hour, finds trips starting tomorrow (day-before, per member by their chosen time), starting today (morning, 08:00) and ended 1 or 4 days ago (settle up), and writes reminder rows with `push_at` now. Times are Israel time.

**The app.** `expo-notifications` (a local library; no Expo account or EAS) asks for permission from the card, gets the device's FCM token with `getDevicePushTokenAsync` (not the Expo token), registers it with `PUT /me/push-tokens`, and opens the right screen on tap. It needs the Firebase project's `google-services.json` in the Android build. Buttons on the push call the API directly (approve, confirm payment, claim). FCM's own notification messages can't carry buttons, so those pushes are sent as data messages and the app shows them with `expo-notifications` categories; confirm this works with the app closed early in the push PR, and drop the buttons (tap opens the screen) if it doesn't. Realtime updates the bell count while the app is open.

**Why not AppSync.** AppSync Events is a live connection, so it only reaches an open app. Android lets a closed app show a notification only when it comes through FCM, so every push service ends at FCM. Sending to it directly skips a middleman and the Expo account that Expo's push service needs.

**API.** `GET /me/notifications` (paged), `POST /me/notifications/read` (ids or all), `GET/PATCH` for the settings on `/me` and `/trips/:id/me`, `PUT/DELETE /me/push-tokens`.

## Build order

1. `feat(api): notifications and the in-app list`: the table, the rules, the API, the bell and the list in the app. Works on the web with no push set up.
2. `feat(app): notification settings`: profile and per-trip settings, quiet hours.
3. `feat(api,app): push`: tokens, the FCM sender and sweeper, `expo-notifications`, the permission card, buttons, opening the right screen on tap. Needs a Firebase project for `app.yallist`: its `google-services.json` and a service account key.
4. `feat(infra): reminders`: day-before, morning of and settle up on the sweeper.

## Not now

- Web push for installed web apps (iPhone home screen): worth it if iOS is far off.
- Email for settle-up reminders.
- A daily digest instead of batching.
