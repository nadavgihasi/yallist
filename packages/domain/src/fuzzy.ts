/**
 * How close a typed word is to a word, in typos: a letter missing, extra, wrong or two letters
 * swapped each count one (`צדנית` is 1 from `צידנית`, `מנגאל` 1 from `מנגל`, `נמגל` 1 from
 * `מנגל`). Returns the distance to the whole word and, when `prefix`, the best distance to any
 * start of it, so a word still being typed matches too. Gives up past `max`: undefined.
 *
 * Optimal string alignment over two rows (and the one before, for swaps), so it costs the
 * product of the lengths at most and stops as soon as no cell of a row is within `max`.
 */
export function typoDistance(
  typed: string,
  word: string,
  max: number,
  prefix = false,
): number | undefined {
  const n = typed.length;
  const m = word.length;
  if (!prefix && Math.abs(n - m) > max) return undefined;
  if (prefix && m < n - max) return undefined;
  // Rows over `word`: distance from typed[0..i] to word[0..j].
  let before: number[] = [];
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= m; j++) {
      const cost = typed[i - 1] === word[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && typed[i - 1] === word[j - 2] && typed[i - 2] === word[j - 1])
        d = Math.min(d, before[j - 2]! + 1);
      row.push(d);
      if (d < best) best = d;
    }
    if (best > max) return undefined;
    before = prev;
    prev = row;
  }
  const d = prefix ? Math.min(...prev) : prev[m]!;
  return d <= max ? d : undefined;
}

/**
 * The typos a typed word may have and still match: none for one or two letters (too many words
 * are a letter away), one up to six letters, two from seven.
 */
export const typosAllowed = (typed: string): number =>
  typed.length < 3 ? 0 : typed.length < 7 ? 1 : 2;

/** What matching only the start of a word adds to its typos: a whole word is the better match. */
const START_ONLY = 0.5;
/** What a typed word adds for matching a word in another place: צידנית לדגים before מטחנה ידנית. */
const OUT_OF_PLACE = 0.25;

/**
 * How many typos every typed word needs to match some word of a name (each its best), or
 * undefined when one doesn't. A typed word matches a whole word, or the start of one (for half a
 * typo more) when it has no typo or four letters, since a short word is a letter away from the
 * start of too many. Matching a word in another place than the typed one costs a quarter more.
 */
export function typoMatch(typed: string[], words: string[]): number | undefined {
  let total = 0;
  for (const [i, t] of typed.entries()) {
    const max = typosAllowed(t);
    const starts = max === 0 || t.length >= 4;
    let best: number | undefined;
    for (const [j, w] of words.entries()) {
      const place = j === i ? 0 : OUT_OF_PLACE;
      const whole = typoDistance(t, w, max);
      const start = starts ? typoDistance(t, w, max, true) : undefined;
      for (const cost of [
        whole === undefined ? undefined : whole + place,
        start === undefined ? undefined : start + START_ONLY + place,
      ])
        if (cost !== undefined && (best === undefined || cost < best)) best = cost;
      if (best === 0) break;
    }
    if (best === undefined) return undefined;
    total += best;
  }
  return total;
}
