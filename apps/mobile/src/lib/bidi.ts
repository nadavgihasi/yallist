/**
 * Wraps a number run ("6/24", "8–9.11") in LRI…PDI (U+2066…U+2069), so it keeps its order inside
 * a Hebrew sentence with other neutrals around it. Nested `<Text>` does not isolate; this does.
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}
