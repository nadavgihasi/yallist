# Items catalog

A built-in catalog of ~300 common items (`packages/domain/src/catalog.ts`), in Hebrew, each with a
category, an emoji icon, how it's usually counted and the other names people type for it.

- **Autocomplete.** The add-item sheet and My Bag suggest catalog items as you type (prefix of the
  name, a later word, an alias). Before anything is typed, the catalog's categories open their
  items. Picking an item fills its list, count (`single` / `qty` / `each`) and category: the trip's
  own category of that name, or a new one.
- **Icons.** Every item row, in a trip and in My Bag, shows the catalog's icon by name; an item the
  catalog doesn't know gets 🎒 (bring) or 🛒 (buy).
- **Matching.** A trip item meets my bag by `sameItem`: equal after normalizing (niqqud, quotes,
  dashes, case) or the same catalog item (`גריל` = `מנגל`, `אוהל` = `אוהלים`). The API uses the
  same rule (`dal/bag.ts`), so nothing is stored differently: names stay as typed.
- **Adding items.** One entry per name and alias across the catalog (checked by a test), and every
  trip template item must be in it.
