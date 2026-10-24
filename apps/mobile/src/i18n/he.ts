/** All user-facing strings. Hebrew only for v1; another locale is a sibling file with the same shape. */
export const he = {
  appName: 'Yallist',
  close: 'סגירה',
  unknownPerson: 'לא ידוע',
  invalidAmount: 'סכום לא תקין',
  me: 'אני',
  errors: {
    claimTaken: 'מישהו כבר לקח את זה, הרשימה עודכנה',
    failed: 'השינוי לא נשמר, נסו שוב',
    itemEditRefused: 'אי אפשר לשנות ככה: כבר לקחו או קנו את הפריט',
    categoryExists: 'כבר יש קטגוריה בשם הזה',
    loadFailed: 'לא הצלחנו לטעון. בודקים את החיבור ומנסים שוב.',
    retry: 'לנסות שוב',
    signIn: 'הכניסה לא הצליחה, נסו שוב',
  },
  login: {
    title: 'מי מביא מה?',
    subtitle: 'רשימה אחת לכל הטיול. פותחים, שולחים בוואטסאפ, וכולם רואים מה עוד חסר.',
    /** The sample list card (login.html). */
    sample: {
      label: 'דוגמה לרשימת ציוד',
      trip: 'קמפינג בכנרת',
      meta: '8 חברים · 14 מתוך 20 מסודרים',
      members: ['א', 'נ', 'מ', 'ש', 'ד', 'י', 'ר', 'ע'],
      done: 'ארוז',
      items: [
        ['אוהל ל־4', 'איתי מביא · ארוז'],
        ['חומוס ×3', 'נועה מביאה · ארוז'],
      ],
      open: ['מצננת', 'עוד אין מי שמביא'],
      claim: 'עליי',
    },
    withName: 'מתחילים עם שם',
    nameLabel: 'איך קוראים לך?',
    namePlaceholder: 'איך קוראים לך?',
    start: 'יאללה',
    google: 'המשך עם Google',
    googleSoon: 'כניסה עם Google בקרוב',
  },
  dates: {
    dayEarlier: 'יום אחד קודם',
    dayLater: 'יום אחד אחרי',
    weekdays: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    /** With the ב- prefix, as used after a day number. */
    months: [
      'בינואר',
      'בפברואר',
      'במרץ',
      'באפריל',
      'במאי',
      'ביוני',
      'ביולי',
      'באוגוסט',
      'בספטמבר',
      'באוקטובר',
      'בנובמבר',
      'בדצמבר',
    ],
  },
  countdown: {
    now: 'עכשיו בטיול',
    ended: 'הסתיים',
    tomorrow: 'מחר',
    twoDays: 'בעוד יומיים',
    days: (n: number) => `בעוד ${n} ימים`,
  },
  home: {
    title: 'הטיולים שלי',
    newTrip: 'טיול חדש',
    past: 'טיולים שהיו',
    mine: 'אצלך: ',
    noItems: 'עוד אין פריטים',
  },
  firstHome: {
    emptyTitle: 'עוד אין טיולים',
    emptyText: 'פותחים טיול, שולחים קישור לחברים, ובוחרים ביחד מי מביא מה.',
    steps: [
      ['פותחים טיול', 'בוחרים סוג, והרשימות מוכנות'],
      ['שולחים קישור בוואטסאפ', 'החברים מצטרפים מהדפדפן'],
      ['לוקחים פריטים', 'ורואים בזמן אמת מה עוד חסר'],
    ],
    cta: 'פתיחת טיול ראשון',
  },
  newTrip: {
    title: 'טיול חדש',
    back: 'חזרה לטיולים שלי',
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
    /** Curated highlights per template (NewTripV2), not the first N items. */
    previews: {
      camp: ['אוהלים, שקי שינה, גזייה, פנסי ראש ועוד', 'בשר, ביצים, מים, קפה ועוד'],
      grill: ['מנגל, פחמים, צידנית, כיסאות מתקפלים ועוד', 'בשר, פיתות, סלטים, שתייה ועוד'],
      zimmer: ['משחקי קופסה, רמקול, מגבות ועוד', 'ארוחת בוקר, יין, נשנושים ועוד'],
      beach: ['צילייה, מחצלות, צידנית, מטקות ועוד', 'אבטיח, קרח, מים, כריכים ועוד'],
    },
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
    notFound: 'הטיול לא נמצא',
    tabs: { bring: 'להביא', buy: 'לקנות', people: 'אנשים', money: 'כסף' },
    filters: { all: 'הכול', missing: 'חסר', mine: 'אצלי' },
    allCovered: 'הכול מכוסה',
    coveredOf: (done: number, total: number) => `${done} מתוך ${total} כבר מכוסים`,
    claimBring: 'אני אביא',
    claimBuy: 'אני אקנה',
    release: 'ביטול',
    releaseLabel: 'שחרור הפריט',
    have: 'יש לי',
    plusOne: 'אני אביא עוד אחד',
    minusOne: 'אחד פחות',
    empty: {
      missing: { title: 'אין כאן מה שחסר', text: 'כל הפריטים ברשימה הזו מכוסים.' },
      mine: { title: 'עוד לא לקחת כלום', text: 'בוחרים פריט חסר ולוחצים על ״אני אביא״.' },
      mineBuy: { title: 'עוד לא לקחת כלום', text: 'בוחרים פריט חסר ולוחצים על ״אני אקנה״.' },
      all: { title: 'הרשימה ריקה', text: 'מוסיפים פריט בכפתור הפלוס.' },
    },
    uncategorized: 'ללא קטגוריה',
    addCategory: 'קטגוריה חדשה',
    addToCategory: 'הוספת פריט',
    addToCategoryLabel: (name: string) => `הוספת פריט לקטגוריה ${name}`,
    editCategory: (name: string) => `עריכת הקטגוריה ${name}`,
    fab: {
      bring: 'הוספת פריט להבאה',
      buy: 'הוספת פריט לקנייה',
      money: 'הוספת הוצאה',
    },
    /** Visible floating-button labels; `fab` stays the accessible name. */
    fabShort: { bring: 'פריט חדש', buy: 'פריט חדש', money: 'הוצאה חדשה' },
    invite: 'הזמנת חברים',
    tabCount: (label: string, n: number) => `${label} · ${n}`,
  },
  status: {
    missing: 'חסר',
    mine: 'אצלך',
    covered: 'מכוסה',
    inProgress: 'בטיפול',
    bought: 'נקנה',
    at: (names: string) => `אצל ${names}`,
    mineQty: (n: number) => `אצלך ${n}`,
    notYet: (names: string) => `עוד לא: ${names}`,
    of: (have: number, total: number) => `${have} מתוך ${total}`,
    boughtBy: (amount: string, name: string) => `${amount}, ${name}`,
    boughtByMe: (amount: string) => `${amount}, שילמת`,
    forEach: 'לכל אחד',
  },
  people: {
    inviteTitle: 'עוד חברים מצטרפים?',
    inviteText: 'שולחים את הקישור בוואטסאפ, וכל אחד מצטרף מהדפדפן.',
    share: 'שיתוף הקישור',
    copied: 'הקישור הועתק',
    pending: 'מחכים לאישור',
    approve: 'אישור',
    decline: 'דחייה',
    remove: 'הסרה',
    confirmRemove: 'להסיר?',
    organizer: 'מארגן/ת',
    bring: (n: number) => `${n} להבאה`,
    buy: (n: number) => `${n} לקנייה`,
  },
  money: {
    payTo: (names: string) => `להעביר ל${names}`,
    paidTo: (names: string) => `שולם ל${names}`,
    nothingToPay: 'אין לך מה להעביר',
    getFrom: 'מגיע לך',
    share: (mine: string, total: string) => `החלק שלך ${mine} מתוך ${total}`,
    markPaid: 'סימון כשולם',
    markedPaid: 'סומן כשולם',
    transfers: 'מי מעביר למי',
    settled: 'אין העברות פתוחות',
    settledText: 'כולם מסודרים.',
    expenses: 'הוצאות',
    noExpenses: 'עוד אין הוצאות',
    noExpensesText: 'מוסיפים הוצאה בכפתור הפלוס.',
    total: (amount: string) => `סה״כ ${amount}`,
    sharedBy: (n: number) => `${n} מתחלקים`,
  },
  item: {
    inBring: 'ברשימת ההבאה',
    inBuy: 'ברשימת הקניות',
    releaseMine: 'לא אני, לשחרר',
    price: 'כמה זה עלה?',
    splitBetween: 'מתחלק בין',
    perPerson: (amount: string) => `${amount} לכל אחד`,
    splitHint: (n: number, total: number) => `${n} מתוך ${total} משתתפים`,
    enterAmount: 'רושמים סכום ורואים כמה יוצא לכל אחד',
    pickSomeone: 'בוחרים לפחות משתתף אחד',
    note: 'הערה',
    markBought: 'סימון כנקנה',
    unmarkBought: 'ביטול הסימון כנקנה',
    edit: 'עריכת הפריט',
    delete: 'מחיקת הפריט',
    confirmDelete: 'למחוק? לוחצים שוב לאישור',
  },
  category: {
    newTitle: 'קטגוריה חדשה',
    editTitle: 'עריכת קטגוריה',
    name: 'שם הקטגוריה',
    placeholder: 'למשל: ארוחת בוקר',
    add: 'הוספת הקטגוריה',
    save: 'שמירה',
    moveUp: 'הזזה למעלה',
    moveDown: 'הזזה למטה',
    delete: 'מחיקת הקטגוריה',
    confirmDelete: 'למחוק את הקטגוריה?',
    keepsItems: (n: number) => `${itemsCount(n)} יעברו ל״ללא קטגוריה״`,
  },
  editItem: {
    title: 'עריכת פריט',
    save: 'שמירת השינויים',
  },
  addItem: {
    title: 'פריט חדש',
    what: 'מה צריך?',
    placeholder: { bring: 'למשל: מחצלת', buy: 'למשל: אבטיח' },
    howMany: 'כמה צריך?',
    kinds: {
      single: ['אחד', 'פריט אחד לכולם'],
      qty: ['כמות', 'מתחלקים בכמות'],
      each: ['לכל אחד', 'כל אחד מביא משלו'],
    },
    total: 'כמה בסך הכול',
    more: 'עוד אחד',
    less: 'אחד פחות',
    category: 'קטגוריה',
    newCategory: 'קטגוריה חדשה',
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
    missing: 'מה עוד חסר',
    nameLabel: 'איך קוראים לך?',
    join: 'הצטרפות לטיול',
    invalid: 'הקישור לא תקף',
    invalidText: 'אולי הוחלף בקישור חדש. מבקשים מהמארגנים את הקישור העדכני.',
    pendingTitle: 'הבקשה נשלחה',
    pendingText: 'המארגנים יאשרו אותך בקרוב, והטיול ייפתח כאן.',
    removed: 'אין אפשרות להצטרף לטיול הזה',
    toTrips: 'לטיולים שלי',
  },
} as const;

/** `חסר 1` / `חסרים 3` */
export function missingCount(n: number): string {
  return n === 1 ? 'חסר 1' : `חסרים ${n}`;
}

/** Category header summary, mockup word order: `חסר 1` / `3 חסרים` */
export function groupMissing(n: number): string {
  return n === 1 ? 'חסר 1' : `${n} חסרים`;
}

/** `פריט אחד` / `3 פריטים` */
export function itemsCount(n: number): string {
  return n === 1 ? 'פריט אחד' : `${n} פריטים`;
}

/** `פריט אחד חסר` / `11 פריטים חסרים` */
export function missingItems(n: number): string {
  return n === 1 ? 'פריט אחד חסר' : `${n} פריטים חסרים`;
}

/** `משתתף אחד` / `8 משתתפים` */
export function participants(n: number): string {
  return n === 1 ? 'משתתף אחד' : `${n} משתתפים`;
}

/** `העברה אחת פתוחה` / `2 העברות פתוחות` */
export function openTransfers(n: number): string {
  return n === 1 ? 'העברה אחת פתוחה' : `${n} העברות פתוחות`;
}

/** `דנה` / `דנה ורון` / `דנה, רון ושירה` */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}`;
}
