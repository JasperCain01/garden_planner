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

import type { EdibleCategory, Plant, RankedPlant, SuitabilityBand } from '@garden-planner/engine';

/** The category filter's value: a real category, or `'all'` to disable it. */
export type CategoryFilter = EdibleCategory | 'all';

/**
 * The band filter's value (UI redesign Phase 3): every band, or only the two
 * the review calls "great fits".
 *
 * A named two-value type rather than a boolean `greatFitsOnly`, because the
 * filter is a *selection over bands* and will read as one if a third option
 * ever earns its place ("worth a try" = fair, say). The component holds this
 * value and passes it straight through; deciding which bands count as great
 * happens here, next to the other two predicates, not in JSX.
 */
export type BandFilter = 'all' | 'great';

/**
 * The bands "Great fits" keeps — the review's own definition, written once:
 *
 * > band filter ("Great fits" = excellent + good)
 *
 * `fair` is deliberately outside it. `rankPlants`' own note is that most of
 * today's dataset has no hardiness, soil or season data, so a crop can reach
 * `good` on light alone; `fair` is where "we know almost nothing about this"
 * lands, and a filter promising great fits should not include it.
 */
const GREAT_BANDS: readonly SuitabilityBand[] = ['excellent', 'good'];

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
 * Whether a ranked entry's suitability band survives the band filter
 * (`'all'` always matches). See {@link BandFilter}.
 *
 * Takes the band rather than the whole `RankedPlant` so it stays the same
 * shape as the two predicates above — a plain data question about one value.
 */
export function matchesBand(band: SuitabilityBand, filter: BandFilter): boolean {
  return filter === 'all' || GREAT_BANDS.includes(band);
}

/**
 * Narrow an already-ranked list down to what the palette should render:
 * search text, category and band, all applied as simple `.filter`s that never
 * reorder the surviving entries.
 *
 * The band filter is display-only in the same sense the other two are — it
 * hides rows the engine ranked, and never re-scores anything. It is *not* the
 * same thing as the palette's "hide unsuitable" toggle, which maps onto
 * `rankPlants`' own `excludeUnsuitable` option and so never produces the
 * entries at all; the two compose, and the more restrictive one wins.
 */
export function filterRanked(
  ranked: readonly RankedPlant[],
  search: string,
  category: CategoryFilter,
  band: BandFilter,
): RankedPlant[] {
  return ranked.filter(
    (entry) =>
      matchesSearch(entry.plant, search) &&
      matchesCategory(entry.plant, category) &&
      matchesBand(entry.suitability.band, band),
  );
}
