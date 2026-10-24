/** All user-facing strings. Hebrew only for v1; another locale is a sibling file with the same shape. */
export const he = {
  appName: 'Yallist',
  login: {
    title: 'מתכננים טיול ביחד',
    subtitle: 'מה כל אחד מביא, מה עוד חסר, ומי חייב למי.',
  },
  home: {
    title: 'הטיולים שלי',
  },
  join: {
    title: 'הצטרפות לטיול',
  },
  notFound: {
    title: 'הדף לא נמצא',
    back: 'חזרה לטיולים',
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
