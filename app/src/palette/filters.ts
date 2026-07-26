/**
 * Pure search/filter predicates behind the plant palette (`PlantPalette.tsx`,
 * Workplan Stage 3.3).
 *
 * Kept separate from the component, mirroring `plot/outline-ops.ts`'s "pure
 * logic, no DOM" split: whether a plant matches the current search text or
 * category is a plain data question, testable without rendering anything.
 * These are display-only narrowings applied *after* `rankPlants` — they never
 * change a plant's score, band, or order relative to another surviving plant,
 * only which rows the palette shows.
 */

import type { EdibleCategory, Plant, RankedPlant } from '@garden-planner/engine';

/** The category filter's value: a real category, or `'all'` to disable it. */
export type CategoryFilter = EdibleCategory | 'all';

/**
 * Whether `plant` matches a free-text search `query`. Case-insensitive
 * substring match against the common name, scientific name, and any
 * synonyms — the fields a gardener is likely to type (searching "chard"
 * should find a plant whose common name is something else but lists it as a
 * synonym). An empty/whitespace-only query matches everything, so the
 * search box's default (empty) state shows the whole ranked list.
 */
export function matchesSearch(plant: Plant, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;

  const haystacks = [plant.commonName, plant.scientificName, ...(plant.synonyms ?? [])];
  return haystacks.some((haystack) => haystack.toLowerCase().includes(needle));
}

/** Whether `plant` matches the category filter (`'all'` always matches). */
export function matchesCategory(plant: Plant, category: CategoryFilter): boolean {
  return category === 'all' || plant.category === category;
}

/**
 * Narrow an already-ranked list down to what the palette should render:
 * search text and category, both applied as simple `.filter`s that never
 * reorder the surviving entries.
 */
export function filterRanked(
  ranked: readonly RankedPlant[],
  search: string,
  category: CategoryFilter,
): RankedPlant[] {
  return ranked.filter(
    (entry) => matchesSearch(entry.plant, search) && matchesCategory(entry.plant, category),
  );
}
