import {
  findCatalogItem,
  sameItem,
  type CatalogItem,
  type Category,
  type Item,
  type ItemKind,
  type ListKind,
} from '@yallist/domain';

import type { Action, NewItemInput } from '@/state/reducer';
import type { Answer } from '@/state/trips';

/** The longest item name the API takes (`text(80)` in apps/api/src/routes/items.ts). */
export const ITEM_NAME_MAX = 80;

/** The counter shows once a name is this close to the limit. */
export const COUNTER_FROM = ITEM_NAME_MAX - 20;

/** Sends `action`, having `answer` told when the API takes or refuses it. */
type Act = (action: Action, answer: Answer) => void;

/**
 * Sends a change and settles once the API answered it, without waiting for the trip to refetch:
 * the add sheet stays open until then, so a failed save keeps what was typed. Offline, the change
 * queues (shown at once) as any other, so there is nothing to wait for.
 */
export const saved = (act: Act, action: Action, online: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    act(action, { onSaved: resolve, onError: reject });
    if (!online) resolve();
  });

/** Marks the "new category" chip as the picked category. */
export const NEW = 'new';

/** What the add sheet holds. `category` is a category id, `NEW`, or undefined: uncategorized. */
export interface Draft {
  list: ListKind;
  name: string;
  kind: ItemKind;
  qty: number;
  category?: string;
  /** The name for a `NEW` category. */
  newName: string;
}

/** The draft's category, if it is on the draft's list (or `NEW`); else uncategorized. */
export const pickedCategory = (draft: Draft, categories: readonly Category[]) =>
  draft.category === NEW || categories.some((c) => c.id === draft.category && c.list === draft.list)
    ? draft.category
    : undefined;

/**
 * The draft as a catalog item fills it in: its name, list, how it's counted and its category (the
 * trip's own if it has one of that name, otherwise a new one, unless one is already picked). Both
 * tapping a suggestion and saving a name the catalog knows do this.
 */
export function fillFromCatalog(
  draft: Draft,
  entry: CatalogItem,
  categories: readonly Category[],
): Draft {
  const picked = pickedCategory(draft, categories);
  const own = categories.find((c) => c.list === entry.list && c.name === entry.category);
  const next: Draft = {
    ...draft,
    name: entry.name,
    list: entry.list,
    kind: entry.kind,
    qty: entry.kind === 'qty' ? entry.quantityNeeded : draft.qty,
  };
  if (own) return { ...next, category: own.id };
  if (picked === undefined) return { ...next, category: NEW, newName: entry.category };
  return next;
}

/**
 * A new item's name typed in full as the catalog has it on this list, or another name for it
 * (`גריל` for `מנגל`): saving it fills it in as tapping its suggestion would. Not one on the other
 * list: typing doesn't move the item there; its suggestion still can.
 */
export function typedCatalogItem(draft: Draft): CatalogItem | undefined {
  const entry = findCatalogItem(draft.name);
  return entry?.list === draft.list ? entry : undefined;
}

/** What saving the draft sends. `newCategory` is the name of a category to create for it. */
export function toSave(
  d: Draft,
  categories: readonly Category[],
): { item: NewItemInput; newCategory?: string } {
  const picked = pickedCategory(d, categories);
  const newName = d.newName.trim();
  // Typing an existing name picks that category instead of making a second one.
  const existing = categories.find(
    (c) => c.list === d.list && c.name.toLowerCase() === newName.toLowerCase(),
  );
  const categoryId = picked === NEW ? (existing?.id ?? null) : (picked ?? null);
  return {
    item: {
      list: d.list,
      name: d.name.trim(),
      kind: d.kind,
      quantityNeeded: d.kind === 'qty' ? d.qty : 1,
      categoryId,
    },
    newCategory: picked === NEW && !existing ? newName : undefined,
  };
}

/**
 * The item a list already has under that name, or another name of it (`גריל` for `מנגל`): the same
 * check my bag makes, so both screens agree on what's a duplicate.
 */
export const duplicateOf = (
  items: readonly Item[],
  { list, name }: Pick<NewItemInput, 'list' | 'name'>,
): Item | undefined => items.find((i) => i.list === list && sameItem(i.name, name));
