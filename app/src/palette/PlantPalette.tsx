/**
 * The plant palette (Workplan Stage 3.3) — `DESIGN.md` §1 step 2 of the core
 * loop: "the app scores every plant in its database against the plot's
 * conditions and presents a filtered, ranked palette". Reads the current
 * plant list (`usePlantList`) and the plot store's growing-conditions input
 * directly, so it re-ranks live whenever either changes — there is no prop
 * threading between this component and `PlotDefinitionPage`'s form, only a
 * shared Zustand store (ADR 0015's convention).
 *
 * **Layout decision (the brief's one open call):** the palette renders
 * *on the plot-definition page*, below the growing-conditions form, rather
 * than behind a separate route. See `docs/architecture.md`'s Stage 3.3 note
 * for the reasoning (short version: `DESIGN.md`'s core loop reads as one
 * continuous flow, and Stage 3.4's canvas will want the palette visible
 * alongside placement rather than a nav click away).
 *
 * Ranking itself is entirely `rankPlants`' job (`@garden-planner/engine`) —
 * this component adds only **display-only** narrowing on top (search,
 * category, and an unsuitable-hiding toggle that maps onto `rankPlants`'
 * own `excludeUnsuitable` option), and never re-derives a score or reason
 * the engine already computed. `rankPlants`' own note applies here too: most
 * of today's shipped dataset has no hardiness/soil/season data, so a bare
 * score would overstate certainty — every entry shows the engine's own
 * `summary`, `confidence`, and per-dimension reasoning instead of a lone
 * number.
 */

import { useMemo, useState } from 'react';
import {
  BAND_LABELS,
  EdibleCategorySchema,
  rankPlants,
  resolvePlotConditions,
  type SuitabilityBand,
} from '@garden-planner/engine';
import { usePlantList } from '../state/use-plant-list.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { filterRanked, type CategoryFilter } from './filters.ts';

const CATEGORY_OPTIONS = EdibleCategorySchema.options;

/** Colour cue per band, from a confident match (green) to a hard mismatch (grey-out). */
const BAND_COLORS: Readonly<Record<SuitabilityBand, string>> = {
  excellent: '#1a7f37',
  good: '#4c8c2b',
  fair: '#9a7b0a',
  poor: '#b35c00',
  unsuitable: '#767676',
};

export function PlantPalette() {
  const plants = usePlantList();
  const conditionsInput = usePlotStore((state) => state.conditionsInput);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [hideUnsuitable, setHideUnsuitable] = useState(false);

  /**
   * `conditionsInput` is the form's editable shape, not the resolved
   * `PlotConditions` `rankPlants` needs — resolve it here, at the point of
   * use, per the brief (`resolvePlotConditions` is the store's job to
   * expose, not to pre-resolve). The store's own defaults and
   * `PlotConditionsForm`'s controlled inputs mean this should not normally
   * throw, but a `try`/`catch` is cheap insurance against a corrupted value
   * reaching here, mirroring `PlotConditionsForm`'s own inline validity check.
   */
  const conditions = useMemo(() => {
    try {
      return resolvePlotConditions(conditionsInput);
    } catch {
      return null;
    }
  }, [conditionsInput]);

  const ranked = useMemo(
    () => (conditions ? rankPlants(plants, conditions, { excludeUnsuitable: hideUnsuitable }) : []),
    [plants, conditions, hideUnsuitable],
  );

  const visible = useMemo(() => filterRanked(ranked, search, category), [ranked, search, category]);

  return (
    <section>
      <h2>2. Discover suitable plants</h2>

      {conditions === null ? (
        <p role="alert">
          Fix the growing-conditions form above to see ranked suggestions — the palette needs valid
          conditions to score against.
        </p>
      ) : (
        <>
          <p>
            Ranked against your plot&rsquo;s current conditions. Most of today&rsquo;s dataset has
            no hardiness, soil or season data, so read the confidence and per-plant reasoning below,
            not just the band.
          </p>

          <div>
            <label htmlFor="palette-search">Search</label>
            <input
              id="palette-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name…"
            />
          </div>

          <div>
            <label htmlFor="palette-category">Category</label>
            <select
              id="palette-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={hideUnsuitable}
                onChange={(event) => setHideUnsuitable(event.target.checked)}
              />
              Hide unsuitable crops
            </label>
          </div>

          <p>
            {visible.length} of {ranked.length} crops shown.
          </p>

          {visible.length === 0 ? (
            <p>No crops match your plot&rsquo;s conditions and current filters.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {visible.map(({ plant, suitability }) => (
                <li
                  key={plant.id}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                    opacity: suitability.band === 'unsuitable' ? 0.6 : 1,
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {plant.commonName}{' '}
                    <span style={{ color: BAND_COLORS[suitability.band], fontSize: '0.85em' }}>
                      {BAND_LABELS[suitability.band]}
                    </span>
                  </h3>
                  <p style={{ margin: '0.25rem 0', fontStyle: 'italic' }}>{plant.category}</p>
                  <p style={{ margin: '0.25rem 0' }}>{suitability.summary}</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.85em' }}>
                    Confidence: {Math.round(suitability.confidence * 100)}%
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {suitability.dimensions.map((dimension) => (
                      <li key={dimension.dimension}>
                        <strong>{dimension.dimension}:</strong> {dimension.reason}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
