/** All user-facing strings. Hebrew only for v1; another locale is a sibling file with the same shape. */
export const he = {
  appName: 'Yallist',
  login: {
    title: 'כל הטיול ברשימה אחת',
    subtitle: 'מי מביא מה, מה עוד חסר ומי חייב למי. בלי לגלול אחורה בקבוצה.',
    withName: 'מתחילים עם שם',
    nameLabel: 'איך קוראים לך?',
    namePlaceholder: 'איך קוראים לך?',
    start: 'יאללה',
    google: 'המשך עם Google',
    googleSoon: 'כניסה עם Google בקרוב',
    localOnly: 'בגרסה הזו הכול נשמר רק במכשיר הזה.',
  },
  home: {
    title: 'הטיולים שלי',
    newTrip: 'טיול חדש',
    past: 'טיולים שהיו',
    mine: 'אצלך: ',
  },
  firstHome: {
    emptyTitle: 'עוד אין טיולים',
    emptyText: 'פותחים טיול, שולחים קישור לחברים, וכל אחד בוחר מה הוא מביא.',
    steps: [
      ['פותחים טיול', 'בוחרים סוג, והרשימות מוכנות'],
      ['שולחים קישור בוואטסאפ', 'החברים מצטרפים מהדפדפן'],
      ['כל אחד לוקח פריטים', 'ורואים בזמן אמת מה עוד חסר'],
    ],
    demoTitle: 'רוצים לראות איך זה נראה?',
    demoText: 'טיול לדוגמה עם חברים, פריטים והוצאות',
    demo: 'טיול לדוגמה',
    cta: 'פתיחת טיול ראשון',
  },
  newTrip: {
    title: 'טיול חדש',
    kind: 'איזה סוג טיול?',
    kindHint: 'מתחילים מרשימה מוכנה ועורכים אחר כך',
    name: 'שם הטיול',
    namePlaceholder: 'למשל: קמפינג בכנרת',
    fallbackName: 'הטיול שלנו',
    when: 'מתי',
    from: 'יוצאים',
    to: 'חוזרים',
    where: 'איפה',
    optional: '(לא חובה)',
    wherePlaceholder: 'אפשר להחליט ביחד אחר כך',
    preview: 'מה נכנס לרשימות',
    previewBring: 'להביא: ',
    previewBuy: 'לקנות: ',
    previewBlank: 'מתחילים מאפס ומוסיפים פריטים אחרי היצירה.',
    create: 'יצירת הטיול',
    templates: {
      camp: 'קמפינג',
      grill: 'על האש',
      zimmer: 'צימר',
      beach: 'יום בחוף',
      blank: 'רשימה ריקה',
    },
    blankHint: 'מוסיפים לבד',
  },
  trip: {
    back: 'חזרה לכל הטיולים',
    tabs: { bring: 'להביא', buy: 'לקנות', people: 'אנשים', money: 'כסף' },
    filters: { all: 'הכול', missing: 'חסר', mine: 'אצלי' },
    allCovered: 'הכול מכוסה',
    oneMissing: 'פריט אחד עוד חסר',
    manyMissing: 'פריטים עוד חסרים',
    coveredOf: (done: number, total: number) => `${done} מתוך ${total} כבר מכוסים`,
    claimBring: 'אני אביא',
    claimBuy: 'אני אקנה',
    release: 'ביטול',
    have: 'יש לי',
    plusOne: 'אני אביא עוד אחד',
    minusOne: 'אחד פחות',
    empty: {
      missing: { title: 'אין כאן מה שחסר', text: 'כל הפריטים ברשימה הזו מכוסים.' },
      mine: { title: 'עוד לא לקחת כלום', text: 'בוחרים פריט חסר ולוחצים על ״אני אביא״.' },
      all: { title: 'הרשימה ריקה', text: 'מוסיפים פריט בכפתור הפלוס.' },
    },
    fab: {
      bring: 'הוספת פריט להבאה',
      buy: 'הוספת פריט לקנייה',
      money: 'הוספת הוצאה',
    },
    deleteTrip: 'מחיקת הטיול',
  },
  people: {
    addTitle: 'עוד מישהו מצטרף?',
    addText: 'בקרוב: שולחים קישור בוואטסאפ ומצטרפים מהדפדפן. בינתיים אפשר להוסיף חברים לפי שם.',
    addPlaceholder: 'שם',
    add: 'הוספה',
    count: (n: number) => `${n} משתתפים`,
    organizer: 'מארגן/ת',
    bring: (n: number) => `${n} להבאה`,
    buy: (n: number) => `${n} לקנייה`,
  },
  money: {
    payTo: (name: string) => `להעביר ל${name}`,
    nothingToPay: 'אין לך מה להעביר',
    getFrom: 'מגיע לך',
    share: (total: string, n: number) => `מתוך ${total} שהוצאו, מתחלק שווה בין ${n}`,
    markPaid: 'סימון כשולם',
    paidTo: (name: string, amount: string) => `סימנת ששילמת ${amount} ל${name}`,
    undo: 'ביטול',
    transfers: 'מי מעביר למי',
    settled: 'אין העברות פתוחות',
    settledText: 'כולם מסודרים.',
    expenses: 'הוצאות',
    total: (amount: string) => `סה״כ ${amount}`,
    noExpenses: 'עוד אין הוצאות. מוסיפים בכפתור הפלוס.',
  },
  item: {
    inBring: 'ברשימת ההבאה',
    inBuy: 'ברשימת הקניות',
    releaseMine: 'לא אני, לשחרר',
    price: 'כמה זה עלה?',
    splitBetween: 'מתחלק בין',
    perPerson: (amount: string) => `${amount} לכל אחד`,
    splitHint: (n: number, total: number) => `${n} מתוך ${total} משתתפים`,
    pickSomeone: 'בוחרים לפחות משתתף אחד',
    note: 'הערה',
    markBought: 'סימון כנקנה',
    updatePrice: 'שמירת הסכום',
    unmarkBought: 'ביטול הסימון כנקנה',
    delete: 'מחיקת הפריט',
  },
  addItem: {
    title: 'פריט חדש',
    what: 'מה צריך?',
    placeholder: { bring: 'למשל: מחצלת', buy: 'למשל: אבטיח' },
    howMany: 'כמה צריך?',
    kinds: {
      single: ['אחד', 'מישהו אחד לוקח'],
      qty: ['כמות', 'מתחלקים בכמות'],
      each: ['לכל אחד', 'כל אחד מביא משלו'],
    },
    total: 'כמה בסך הכול',
    category: 'קטגוריה',
    claimBring: 'אני אביא את זה',
    claimBuy: 'אני אקנה את זה',
    claimEach: 'יש לי כבר',
    cta: (name: string, list: 'bring' | 'buy') =>
      name
        ? `הוספת ״${name}״ ל${list === 'bring' ? 'רשימת ההבאה' : 'רשימת הקניות'}`
        : 'הוספה לרשימה',
  },
  addExpense: {
    title: 'הוצאה חדשה',
    amount: 'כמה?',
    what: 'על מה?',
    whatPlaceholder: 'למשל: קרח ופחמים',
    fromList: 'מרשימת הקניות:',
    paidBy: 'מי שילם?',
    save: 'שמירת ההוצאה',
  },
  join: {
    title: 'הצטרפות לטיול',
  },
} as const;

/** `חסר 1` / `חסרים 3` */
export function missingCount(n: number): string {
  return n === 1 ? 'חסר 1' : `חסרים ${n}`;
}

/** `פריט אחד` / `3 פריטים` */
export function itemsCount(n: number): string {
  return n === 1 ? 'פריט אחד' : `${n} פריטים`;
}

/** `טיול אחד בקרוב` / `2 טיולים בקרוב` */
export function upcomingCount(n: number): string {
  return n === 1 ? 'טיול אחד בקרוב' : `${n} טיולים בקרוב`;
}
