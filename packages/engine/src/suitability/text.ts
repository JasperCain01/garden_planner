/**
 * Tiny text helpers shared by the reason-building code in this module.
 *
 * They live in one file because the reason strings are a **deliverable** (the
 * palette shows them), so their phrasing should be consistent across all four
 * dimensions rather than re-implemented per scorer.
 */

/**
 * `["a", "b", "c"]` → `"a, b and c"`; `[]` → `""`.
 *
 * Takes the conjunction because the reason strings need both: "loam, sand **or**
 * clay" for a list of things a crop accepts (any one will do), "texture, pH
 * **and** moisture" for a list of things that are all true.
 */
export function joinWords(words: readonly string[], conjunction: 'and' | 'or' = 'and'): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words[words.length - 1]}`;
}

/** Capitalise the first character, for a clause promoted to the start of a sentence. */
export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
