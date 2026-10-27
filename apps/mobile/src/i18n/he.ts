/** All user-facing strings. Hebrew only for v1; another locale is a sibling file with the same shape. */
export const he = {
  appName: 'Yallist',
  version: (v: string) => `גרסה ${v}`,
  close: 'סגירה',
  unknownPerson: 'לא ידוע',
  invalidAmount: 'סכום לא תקין',
  me: 'אני',
  errors: {
    claimTaken: 'מישהו כבר לקח את זה, הרשימה עודכנה',
    failed: 'השינוי לא נשמר, נסו שוב',
    itemEditRefused: 'אי אפשר לשנות ככה: כבר לקחו או קנו את הפריט',
    runOver: 'הקניות האלה כבר נסגרו, הרשימה עודכנה',
    categoryExists: 'כבר יש קטגוריה בשם הזה',
    retry: 'לנסות שוב',
    signIn: 'הכניסה לא הצליחה, נסו שוב',
    sessionExpired: 'צריך להיכנס שוב',
  },
  /** Loading, empty and error states (EmptyState, Loader, Skeleton). */
  states: {
    loading: 'טוען',
    /** The Loader's one line, after two seconds. */
    boot: 'מעמיסים את הרכב…',
    joinLoading: 'פותחים את ההזמנה…',
    offline: { title: 'אין קליטה, כמו בנחל', text: 'בודקים את החיבור ומנסים שוב.' },
    notFound: { title: 'השביל הזה לא מסומן', text: 'אולי הקישור ישן, אולי טעות הקלדה.' },
    crash: {
      title: 'משהו השתבש',
      text: 'נתקלנו בתקלה אצלנו. אפשר לנסות שוב, או לחזור לטיולים.',
    },
    toTrips: 'לטיולים שלי',
    tip: 'כדאי לדעת',
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
    starting: 'נכנסים…',
    otherWays: 'דרכים אחרות להיכנס',
    google: 'המשך עם Google',
    googleSoon: 'כניסה עם Google בקרוב',
  },
  dates: {
    /** Screen-reader hint on a date field. */
    pickHint: 'פותח לוח שנה',
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
    ended: 'הסתיים',
    today: 'היום',
    tomorrow: 'מחר!',
    twoDays: 'עוד יומיים',
    days: (n: number) => `עוד ${n} ימים`,
    day: (n: number, of: number) => `יום ${n} מתוך ${of}`,
  },
  home: {
    title: 'הטיולים שלי',
    newTrip: 'טיול חדש',
    past: 'טיולים שהיו',
    mine: 'אצלך: ',
    noItems: 'עוד אין פריטים',
    startFrom: 'מתחילים מ…',
    oneTap: 'לחיצה אחת, רשימה מלאה',
    openTrip: 'פותחים טיול חדש',
    invite: {
      title: 'טיול של אחד? מזמינים חברים',
      text: 'שולחים קישור בוואטסאפ ורואים מי מביא מה.',
    },
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
    previewBring: 'ציוד: ',
    previewBuy: 'קניות: ',
    previewBlank: 'מתחילים מאפס ומוסיפים פריטים אחרי היצירה.',
    /** Curated highlights per template (NewTripV2), not the first N items. */
    previews: {
      camp: ['אוהלים, שקי שינה, גזייה, פנסי ראש ועוד', 'בשר, ביצים, מים, קפה ועוד'],
      grill: ['מנגל, פחמים, צידנית, כיסאות מתקפלים ועוד', 'בשר, פיתות, סלטים, שתייה ועוד'],
      zimmer: ['משחקי קופסה, רמקול, מגבות ועוד', 'ארוחת בוקר, יין, נשנושים ועוד'],
      beach: ['צילייה, מחצלות, צידנית, מטקות ועוד', 'אבטיח, קרח, מים, כריכים ועוד'],
    },
    create: 'יצירת הטיול',
    creating: 'יוצרים את הטיול…',
    templates: {
      camp: 'קמפינג',
      grill: 'על האש',
      zimmer: 'צימר',
      beach: 'יום בחוף',
      blank: 'רשימה ריקה',
    },
    blankHint: 'מוסיפים לבד',
    tip: 'רשימה מוכנה, לא סגורה: מוסיפים, מוחקים ומשנים פריטים ביחד עם כולם.',
  },
  trip: {
    back: 'חזרה לכל הטיולים',
    tabs: { bring: 'ציוד', buy: 'קניות', money: 'כסף', people: 'ניהול' },
    filters: { all: 'הכול', missing: 'חסר', mine: 'אצלי' },
    allCovered: 'הכול מכוסה',
    coveredOf: (done: number, total: number) => `${done} מתוך ${total} כבר מכוסים`,
    claimBring: 'אני אביא',
    claimBuy: 'אני אקנה',
    release: 'ביטול',
    releaseLabel: 'שחרור הפריט',
    have: 'יש לי',
    pack: 'סימון כארוז',
    unpack: 'סימון כלא ארוז',
    coveredCount: (done: number, total: number) => `${done} מתוך ${total} מסודרים`,
    plusOne: 'אני אביא עוד אחד',
    minusOne: 'אחד פחות',
    empty: {
      missing: { title: 'אין כאן מה שחסר', text: 'כל הפריטים ברשימה הזו מכוסים.' },
      mine: { title: 'עוד לא לקחת כלום', text: 'בוחרים פריט חסר ולוחצים על ״אני אביא״.' },
      mineBuy: { title: 'עוד לא לקחת כלום', text: 'בוחרים פריט חסר ולוחצים על ״אני אקנה״.' },
      all: { title: 'הרשימה ריקה', text: 'מתחילים מהצעות או מוסיפים לבד.' },
      toMissing: 'מה עוד חסר',
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
    packed: 'ארוז',
    packedOf: (packed: number, claims: number) => `ארזו ${packed} מתוך ${claims}`,
  },
  hero: {
    /** `חסרים 13: אוהלים, קפה, קרח…` */
    missing: (count: string, names: string[], more: boolean) =>
      `${count}: ${names.join(', ')}${more ? '…' : ''}`,
    solo: 'לבד פה בינתיים · הזמנת חברים',
    share: 'שליחת מה שחסר בוואטסאפ',
  },
  share: {
    missing: (trip: string, dates: string, names: string, link: string) =>
      `חסרים ל${trip} (${dates}): ${names}. מי מביא? ${link}`,
    allCovered: (trip: string, link: string) => `הכול מכוסה ל${trip} 🎉 ${link}`,
  },
  deleteTrip: {
    action: 'מחיקת טיול',
    title: 'למחוק את הטיול?',
    warning: 'אי אפשר לבטל את זה. הטיול יימחק לכל המשתתפים, עם הרשימות, ההוצאות והקבלות.',
    nameLabel: 'כדי לאשר, הקלידו את שם הטיול',
    confirm: 'מחיקה לצמיתות',
    deleted: 'הטיול נמחק',
    /** A trip open on screen stopped loading with a 404: deleted, or we were removed from it. */
    gone: 'הטיול נמחק או שכבר אין לך גישה אליו',
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
    confirmDecline: 'לדחות?',
    removed: (name: string) => `${name} כבר לא בטיול`,
    noItems: 'עוד בלי פריטים',
    organizer: 'מארגן/ת',
    bring: (n: number) => `${n} להבאה`,
    buy: (n: number) => `${n} לקנייה`,
  },
  money: {
    payTo: (names: string) => `להעביר ל${names}`,
    paidTo: (names: string) => `שולם ל${names}`,
    nothingToPay: 'אין לך מה להעביר',
    getFrom: (names: string) => `מגיע לך מ${names}`,
    share: (mine: string, total: string) => `החלק שלך ${mine} מתוך ${total}`,
    markPaid: 'סימון כשולם',
    markedToast: (amount: string) => `סומן ששילמת ${amount}`,
    waiting: 'מחכה לאישור שהכסף הגיע',
    received: 'הכסף התקבל',
    unmark: 'ביטול הסימון',
    payments: 'תשלומים',
    paymentWaiting: 'מחכה לאישור',
    paymentConfirmed: 'התקבל',
    confirmReceived: 'קיבלתי את הכסף',
    deleteExpense: 'מחיקה',
    confirmDelete: 'למחוק?',
    transfers: 'מי מעביר למי',
    settled: 'אין העברות פתוחות',
    settledText: 'כולם מסודרים.',
    expenses: 'הוצאות',
    noExpenses: 'עוד אין הוצאות',
    noExpensesText: 'מוסיפים הוצאה, ויאליסט מחשב מי מעביר למי.',
    addExpense: 'הוספת הוצאה',
    tip: 'מצלמים את הקבלה כשמוסיפים הוצאה, וכולם בטיול יכולים לראות אותה.',
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
    saved: (amount: string) => `ההוצאה נשמרה: ${amount}`,
  },
  /** Shopping runs (PACKING_SHOPPING_SPEC §6.5–6.8). */
  shop: {
    start: 'יוצאים לקנות',
    startCaption: 'מסמנים מה לוקחים, וכולם רואים שזה עליך.',
    picked: (k: number, n: number) => `פנויים · ${k} מתוך ${n} נבחרו`,
    selectAll: 'בחירת הכול',
    clear: 'ניקוי',
    taken: 'כבר של מישהו',
    claim: (k: number) => `עליי · ${itemsCount(k)}`,
    pickOne: 'בוחרים לפחות פריט אחד',
    skipped: (item: string, name: string) => `${item} כבר אצל ${name}`,
    mine: (n: number) => `הקניות שלך פתוחות · ${itemsCount(n)}`,
    waiting: 'ממתין לחיבור',
    others: (name: string, n: number) => `${name} בסופר עכשיו · ${itemsCount(n)}`,
    buying: (name: string) => `${name} קונה עכשיו`,
    title: 'בסופר',
    subtitle: (trip: string) => `קניות ל${trip}`,
    back: 'חזרה לטיול',
    everyoneSees: 'כולם רואים שהקניות האלה עליך',
    inCart: (c: number, n: number) => `${c} מתוך ${n} בעגלה`,
    toCart: (name: string) => `סימון ${name} בעגלה`,
    fromCart: (name: string) => `הוצאת ${name} מהעגלה`,
    addedBy: (name: string) => `נוסף עכשיו ע״י ${name}`,
    alsoMine: 'גם עליי',
    dismiss: 'הסתרה',
    checkout: 'סיימתי, לקופה',
    menu: 'עוד אפשרויות',
    cancel: 'ביטול הקניות',
    cancelConfirm: 'כל הפריטים יחזרו לרשימה',
    cancelYes: 'כן, לבטל',
    keep: 'השארת הקניות',
    finish: {
      title: 'כמה יצא בקופה?',
      amount: 'סכום אחד לכל הקנייה',
      receipt: 'צילום קבלה · לא חובה',
      bought: (c: number) => (c === 1 ? 'פריט אחד יסומן כנקנה' : `${c} פריטים יסומנו כנקנו`),
      returns: (names: string[]) =>
        `${joinNames(names)} ${names.length === 1 ? 'חוזר' : 'חוזרים'} לרשימה`,
      returnsHint: 'מישהו אחר יכול לקחת',
      perPerson: (amount: string) => `${amount} לכל אחד`,
      enterAmount: 'מזינים סכום',
      split: (k: number, n: number) =>
        k === n ? `מתחלק שווה בין ${n} בטיול` : `מתחלק שווה בין ${k} מתוך ${n} בטיול`,
      change: 'שינוי',
      save: 'שמירה',
      empty: 'אין פריטים בעגלה',
    },
  },
  receipt: {
    title: 'קבלה',
    label: 'קבלה (לא חובה)',
    camera: 'צילום',
    gallery: 'מהגלריה',
    choose: 'בחירת תמונה',
    preparing: 'מכינים את התמונה…',
    remove: 'הסרת הקבלה',
    open: 'הקבלה',
    add: 'הוספת קבלה',
    none: 'אין קבלה להוצאה הזאת',
    noneText: 'מצלמים את הקבלה או בוחרים תמונה, וכולם בטיול יוכלו לראות אותה.',
    uploading: (percent: number) => `מעלים את הקבלה… ${percent}%`,
    failed: 'העלאת הקבלה נכשלה',
    retry: 'ניסיון חוזר',
    failedToast: 'ההוצאה נשמרה, אבל הקבלה לא עלתה. אפשר לנסות שוב מההוצאה.',
    delete: 'מחיקת הקבלה',
    confirmDelete: 'למחוק את הקבלה?',
    close: 'סגירה',
    loadFailed: 'לא הצלחנו לטעון את הקבלה',
    noCamera: 'צריך הרשאה למצלמה כדי לצלם קבלה',
  },
  cover: {
    title: 'תמונת כיסוי',
    hint: 'מה שכולם יראו בכרטיס הטיול',
    change: 'החלפת תמונת הכיסוי',
    changeShort: 'כיסוי',
    /** Each cover's accessible name (a short description of its scene). */
    names: {
      camp: 'קמפינג ליד המים',
      beach: 'חוף הים',
      desert: 'מדבר ונגב',
      forest: 'צפון, גליל וגולן',
      zimmer: 'צימר',
      trail: 'מסלול הליכה',
      city: 'ירושלים והעיר',
      picnic: 'פיקניק ופסטיבל',
      winter: 'חורף וגשם',
      flight: 'טיסה לחו״ל',
    },
  },
  join: {
    invited: 'הוזמנת לטיול',
    missing: 'מה עוד חסר',
    nameLabel: 'איך קוראים לך?',
    join: 'הצטרפות לטיול',
    joining: 'מצטרפים…',
    noAccount: 'בלי הורדה ובלי סיסמה. אפשר להתקין את האפליקציה אחר כך.',
    invalid: 'הקישור לא תקף',
    invalidText: 'אולי הוחלף בקישור חדש. מבקשים מהמארגנים את הקישור העדכני.',
    pendingTitle: 'דפקת בדלת',
    pendingText: (trip: string) =>
      `הבקשה להצטרף ל${trip} נשלחה. המארגנים יאשרו בקרוב, והדף מתעדכן לבד.`,
    pendingTip: 'אפשר להוסיף את הקישור למסך הבית, וחוזרים לטיול בלחיצה.',
    checkNow: 'בדיקה עכשיו',
    checking: 'בודקים…',
    removed: 'אין אפשרות להצטרף לטיול הזה',
    removedText: 'אם זו טעות, כדאי לדבר עם המארגנים.',
    toTrips: 'לטיולים שלי',
    toStart: 'למסך הפתיחה',
  },
  profile: {
    title: 'הפרופיל שלי',
    open: 'החשבון שלי',
    back: 'חזרה',
    color: 'צבע',
    colorOption: (n: number) => `צבע ${n}`,
    photo: 'תמונת הפרופיל',
    addPhoto: 'הוספת תמונה',
    changePhoto: 'החלפת תמונה',
    removePhoto: 'הסרת התמונה',
    photoHint: 'רק מי שבטיולים שלך יראו אותה',
    photoFailed: 'העלאת התמונה נכשלה, נסו שוב',
    name: 'שם',
    nameHint: 'כך יראו אותך בטיולים חדשים',
    payments: 'תשלומים',
    phone: 'טלפון לקבלת כסף',
    phoneHint: 'כדי שחברים לטיול יוכלו להעביר לך ב-Bit או ב-PayBox',
    phonePlaceholder: '050-0000000',
    phoneInvalid: 'מספר נייד ישראלי, למשל 050-1234567',
    account: 'חשבון',
    guest: 'נכנסת כאורח',
    guestHint: 'הטיולים שמורים רק במכשיר הזה. מחברים חשבון Google כדי לא לאבד אותם.',
    google: 'חשבון Google',
    linked: 'החשבון חובר ל-Google',
    notifications: {
      title: 'התראות בדרך',
      text: 'תזכורת יום לפני הטיול עם מה שעוד חסר, ועדכון כשמישהו לוקח פריט או מוסיף הוצאה.',
    },
    signOut: 'התנתקות',
    signOutConfirm: 'להתנתק?',
    signOutGuest:
      'נכנסת כאורח: אחרי ההתנתקות לא תהיה דרך לחזור לטיולים שלך. כדאי לחבר קודם חשבון Google.',
    signOutYes: 'כן, להתנתק',
    cancel: 'ביטול',
    feedback: 'משוב',
    suggest: "הצעת פיצ'ר",
    suggestHint: 'רעיון לשיפור או משהו שלא עובד',
  },
  feedback: {
    title: { feature: "הצעת פיצ'ר", bug: 'דיווח על תקלה' },
    kind: 'מה רוצים לשלוח?',
    kinds: { feature: 'רעיון', bug: 'משהו לא עובד' },
    subject: 'כותרת',
    subjectPlaceholder: { feature: 'למשל: תזכורת לפני הטיול', bug: 'למשל: הכפתור לא מגיב' },
    details: 'פרטים',
    optional: '(לא חובה)',
    detailsPlaceholder: 'מה היה עוזר לכם, או מה קרה?',
    publicHint: 'נפתח כ-issue ציבורי ב-GitHub של Yallist, בלי השם או פרטי החשבון שלך.',
    send: 'שליחה',
    sending: 'שולחים…',
    thanks: 'תודה! קיבלנו',
    failed: 'השליחה לא הצליחה, נסו שוב',
    tooMany: 'שלחת הרבה בקשות. אפשר לנסות שוב בעוד שעה.',
  },
} as const;

/** `ועוד 5`, after a cut-off list. */
export function andMore(n: number): string {
  return `ועוד ${n}`;
}

/** Under the join button when already signed in. */
export function joiningAs(name: string): string {
  return `ההצטרפות תהיה בשם ${name}`;
}

/** `חסר 1` / `חסרים 3` */
export function missingCount(n: number): string {
  return n === 1 ? 'חסר 1' : `חסרים ${n}`;
}

/** The bring list's progress card: `ארוז 1` / `9 ארוזים` */
export function packedCount(n: number): string {
  return n === 1 ? 'ארוז 1' : `${n} ארוזים`;
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

/** `אוהלים, קפה, קרח ועוד 10`: the first missing names out of `missing`. */
export function missingNames(names: string[], missing: number): string {
  const more = missing - names.length;
  return more > 0 ? `${names.join(', ')} ${andMore(more)}` : names.join(', ');
}

/** `דנה, אבי ונועה`, then `דנה, אבי ועוד 2` past three. */
export function peopleNames(names: string[]): string {
  return names.length <= 3
    ? joinNames(names)
    : `${names.slice(0, 2).join(', ')} ${andMore(names.length - 2)}`;
}

/** `דנה` / `דנה ורון` / `דנה, רון ושירה` */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}`;
}
