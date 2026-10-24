import type { Claim, Expense } from '@yallist/domain';

import { addDays, today } from '@/lib/dates';
import { newId } from '@/lib/id';

import { buildTrip, memberColor } from './reducer';
import type { Me, TripData } from './types';

const FRIENDS = ['דנה', 'יואב', 'מיכל', 'אורי', 'רון', 'שירה', 'אלון'];

/** Claims by item name → friend name (or `me`) → quantity. Mirrors the TripV2 mockup. */
const CLAIMS: Record<string, Record<string, number>> = {
  מנגל: { רון: 1 },
  'גזייה ובלון גז': { אורי: 1 },
  צידניות: { דנה: 1 },
  אוהלים: { יואב: 1, אורי: 2 },
  'כיסאות מתקפלים': { מיכל: 3, שירה: 2 },
  'שק שינה': { דנה: 1, יואב: 1, מיכל: 1, אורי: 1, רון: 1, שירה: 1 },
  'פנס ראש': { מיכל: 1, שירה: 1, אלון: 1 },
  רמקול: { אלון: 1 },
  'שקיות זבל': { me: 1 },
  'בשר לעל האש': { דנה: 1 },
  פיתות: { רון: 1 },
  'סלטים ומטבלים': { מיכל: 1 },
  'בירות ושתייה קלה': { שירה: 1 },
  ביצים: { me: 1 },
};

const PURCHASES: [item: string, payer: string, shekels: number][] = [
  ['בשר לעל האש', 'דנה', 450],
  ['סלטים ומטבלים', 'מיכל', 90],
  ['בירות ושתייה קלה', 'שירה', 180],
];

/** A filled-in sample trip so a single person can see how the app feels with a group. */
export function buildDemoTrip(me: Me): TripData {
  const daysToThursday = (4 - new Date().getDay() + 7) % 7;
  const startsOn = addDays(today(), daysToThursday + 21);
  const data = buildTrip(
    {
      name: 'קמפינג בכנרת',
      startsOn,
      endsOn: addDays(startsOn, 1),
      placeText: 'חוף גופרה',
      template: 'camp',
    },
    me,
  );
  const ids = new Map<string, string>([['me', me.userId]]);
  FRIENDS.forEach((name, i) => {
    const userId = newId();
    ids.set(name, userId);
    data.members.push({
      userId,
      displayName: name,
      role: 'member',
      status: 'active',
      color: memberColor(i + 1),
    });
  });
  const itemId = (name: string) => data.items.find((i) => i.name === name)!.id;

  const claims: Claim[] = Object.entries(CLAIMS).flatMap(([item, who]) =>
    Object.entries(who).map(([name, quantity]) => ({
      itemId: itemId(item),
      userId: ids.get(name)!,
      quantity,
    })),
  );
  const everyone = [...ids.values()];
  const expenses: Expense[] = PURCHASES.map(([item, payer, shekels]) => ({
    id: newId(),
    itemId: itemId(item),
    description: item,
    amountAgorot: shekels * 100,
    paidBy: ids.get(payer)!,
    shares: everyone,
  }));
  return { ...data, claims, expenses };
}
