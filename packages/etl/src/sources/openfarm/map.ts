/**
 * Maps one raw OpenFarm rescue-dump record into the Stage 0.2 `Plant` shape
 * (WORKPLAN.md Stage 1.2; see `docs/adr/0006-openfarm-source-adapter.md`).
 *
 * This module is deliberately conservative: a record is only mapped when
 * every field the schema *requires* (`category`, `light`, `spacing`) can be
 * populated from data the source actually provides — no field is guessed or
 * defaulted to make a record pass. Everything else follows the brief's
 * "only populate fields the source actually provides; most fields are
 * optional" rule by simply not being set. Records that can't clear the bar
 * are **skipped with a stated reason**, never silently dropped or forced
 * through with made-up values — the same discipline the GBIF resolver uses
 * for names it can't confidently place (`resolve/gbif-resolver.ts`).
 *
 * `gbifId` is intentionally left `null` here — filling it is the resolver's
 * job (`resolve/apply-resolution.ts`'s `applyGbifResolution`), called by
 * `build-plants.ts` after this module decides a record is otherwise
 * mappable. `validatePlant` is still run in this module (with `gbifId: null`,
 * which the schema allows) so a record is proven schema-shaped *before* it is
 * ever sent to GBIF — no point spending a resolution on a record this adapter
 * couldn't ship anyway.
 */

import { validatePlant, type LightRequirement, type Plant } from '@garden-planner/engine';
import { OPENFARM_CATEGORY_OVERRIDES } from './categories.ts';
import { OPENFARM_CACHE_RETRIEVED_AT } from './cache.ts';
import type { OpenFarmCropRaw } from './types.ts';

/** Human-readable why-not, for logging and tests — never surfaced to end users. */
export interface OpenFarmSkip {
  readonly slug: string;
  readonly reason: string;
}

export interface OpenFarmMapped {
  /** A schema-valid `Plant`, `gbifId` still `null` pending resolution. */
  readonly plant: Plant;
  /** The name to resolve against GBIF — see {@link pickResolveName}. */
  readonly resolveName: string;
}

export type OpenFarmMapOutcome =
  ({ readonly skipped: false } & OpenFarmMapped) | ({ readonly skipped: true } & OpenFarmSkip);

/**
 * OpenFarm's own placeholder text for a page whose real title didn't survive
 * scraping (see the rescue project's README). A record with this as its
 * `name` carries no usable common name, so it's unmappable.
 */
const PLACEHOLDER_NAME = 'You Can Grow Anything';

/**
 * OpenFarm's `sun` field is free-ish text (curation trimmed most of it to a
 * few values, but not all — see the field-coverage table in the ADR). Map the
 * values that are unambiguous; anything else (`"No specific"`,
 * `"Add this information"`, absent) is treated as no usable light data,
 * because `Plant.light` is required and guessing would be a horticultural
 * claim this adapter has no basis for.
 */
function mapSun(sun: string | undefined): LightRequirement | undefined {
  if (sun === undefined) return undefined;
  switch (sun.trim().toLowerCase()) {
    case 'full sun':
      return 'full-sun';
    case 'partial sun':
      return 'partial-shade';
    case 'full shade':
      return 'full-shade';
    default:
      return undefined;
  }
}

/**
 * Pick the name to resolve against GBIF, preferring the scientific name when
 * the source gives one — a taxonomic match on a binomial is far less
 * ambiguous than one on a common name (unlike Stage 1.1's demo list, which
 * only ever had common names to work with). Some records list several
 * binomials comma-separated for a species complex (e.g. amaranth); GBIF
 * resolves one taxon per query, so this takes the first and leaves the rest
 * unused — a documented simplification, not a data-loss bug, since the
 * `scientificName` field mapped below also only keeps that first name.
 */
function pickResolveName(raw: OpenFarmCropRaw): string {
  const binomial = raw.binomialName?.split(',')[0]?.trim();
  return binomial && binomial.length > 0 ? binomial : raw.name;
}

/** Reformat OpenFarm's `YYYYMMDD` capture date into ISO-8601 (`YYYY-MM-DD`). */
function formatCapturedDate(captured: string): string | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(captured);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

/**
 * Map one raw record, or explain why it can't be mapped. Pure and
 * synchronous — it never touches the network or the GBIF resolver, so it's
 * trivially unit-testable (see `map.test.ts`).
 */
export function mapOpenFarmCrop(raw: OpenFarmCropRaw): OpenFarmMapOutcome {
  const skip = (reason: string): OpenFarmMapOutcome => ({ skipped: true, slug: raw.slug, reason });

  if (raw.name === PLACEHOLDER_NAME) {
    return skip(`name is OpenFarm's scrape placeholder ("${PLACEHOLDER_NAME}"), not a real title`);
  }

  const category = OPENFARM_CATEGORY_OVERRIDES[raw.slug];
  if (category === undefined) {
    return skip('no curated edible-category classification for this slug (see categories.ts)');
  }

  const light = mapSun(raw.sun);
  if (light === undefined) {
    return skip(`sun value ${JSON.stringify(raw.sun)} does not map to a light requirement`);
  }

  const binomial = raw.binomialName?.split(',')[0]?.trim();
  if (!binomial) {
    return skip('no binomial (scientific) name to seed the Plant record with');
  }

  if (
    raw.spreadCm === undefined ||
    raw.rowSpacingCm === undefined ||
    raw.spreadCm <= 0 ||
    raw.rowSpacingCm <= 0
  ) {
    return skip('missing or non-positive spreadCm/rowSpacingCm — no valid row spacing to build');
  }

  const capturedNote = formatCapturedDate(raw.source.captured);

  const plant = validatePlant({
    id: raw.slug,
    commonName: raw.name,
    scientificName: binomial,
    gbifId: null,
    category,
    light,
    spacing: {
      row: {
        // OpenFarm's "spread" is the recommended distance to the next plant
        // of the same crop; "row spacing" is the distance between rows — a
        // direct, unit-for-unit fit for the schema's row-spacing pair (see
        // the ADR for why no intensive/per-m² figure is derived from these).
        inRowCm: raw.spreadCm,
        betweenRowCm: raw.rowSpacingCm,
      },
    },
    provenance: {
      sources: [
        {
          source: 'OpenFarm crops rescue (community Wayback Machine recovery)',
          sourceId: raw.slug,
          url: raw.source.waybackUrl,
          license: raw.source.license,
          retrievedAt: OPENFARM_CACHE_RETRIEVED_AT,
          note: capturedNote
            ? `OpenFarm.cc page archived via Wayback Machine on ${capturedNote}; OpenFarm's own live API was shut down before this project could use it (see docs/adr/0006).`
            : "OpenFarm.cc page recovered via Wayback Machine; OpenFarm's own live API was shut down before this project could use it (see docs/adr/0006).",
        },
      ],
    },
  });

  return { skipped: false, plant, resolveName: pickResolveName(raw) };
}
