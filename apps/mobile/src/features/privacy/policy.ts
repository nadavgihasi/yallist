/** Where privacy questions go. Deleting the account is in the app (profile screen). */
// TODO: the real address.
export const PRIVACY_EMAIL = 'privacy@example.com';

export interface Policy {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; lines: string[] }[];
  /** The link to the other language. */
  other: string;
}

/**
 * The privacy policy (/privacy, linked from the Google Play listing), Hebrew and English. Keep
 * it true to the code: what the API stores (apps/api/src/db/schema.ts), the photos bucket and
 * region (infra/app), Sentry's scrubbing (packages/domain/src/scrub.ts) and feedback issues
 * (apps/api/src/feedback-issue.ts), deleting the account (deleteUser, apps/api/src/dal/profiles.ts).
 * Change `updated` with the text.
 */
export const policy: Record<'he' | 'en', Policy> = {
  he: {
    title: 'מדיניות פרטיות',
    updated: 'עודכן: 7 בנובמבר 2026',
    intro:
      'Yallist היא רשימה משותפת לטיולים קבוצתיים: מי מביא מה, קניות והוצאות. כאן כתוב מה אנחנו שומרים, למה ומי רואה את זה. בקצרה: רק מה שהאפליקציה צריכה כדי לעבוד. אין פרסומות, אין כלי אנליטיקה, ואנחנו לא מוכרים מידע.',
    sections: [
      {
        title: 'מה נשמר',
        lines: [
          'חשבון: בכניסה כאורח, רק השם שבחרת. בכניסה עם Google, השם, כתובת המייל ותמונת הפרופיל מ-Google, ומזהה חשבון Google.',
          'פרופיל: שם תצוגה, צבע, תמונה אם העלית, ומספר טלפון ל-Bit או PayBox אם הוספת.',
          'טיולים: הטיולים שיצרת או שהצטרפת אליהם (שם, תאריכים, מקום, תמונת רקע), החברים ותפקידם, פריטים וקטגוריות, מי מביא, קנה או ארז מה, סבבי קניות, הוצאות ואיך הן מתחלקות, תשלומים בין החברים, ויומן של השינויים בטיול.',
          'תמונות: קבלות שצירפת להוצאות ותמונת הפרופיל שלך.',
          'משוב: אם שלחת רעיון או דיווח על תקלה, הכותרת, הטקסט, גרסת האפליקציה והפלטפורמה.',
          'חיבור: כשנכנסים נשמרים מפתח חיבור, כתובת ה-IP וסוג הדפדפן או המכשיר.',
          'דיווחי שגיאות (Sentry): כשמשהו נכשל באפליקציה או בשרת, נשלחים פרטים טכניים על השגיאה. לפני השליחה מוסרים מהם מזהה המשתמש, כתובת ה-IP, מיילים, מספרי טלפון, מפתחות וכל טקסט בעברית (שמות, טיולים ופריטים). באתר נשלחים גם נתוני ביצועים מ-5% מהטעינות, מנוקים באותה דרך.',
        ],
      },
      {
        title: 'מה נשמר במכשיר',
        lines: [
          'אין עוגיות (cookies). האפליקציה שומרת במכשיר את מפתח החיבור ועותק של הטיולים (באתר: ב-localStorage), כדי שתיפתח מהר ותעבוד גם בלי קליטה טובה. היציאה מהחשבון מוחקת אותם.',
          'כניסה עם Google עוברת דרך שירות הכניסה של Google, לפי מדיניות הפרטיות של Google.',
        ],
      },
      {
        title: 'מי רואה מה',
        lines: [
          'החברים בטיול רואים את השם, התמונה או הצבע שלך, ואת מה שעשית בטיול: פריטים שלקחת, הוצאות, קבלות ותשלומים.',
          'מי שיש לו קישור הזמנה לטיול רואה תצוגה מקדימה: שם הטיול, התאריכים, מספר החברים וכמה פריטים חסרים. לא את שמות החברים.',
          'משוב הופך ל-issue ציבורי ב-GitHub: הכותרת והטקסט, גרסת האפליקציה, הפלטפורמה וקוד אנונימי. בלי השם או פרטי החשבון שלך, אז לא כדאי לכתוב בו פרטים אישיים.',
          'ספקים שמפעילים את השירות בשבילנו: Amazon Web Services (שרתים, מסד נתונים ותמונות), Google (רק בכניסה עם Google), Sentry (דיווחי שגיאות) ו-GitHub (משוב). התראות על שגיאות, מנוקות כמו למעלה, מגיעות למפתח ב-Telegram.',
          'אף אחד אחר. אנחנו לא מוכרים ולא משתפים מידע לפרסום.',
        ],
      },
      {
        title: 'איפה זה נשמר',
        lines: [
          'ב-Amazon Web Services בפרנקפורט, באיחוד האירופי. התמונות פרטיות: האפליקציה מקבלת קישור לצפייה לזמן קצר, ותמונת פרופיל רק בשביל חברים לטיול.',
        ],
      },
      {
        title: 'כמה זמן',
        lines: [
          'החשבון והפרופיל נשמרים כל עוד החשבון קיים.',
          'טיול נשמר עד שמארגן מוחק אותו. המחיקה מוחקת לכל החברים את הפריטים, ההוצאות, הקבלות וההיסטוריה של הטיול. מי שעוזב טיול או מוסר ממנו, מה שעשה בטיול נשאר בו.',
          'חשבון אורח שיצאו ממנו כבר אי אפשר לפתוח שוב, וגם לא למחוק מהאפליקציה. כדי למחוק חשבון אורח, מוחקים אותו לפני היציאה.',
          'גיבויים של מסד הנתונים נשמרים 7 ימים.',
          'משוב נשמר עד שמוחקים את החשבון. ה-issue ב-GitHub נשאר ציבורי עד שנסיר אותו.',
        ],
      },
      {
        title: 'מחיקת החשבון והמידע',
        lines: [
          'את החשבון מוחקים בעצמכם באפליקציה, בלי לפנות אלינו: במסך הפרופיל, ״מחיקת החשבון״. המחיקה מיידית: החשבון, הפרופיל (שם, תמונה וטלפון), חיבור ה-Google, המשובים ובקשות ההצטרפות לטיולים נמחקים, והחשבון מנותק בכל המכשירים.',
          'אפשר למחוק את החשבון רק כשאין לך טיולים, כי טיול משותף לכל החברים. בלשונית ״ניהול״ של כל טיול אפשר לצאת ממנו, ומארגנים יכולים גם למחוק אותו עם כל המידע שבו. מארגן/ת יחיד/ה של טיול לא יוצא/ת ממנו אלא מוחק/ת אותו.',
          'בטיולים שיצאת מהם או שהוסרת מהם, מה שעשית בהם (פריטים, הוצאות ותשלומים) נשאר אצל שאר החברים, בלי השם שלך: במקומו מופיע ״חשבון שנמחק״.',
          'עותקים בגיבויים נמחקים תוך 7 ימים. issue ציבורי ב-GitHub שנוצר ממשוב לא נמחק עם החשבון.',
          'בכל זמן אפשר גם לשנות את השם ולהסיר את התמונה.',
        ],
      },
      {
        title: 'שינויים ושאלות',
        lines: ['כשהמדיניות משתנה, נעדכן את הדף הזה ואת התאריך למעלה.', `שאלות? ${PRIVACY_EMAIL}`],
      },
    ],
    other: 'English',
  },
  en: {
    title: 'Privacy policy',
    updated: 'Updated: November 7, 2026',
    intro:
      "Yallist is a shared list for group trips: who brings what, shopping and expenses. This page says what we keep, why, and who sees it. In short: only what the app needs to work. No ads, no analytics, and we don't sell data.",
    sections: [
      {
        title: 'What we keep',
        lines: [
          'Account: as a guest, only the name you choose. With Google sign-in, your name, email address and profile photo from Google, and your Google account ID.',
          'Profile: display name, color, a photo if you upload one, and a phone number for Bit or PayBox if you add one.',
          "Trips: the trips you create or join (name, dates, place, cover image), members and their roles, items and categories, who's bringing, bought or packed what, shopping runs, expenses and how they're split, payments between members, and a log of changes in the trip.",
          'Photos: receipts you attach to expenses, and your profile photo.',
          'Feedback: if you send an idea or a bug report, its title, text, app version and platform.',
          'Sign-in: a session token, the IP address and the browser or device type, recorded when you sign in.',
          'Error reports (Sentry): when something fails in the app or on the server, technical details of the error are sent. Before sending, they are stripped of your user ID, IP address, emails, phone numbers, tokens and all Hebrew text (names, trips and items). The website also sends performance data from 5% of page loads, scrubbed the same way.',
        ],
      },
      {
        title: 'On your device',
        lines: [
          'No cookies. The app keeps your session token and a copy of your trips on the device (localStorage on the web), so it opens fast and works with weak reception. Signing out removes them.',
          "Google sign-in goes through Google's sign-in service, under Google's privacy policy.",
        ],
      },
      {
        title: 'Who sees what',
        lines: [
          'Members of your trips see your name, photo or color, and what you do in the trip: items you take, expenses, receipts and payments.',
          "Anyone with a trip's invite link sees a preview: the trip's name, dates, number of members and some missing items. Not the members' names.",
          "Feedback becomes a public GitHub issue: the title and text, app version, platform and an anonymous code. Not your name or account details, so don't put personal details in it.",
          'Providers that run the service for us: Amazon Web Services (servers, database and photos), Google (only with Google sign-in), Sentry (error reports) and GitHub (feedback). Error alerts, scrubbed as above, reach the developer on Telegram.',
          "No one else. We don't sell or share data for advertising.",
        ],
      },
      {
        title: "Where it's stored",
        lines: [
          'On Amazon Web Services in Frankfurt, in the EU. Photos are private: the app gets a short-lived link to view one, and a profile photo only for trip members.',
        ],
      },
      {
        title: 'How long',
        lines: [
          'Your account and profile are kept while the account exists.',
          "A trip is kept until an organizer deletes it. That deletes the trip's items, expenses, receipts and history for every member. If you leave a trip or are removed, what you did in it stays.",
          "A guest account you've signed out of can't be opened again, so it can't be deleted from the app either. To delete a guest account, delete it before signing out.",
          'Database backups are kept for 7 days.',
          'Feedback is kept until you delete your account. Its GitHub issue stays public until we remove it.',
        ],
      },
      {
        title: 'Deleting your account and data',
        lines: [
          "You delete your account yourself, in the app, without contacting us: on the profile screen, “מחיקת החשבון” (delete account). It's immediate: your account, profile (name, photo and phone), Google sign-in link, feedback and requests to join trips are deleted, and you're signed out on every device.",
          "You can delete your account once you're in no trip, since a trip is shared by all its members. Leave any trip from its “ניהול” (manage) tab; organizers can also delete it there, with everything in it. A trip's only organizer deletes it rather than leaving.",
          'In trips you left or were removed from, what you did (items, expenses and payments) stays for the other members, without your name: it shows as “חשבון שנמחק” (deleted account).',
          "Copies in backups are gone within 7 days. A public GitHub issue made from your feedback isn't deleted with the account.",
          'You can also change your name and remove your photo at any time.',
        ],
      },
      {
        title: 'Changes and questions',
        lines: [
          'When this policy changes, we update this page and the date above.',
          `Questions? ${PRIVACY_EMAIL}`,
        ],
      },
    ],
    other: 'עברית',
  },
};
