# Google Play listing

Everything the Play Console asks for, ready to paste, in the order the Console asks for it. The build side (upload key, AAB) is in [android.md](../android.md).

Links used below:

- Privacy policy: <https://dbnrgj1er7zss.cloudfront.net/privacy> (English: `?lang=en`), the production site's `/privacy` ([policy.ts](../../apps/mobile/src/features/privacy/policy.ts)). Update the links here if the production site moves to a domain.
- Account deletion: the same page; its "Deleting your account and data" section says how. Deletion itself is in the app (profile → מחיקת החשבון).

## 1. Create the app

Play Console → **Create app**:

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| App name         | Yallist                               |
| Default language | Hebrew – he-IL                        |
| App or game      | App                                   |
| Free or paid     | Free (can't be changed to paid later) |

Tick the Developer Program Policies and US export laws declarations.

The package name `app.yallist` is fixed by the first upload (step 3) and can never change.

## 2. Upload key and first build

1. On your computer, with `gh` signed in: `./scripts/create-android-upload-key.sh`. Back up `~/.yallist-keys/` to your password manager.
2. Actions → **Android build** → Run workflow on `main`, stage **production**. Check the log has no "debug-signed" warning.
3. Download the run's artifact; `app-release.aab` is the file Play takes.

## 3. Internal testing (you and a few friends, no review)

Testing → **Internal testing** → Create new release:

1. Accept **Play App Signing** (Google holds the app signing key; ours stays the upload key).
2. Upload `app-release.aab`. Release name: the version (e.g. `0.42.0`). Release notes (he-IL): `גרסה ראשונה לבדיקה`.
3. Testers tab → create an email list with your Gmail and a few friends' → Save → copy the opt-in link, open it on the phone, install from Play.

## 4. App content (Policy → App content)

### Privacy policy

`https://dbnrgj1er7zss.cloudfront.net/privacy`

### Ads

No, the app doesn't contain ads.

### App access

**All functionality is available without any special access.** Reviewers can tap "כניסה כאורח" (guest), type any name, and use everything. (If Play still asks, add instructions: "Tap the guest sign-in button on the first screen, enter any name. No account is needed.")

### Content rating

Start the questionnaire, email for IARC: your developer email. Category: **All other app types**.

| Question                                                             | Answer                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Violence, sexuality, language, controlled substances, gambling, etc. | No to all                                                            |
| Do users interact or exchange content with each other?               | **Yes** (members of the same trip only)                              |
| Does the app share the user's current physical location with others? | **Yes** (only if they set it as the meetup point, seen by that trip) |
| Does the app allow users to purchase digital goods?                  | No                                                                   |
| Is the app a web browser or search engine?                           | No                                                                   |

Expected result: everyone / 3+ in most regions, with "Users interact" and "Shares location" notices.

### Target audience and content

- Target age groups: **18 and over** only. (Picking anything under 13 puts the app under the Families policy; under 18 adds teen requirements we don't need.)
- Could the app unintentionally appeal to children? No.

### News app

No.

### Data safety

Overview questions:

| Question                                                                    | Answer                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types?         | Yes                                                                         |
| Is all of the user data collected by your app encrypted in transit?         | Yes (HTTPS only)                                                            |
| Which account creation methods does your app support?                       | Username and other authentication (guest name), OAuth (Sign in with Google) |
| Delete account URL                                                          | `https://dbnrgj1er7zss.cloudfront.net/privacy?lang=en`                      |
| Can users request that some data be deleted without deleting their account? | Yes (photos, phone number, items, expenses, leaving/deleting trips)         |

Shared: **none**. Data that only goes to our service providers (AWS, Google sign-in, Sentry) doesn't count as shared, and neither does what trip members see of each other.

Data types collected. For every row: **collected, not shared, processed ephemerally: No**.

| Category                 | Data type                    | Required or optional | Purposes                              | Where in the app                                   |
| ------------------------ | ---------------------------- | -------------------- | ------------------------------------- | -------------------------------------------------- |
| Location                 | Precise location             | Optional             | App functionality                     | "My location" as a trip's meetup point             |
| Personal info            | Name                         | Required             | App functionality, Account management | Guest name / Google name, display name             |
| Personal info            | Email address                | Optional             | Account management                    | Only with Google sign-in                           |
| Personal info            | User IDs                     | Required             | App functionality, Account management | Account ID, Google account ID                      |
| Personal info            | Phone number                 | Optional             | App functionality                     | Bit / PayBox number in the profile                 |
| Financial info           | Other financial info         | Optional             | App functionality                     | Trip expenses, splits and payments between members |
| Photos and videos        | Photos                       | Optional             | App functionality                     | Receipts and profile photo                         |
| App activity             | Other user-generated content | Optional             | App functionality                     | Trips, items, feedback                             |
| App info and performance | Crash logs                   | Required             | App functionality                     | Sentry error reports (scrubbed)                    |
| App info and performance | Diagnostics                  | Required             | App functionality                     | Sentry performance traces (scrubbed)               |

Not collected: contacts, calendar, messages, audio, files, health, web history, installed apps, advertising ID. The app has no analytics or ads SDKs.

If the privacy policy or the code changes what's collected (see the note at the top of [policy.ts](../../apps/mobile/src/features/privacy/policy.ts)), update this table and the Console form together.

### Financial features

"My app doesn't provide any financial features." Splitting trip costs among friends records who paid what; it moves no money (the Bit/PayBox number is shown to members to pay outside the app).

### Health apps, government apps

Not applicable / No.

## 5. Store listing (Grow → Store presence → Main store listing)

### Hebrew (he-IL, default)

**App name** (30 max): `Yallist`

**Short description** (80 max):

```
מי מביא מה לטיול: רשימת ציוד, קניות וחלוקת הוצאות עם החברים
```

**Full description** (4000 max):

```
יוצאים לטיול עם החבר׳ה? Yallist עושה סדר: רשימה אחת משותפת לכל הטיול, בלי מאה הודעות בקבוצה.

ציוד
• מתחילים מרשימה מוכנה לקמפינג, על האש, צימר, יום בחוף, טרק, טיסה או סקי, ומוסיפים מה שצריך.
• כל אחד לוחץ "אני אביא" על מה שהוא לוקח, וכולם רואים מה כבר מכוסה ומה עדיין חסר.
• פריטים שכל אחד צריך להביא בעצמו (שק שינה, פנס ראש) ופריטים בכמות (4 אוהלים, 8 כיסאות).
• "הרשימה שלי" מראה רק את מה שעליך להביא, ואפשר לסמן מה כבר ארוז.

קניות
• רשימת קניות משותפת: מי קונה מה, ומה עוד חסר.
• יוצאים לקנות? מסמנים מה בעגלה, כדי ששניים לא יקנו את אותו הדבר.

כסף
• רושמים הוצאה, מי שילם ובין מי היא מתחלקת. אפשר לצרף צילום של הקבלה.
• בסוף הטיול רואים מי חייב למי וכמה, ומשלמים בביט או בפייבוקס.

והכל ביחד
• מזמינים חברים בקישור לוואטסאפ, בלי שכולם יצטרכו להירשם.
• נקודת מפגש עם קישור ל-Waze, ואלבום משותף ב-Google Photos.
• עובד גם בקליטה חלשה.

נכנסים כאורח בשנייה, או עם חשבון Google כדי לא לאבד את הטיולים.
בלי פרסומות. בלי מכירת מידע.
```

### English (en-US, optional translation)

**Short description**:

```
Who brings what on a group trip: shared gear list, shopping and cost splitting
```

**Full description**:

```
Going on a trip with friends? Yallist keeps it in one shared list instead of a hundred group-chat messages.

Gear
• Start from a ready list for camping, a barbecue, a cabin, a beach day, a trek, a flight or skiing, and add what you need.
• Everyone taps "I'll bring it" on what they take, so the group sees what's covered and what's still missing.
• Items everyone brings for themselves (sleeping bag, headlamp) and items in quantities (4 tents, 8 chairs).
• "My list" shows only what you're bringing, and you can tick off what's packed.

Shopping
• A shared shopping list: who buys what, and what's still missing.
• Out shopping? Mark what's in the cart so no one buys the same thing twice.

Money
• Log an expense, who paid, and who it's split between. Attach a photo of the receipt.
• At the end of the trip, see who owes whom and how much.

Together
• Invite friends with a link; they don't need to sign up.
• A meetup point with a Waze link, and a shared Google Photos album.
• Works on weak reception.

Start as a guest in seconds, or sign in with Google to keep your trips.
No ads. We don't sell data.
```

### Graphics

| Asset                              | File                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| App icon, 512×512 PNG              | [icon-512.png](icon-512.png)                           |
| Feature graphic, 1024×500          | [feature-graphic.png](feature-graphic.png)             |
| Phone screenshots, 1080×1920 (2–8) | [screenshots/](screenshots), upload in file-name order |

The screenshots are the web build at phone size (360×640 at 3×) with sample data: a camping trip with four friends. Tablet screenshots are optional and not needed for a phone app.

### Store settings

- App category: **Travel & Local**. Tags: Travel, Trip planner, To-do list.
- Contact email: your developer email (shown publicly). Website: the production site.

## 6. Closed testing, then production

Personal developer accounts created after November 2023 must run a **closed test with at least 12 testers opted in for 14 days in a row** before they can apply for production.

1. Testing → **Closed testing** → create a track, promote the internal release to it (or upload a new AAB).
2. Countries: Israel (add others if friends abroad test).
3. Testers: an email list of 12+ Google accounts. Send them the opt-in link; each must accept and install, and stay opted in for the 14 days. Ask a few more than 12 in case someone drops out.
4. Submit the release for review (the first review can take several days).
5. After 14 days: Dashboard → **Apply for production**, answer the questions about the test (how testers were recruited, the feedback, what changed).
6. Once approved: Production → create release → promote the tested build, countries: Israel, roll out.

After that, each new version: run **Android build** (production), upload the AAB to a track, promote. `versionCode` is the run number, so every build is newer than the last.
