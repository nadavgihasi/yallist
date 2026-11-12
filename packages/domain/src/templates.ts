import type { ItemKind, ListKind, TemplateId } from './types';

export interface TemplateItem {
  list: ListKind;
  category: string;
  name: string;
  kind: ItemKind;
  quantityNeeded: number;
  unit?: string;
  displayQty?: string;
}

type Spec =
  string | [name: string, opts: Partial<Omit<TemplateItem, 'list' | 'category' | 'name'>>];

function group(list: ListKind, category: string, specs: Spec[]): TemplateItem[] {
  return specs.map((spec) => {
    const [name, opts] = typeof spec === 'string' ? [spec, {}] : spec;
    const kind = opts.kind ?? (opts.quantityNeeded ? 'qty' : 'single');
    return { list, category, name, ...opts, kind, quantityNeeded: opts.quantityNeeded ?? 1 };
  });
}

const each = { kind: 'each' } as const;

/** SPEC Appendix A. Positions are the array order within each list. */
export const TEMPLATES: Record<TemplateId, TemplateItem[]> = {
  camp: [
    ...group('bring', 'בישול ועל האש', [
      'מנגל',
      ['פחמים', { quantityNeeded: 2, unit: 'שקים' }],
      'גזייה ובלון גז',
      ['צידניות', { quantityNeeded: 2 }],
      'מלקחיים',
      'קרש חיתוך וסכין',
      'סיר ומחבת',
    ]),
    ...group('bring', 'לינה וישיבה', [
      ['אוהלים', { quantityNeeded: 4 }],
      ['שק שינה', each],
      ['מזרן', each],
      ['פנס ראש', each],
      ['כיסאות מתקפלים', { quantityNeeded: 8 }],
      'צילייה',
    ]),
    ...group('bring', 'כללי', ['רמקול', 'ערכת עזרה ראשונה', 'שקיות זבל']),
    ...group('buy', 'בשר', [
      ['בשר לעל האש', { displayQty: '4 ק״ג' }],
      ['נקניקיות', { displayQty: '2 חבילות' }],
    ]),
    ...group('buy', 'לחם וסלטים', [['פיתות', { displayQty: '40' }], 'סלטים ומטבלים']),
    ...group('buy', 'שתייה', [['מים', { displayQty: '6 שישיות' }], 'בירות ושתייה קלה']),
    ...group('buy', 'ארוחת בוקר', [['ביצים', { displayQty: '30' }], 'קפה וחלב']),
  ],
  grill: [
    ...group('bring', 'על האש', [
      'מנגל',
      ['פחמים', { quantityNeeded: 2, unit: 'שקים' }],
      'מלקחיים',
      'מפוח למנגל',
      ['צידניות', { quantityNeeded: 2 }],
    ]),
    ...group('bring', 'ישיבה', [['כיסאות מתקפלים', { quantityNeeded: 8 }], 'מחצלת', 'צילייה']),
    ...group('bring', 'כללי', ['רמקול', 'שקיות זבל', 'צלחות וסכו״ם']),
    ...group('buy', 'בשר', ['בשר לעל האש', 'פרגיות']),
    ...group('buy', 'לחם וסלטים', ['פיתות', 'סלטים ומטבלים', 'ירקות']),
    ...group('buy', 'שתייה', ['שתייה', 'קרח']),
  ],
  zimmer: [
    ...group('bring', 'כללי', ['משחקי קופסה', 'רמקול', ['מגבת', each], ['בגד ים', each]]),
    ...group('buy', 'ארוחת בוקר', [
      'לחמים ומאפים',
      'גבינות וממרחים',
      'ביצים',
      'ירקות',
      'פירות',
      'קפה וחלב',
    ]),
    ...group('buy', 'ערב', ['בשר לערב', 'פחמים', 'יין', 'נשנושים']),
  ],
  beach: [
    ...group('bring', 'צל וישיבה', [
      'צילייה',
      ['מחצלות', { quantityNeeded: 2 }],
      ['כיסאות חוף', { quantityNeeded: 6 }],
    ]),
    ...group('bring', 'כללי', [
      'צידנית',
      'מטקות',
      'רמקול',
      'קרם הגנה',
      ['מגבת', each],
      'שקיות זבל',
    ]),
    ...group('buy', 'אוכל', ['אבטיח', 'כריכים', 'חטיפים', 'פירות']),
    ...group('buy', 'שתייה', ['מים', 'שתייה קלה', 'קרח']),
  ],
  hike: [
    ...group('bring', 'מסלול', [
      ['תיק יום', each],
      ['בקבוק מים', each],
      ['כובע', each],
      ['נעלי הליכה', each],
      'קרם הגנה',
      'ערכת עזרה ראשונה',
    ]),
    ...group('bring', 'פיקניק', ['מחצלת', 'גזייה', 'שקיות זבל']),
    ...group('buy', 'אוכל', ['כריכים', 'פירות', 'חטיפים', 'אגוזים']),
    ...group('buy', 'שתייה', ['מים', 'קפה', 'קרח']),
  ],
  trek: [
    ...group('bring', 'ציוד אישי', [
      ['תרמיל טיולים', each],
      ['שק שינה', each],
      ['מזרן', each],
      ['פנס ראש', each],
      ['מקלות הליכה', each],
      ['שקית מים', each],
      ['מעיל גשם', each],
    ]),
    ...group('bring', 'ציוד קבוצתי', [
      ['אוהלים', { quantityNeeded: 2 }],
      'גזייה ובלון גז',
      'סיר',
      'ערכת עזרה ראשונה',
      'מפה',
      'פאוור בנק',
    ]),
    ...group('buy', 'אוכל לדרך', ['ארוחה מוכנה', 'פתיתים', 'חטיפים', 'אגוזים', 'קפה', 'תה']),
    ...group('buy', 'שתייה', [['מים', { displayQty: '6 שישיות' }]]),
  ],
  flight: [
    ...group('bring', 'מסמכים וכסף', [['דרכון', each], 'ביטוח נסיעות', 'אישור הזמנה', 'מטבע זר']),
    ...group('bring', 'ציוד', [
      ['מזוודה', each],
      ['מתאם חשמל', each],
      ['פאוור בנק', each],
      ['כרית נסיעה', each],
      'ערכת עזרה ראשונה',
    ]),
    ...group('buy', 'לטיסה', ['נשנושים', 'מים']),
  ],
  ski: [
    ...group('bring', 'ביגוד', [
      ['מעיל סקי', each],
      ['מכנסי סקי', each],
      ['שכבה תרמית', each],
      ['כפפות', each],
      ['כובע גרב', each],
      ['גרבי סקי', each],
    ]),
    ...group('bring', 'ציוד', [
      ['משקפי סקי', each],
      ['קסדה', each],
      'קרם הגנה',
      'שפתון הגנה',
      'פאוור בנק',
    ]),
    ...group('buy', 'ארוחת בוקר', ['לחמים ומאפים', 'גבינות וממרחים', 'אבקת שוקו', 'תה']),
    ...group('buy', 'ערב', ['בשר לערב', 'יין', 'נשנושים']),
  ],
  blank: [],
};

export const QUICK_SUGGESTIONS: Record<ListKind, string[]> = {
  bring: ['מלקחיים', 'קרש חיתוך', 'צלחות וסכו״ם', 'מטקות', 'גפרורים'],
  buy: ['קרח', 'לחמניות', 'ירקות לסלט', 'מרשמלו', 'חטיפים'],
};
