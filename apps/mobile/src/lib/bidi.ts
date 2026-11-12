/**
 * Wraps a number run ("6/24", "8–9.11") in LRI…PDI (U+2066…U+2069), so it keeps its order inside
 * a Hebrew sentence with other neutrals around it. Nested `<Text>` does not isolate; this does.
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}

/**
 * Wraps an item name in RLI…PDI (U+2067…U+2069): it reads right to left as it was typed, even
 * when it starts with an English word or a number, and its English words and numbers don't run
 * into what's next to it (`סוללות AA, 2 גזיות` would show the `2` next to `סוללות`).
 */
export function rtl(text: string): string {
  return `\u2067${text}\u2069`;
}

/**
 * Wraps a run in FSI…PDI (U+2068…U+2069): it keeps its own direction and doesn't join the text
 * next to it, as an item's quantity after a name ending in English would.
 */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`;
}
