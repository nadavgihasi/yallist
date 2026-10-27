import type { BagEntry } from '@yallist/domain';

import { he } from '@/i18n/he';

/** An entry's line in my bag: where it comes from, `· ארוז` once packed. */
export function bagLabel(entry: BagEntry): string {
  const parts = [
    entry.source !== 'private' && he.bag.source[entry.source],
    entry.packed && he.status.packed,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** An entry's name in my bag, with `×4` for my part of a qty item. */
export function bagName(entry: BagEntry): string {
  return entry.item.kind === 'qty' ? `${entry.item.name} ×${entry.quantity}` : entry.item.name;
}
