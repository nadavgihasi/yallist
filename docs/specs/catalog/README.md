# Items catalog

A built-in catalog of about 6,600 common items in Hebrew (`packages/domain/src/catalog.ts`, data in
`catalog-data/buy.ts` and `bring.ts`), in 45 categories: what to bring (cooking, sleeping, clothes,
tools, tech, beach, winter, bikes and cars, fishing, kids, pets, party, documents…) and what to buy
(meat, fish, produce, dairy, cheese, bread, pantry, spices, snacks, drinks, alcohol, cleaning…).
Each item has a category, an emoji icon, how it's usually counted and its synonyms.

- **Autocomplete.** The add-item sheet and My Bag suggest catalog items as you type: the start of a
  name, a later word, a synonym, a singular for a plural. Before anything is typed, the categories
  open their items, 24 at a time. Picking an item fills its list, count (`single` / `qty` / `each`)
  and category: the trip's own category of that name, or a new one.
- **One item per name.** A synonym is another name for the same thing (`גריל` for `מנגל`,
  `אוהל` for `אוהלים`), never a related item: `מנגו` does not find `אננס`. A name or synonym belongs
  to one item (tested; a clash drops the later one).
- **Icons.** Every item row, in a trip and in My Bag, shows the catalog's icon by name. Most items
  have their own emoji (assigned by keyword: mango 🥭, tent ⛺); the rest use their category's. An item
  the catalog doesn't know gets 🎒 (bring) or 🛒 (buy).
- **Matching.** A trip item meets my bag by `sameItem`: equal after normalizing (niqqud, quotes,
  dashes, case) or the same catalog item. The API uses the same rule (`dal/bag.ts`), so nothing is
  stored differently: names stay as typed.
- **Data format.** One line per run of items sharing an icon, under `@category` headings:
  `🔥: מנגל=גריל, פחמים, צידניות*2`. `*each` is per-person, `*4` a quantity, `=a/b` synonyms.
- **Adding items.** Every trip template item must be in the catalog (tested).
