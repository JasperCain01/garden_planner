/**
 * Hand-curated climate profiles: the UK default plus a small, extensible set
 * of regions (Workplan Stage 1.6; design in
 * `docs/adr/0010-location-climate-static-data.md`).
 *
 * **Why hand-curated, not fetched.** This is a *run-time static asset* (like
 * Stage 1.5's dataset), not an ETL ingest — it ships with the app and must
 * resolve with no network at all. On top of that, in the sandbox this table
 * was authored in (2026-07-23), direct page fetches to `rhs.org.uk` and
 * Met Office endpoints are blocked by the egress proxy (HTTP 403) — the same
 * class of blocker Stages 1.1–1.3 documented for GBIF/PFAF/RHS
 * (`docs/adr/0007` §3). The figures below were retrieved instead via **web
 * search result snippets** of those sources' own pages, the same sanctioned
 * path Stage 1.3's spacing table used: a genuine retrieval of the source's own
 * words, with the real URL recorded, not a guess. A reviewer with unrestricted
 * network access can re-open every cited URL and confirm each figure.
 *
 * **Precision.** Frost dates are long-run *averages*, not records for any
 * particular year — actual frost in a given year can be 1–3 weeks earlier or
 * later than the date recorded here. Where sources genuinely disagreed, the
 * citation's `note` records the disagreement and which value was chosen and
 * why, rather than papering over it (see `SOUTH_WEST_ENGLAND` and
 * `NORTHERN_ENGLAND` below).
 */

import type { SourceRef } from '../schema/plant.ts';
import type { ClimateProfile } from './schema.ts';
import { deriveGrowingSeason } from './season.ts';

/** The date these figures were retrieved/verified (ISO-8601). */
const RETRIEVED_AT = '2026-07-23';

/** Build a {@link SourceRef} for a named source, keeping the citations below uniform. */
function cite(source: string, url: string, note?: string): SourceRef {
  return note === undefined
    ? { source, url, retrievedAt: RETRIEVED_AT }
    : { source, url, retrievedAt: RETRIEVED_AT, note };
}

/** RHS's own hardiness-rating guidance — the primary source for the band definitions. */
const rhs = (url: string, note?: string): SourceRef => cite('RHS', url, note);
/** gardenis.co.uk's county-level average-last-frost-date roundup. */
const gardenis = (note?: string): SourceRef =>
  cite(
    'gardenis.co.uk',
    'https://www.gardenis.co.uk/blogs/news/average-last-frost-date-for-your-county',
    note,
  );
/** gardencalc.uk's frost-date calculator, built on Met Office 1991–2020 climate averages. */
const gardencalc = (note?: string): SourceRef =>
  cite(
    'gardencalc.uk (Met Office 1991-2020 averages)',
    'https://www.gardencalc.uk/frost-date-calculator',
    note,
  );
/** Airtasker UK's frost-date guide — used for the general "further north, earlier frost" pattern. */
const airtasker = (note?: string): SourceRef =>
  cite('Airtasker UK', 'https://www.airtasker.com/uk/guides/first-last-frost-dates/', note);
/** Weatherspark's Scottish Highlands climate averages page. */
const weatherspark = (note?: string): SourceRef =>
  cite(
    'Weatherspark',
    'https://weatherspark.com/y/150484/Average-Weather-in-Scottish-Highlands-United-Kingdom-Year-Round',
    note,
  );

// ---------------------------------------------------------------------------
// RHS hardiness citations, shared across regions (the band definitions
// themselves are region-independent facts).
// ---------------------------------------------------------------------------

const RHS_HARDINESS_DEFINITIONS = rhs(
  'https://www.rhs.org.uk/advice/rhs-hardiness-rating',
  'H4 = "hardy - average winter" (-10 to -5°C, central/eastern England and parts of Wales); ' +
    'H5 = "hardy - cold winter" (-15 to -10°C, northern/western England, parts of Wales, higher elevations)',
);
const RHS_HARDINESS_TABLE = rhs(
  'https://www.rhs.org.uk/plants/pdfs/rhs-hardiness-rating.pdf',
  'the full H1a-H7 table of absolute-minimum-winter-temperature bands used for each minTempC figure below',
);
const RHS_REGIONAL_BANDS = rhs(
  'https://www.rhs.org.uk/advice/rhs-hardiness-rating',
  'regional mapping: Cornwall/Channel Islands behave like H3 (mild-winter only); most of England/Wales sit in ' +
    'the H4-H5 range; the Scottish Highlands behave like H6 or H7',
);

// ---------------------------------------------------------------------------
// UK default — the national baseline. Must resolve with no location at all.
// ---------------------------------------------------------------------------

/**
 * The national default profile: a representative "typical English lowland"
 * baseline (RHS H4 — "hardy in an average winter", the band RHS's own guidance
 * assigns to most of central/eastern England and parts of Wales). This is what
 * `resolveClimate()` returns when no location is given, so **this profile must
 * not depend on anything network-derived** — every figure here is a literal in
 * this file.
 */
export const UK_DEFAULT_CLIMATE_PROFILE: ClimateProfile = {
  id: 'uk-default',
  name: 'United Kingdom (national default)',
  hardiness: {
    rhsRating: 'H4',
    // H4's band floor (-10 to -5°C): the coldest snap a typical average winter
    // in this band reaches, per the RHS numeric table cited below.
    minTempC: -10,
  },
  frost: {
    // "Southern England generally has a last frost date around mid-April"
    // (airtasker.com); 20 April is used as the representative mid/late-April
    // date for the national baseline band.
    lastSpringFrost: { month: 4, day: 20 },
    // "The average first frost for many inland areas in the UK ... is within
    // the first ten days of November" (airtasker.com); gardencalc.uk's
    // Met-Office-averages-based calculator agrees with early November for
    // inland England.
    firstAutumnFrost: { month: 11, day: 5 },
  },
  growingSeason: deriveGrowingSeason({
    lastSpringFrost: { month: 4, day: 20 },
    firstAutumnFrost: { month: 11, day: 5 },
  }),
  provenance: {
    hardiness: [RHS_HARDINESS_DEFINITIONS, RHS_HARDINESS_TABLE],
    frost: [
      gardencalc('national baseline built on Met Office 1991-2020 climate averages'),
      airtasker(
        '"southern England ... last frost date around mid-April"; first frost "first ten days of November"',
      ),
    ],
  },
};

// ---------------------------------------------------------------------------
// A small, extensible set of regions beyond the default.
// ---------------------------------------------------------------------------

/**
 * South West England (Cornwall/Devon), the mildest part of mainland Britain —
 * RHS H3 ("half hardy - unheated greenhouse/mild winter"), per RHS's own
 * regional mapping. Warmed by the Gulf Stream.
 */
const SOUTH_WEST_ENGLAND: ClimateProfile = {
  id: 'south-west-england',
  name: 'South West England (Cornwall / Devon)',
  hardiness: {
    rhsRating: 'H3',
    minTempC: -5, // H3's band floor (-5 to 1°C).
  },
  frost: {
    // Sources disagree on the exact date: gardenis.co.uk gives Cornwall's
    // average last frost as 24 April, but describes the wider far-south-west
    // pattern as "typically early April". Early April is chosen here as more
    // representative of the H3/mildest-in-mainland-Britain classification;
    // the later, single-source figure is recorded in the citation note rather
    // than silently dropped.
    lastSpringFrost: { month: 4, day: 5 },
    // gardenis.co.uk notes Cornwall/inner-London-like microclimates can go
    // without a damaging frost until well into winter; late November is used
    // here as a defensible, moderate figure rather than that source's more
    // extreme "into January" framing, which reads as an outlier claim rather
    // than a regional average.
    firstAutumnFrost: { month: 11, day: 25 },
  },
  growingSeason: deriveGrowingSeason({
    lastSpringFrost: { month: 4, day: 5 },
    firstAutumnFrost: { month: 11, day: 25 },
  }),
  provenance: {
    hardiness: [RHS_REGIONAL_BANDS, RHS_HARDINESS_TABLE],
    frost: [
      gardenis(
        'Cornwall average last frost "24th April"; ~196-day frost-free season; described as typically early April ' +
          'for the wider far-south-west — early April chosen as the representative figure, 24 April noted as the ' +
          "source's single-point figure",
      ),
    ],
  },
};

/**
 * Northern England (Yorkshire/Pennines/Northumberland), representing RHS's
 * H5 band ("hardy - cold winter"): northern and western England, per RHS's
 * own regional mapping.
 */
const NORTHERN_ENGLAND: ClimateProfile = {
  id: 'northern-england',
  name: 'Northern England (Yorkshire / Pennines)',
  hardiness: {
    rhsRating: 'H5',
    minTempC: -15, // H5's band floor (-15 to -10°C).
  },
  frost: {
    // Northumberland's average last frost, cited directly.
    lastSpringFrost: { month: 5, day: 25 },
    // No single clean regional figure was found for the first autumn frost
    // (one source's "late November" reads implausibly late for a region
    // colder than the national default — likely conflating it with the
    // Midlands). 25 October is a reconciled estimate: later than Scotland's
    // Highlands (cited below) and earlier than the national default, in line
    // with the well-established "further north, shorter season" pattern
    // (airtasker.com) rather than the single inconsistent figure.
    firstAutumnFrost: { month: 10, day: 25 },
  },
  growingSeason: deriveGrowingSeason({
    lastSpringFrost: { month: 5, day: 25 },
    firstAutumnFrost: { month: 10, day: 25 },
  }),
  provenance: {
    hardiness: [RHS_HARDINESS_DEFINITIONS, RHS_HARDINESS_TABLE],
    frost: [
      gardenis('Northumberland average last frost "25th May"'),
      airtasker(
        'general "further north = earlier first frost" pattern; first-autumn-frost date reconciled between this ' +
          "pattern and the source's own inconsistent regional figure (see code comment)",
      ),
    ],
  },
};

/**
 * The Scottish Highlands — RHS's harshest mainland band, "H6 or H7" per RHS's
 * regional mapping. H6 is used as the representative rating (H7 is reserved
 * for the very highest/most exposed sites, a further extension of this table
 * rather than the regional default).
 */
const SCOTLAND_HIGHLANDS: ClimateProfile = {
  id: 'scotland-highlands',
  name: 'Scotland — Highlands',
  hardiness: {
    rhsRating: 'H6',
    minTempC: -20, // H6's band floor (-20 to -15°C).
  },
  frost: {
    // "mid to late May" last frost for Scotland generally, per Weatherspark's
    // Highlands averages; 20 May is the representative date.
    lastSpringFrost: { month: 5, day: 20 },
    // "First autumn frost typically arrives in late October in the Scottish
    // Highlands" (Weatherspark).
    firstAutumnFrost: { month: 10, day: 20 },
  },
  growingSeason: deriveGrowingSeason({
    lastSpringFrost: { month: 5, day: 20 },
    firstAutumnFrost: { month: 10, day: 20 },
  }),
  provenance: {
    hardiness: [RHS_REGIONAL_BANDS, RHS_HARDINESS_TABLE],
    frost: [
      weatherspark(
        '"mid to late May" last frost, "late October" first autumn frost; ~140-day frost-free season ' +
          '(a second source put it under 120 days for the most exposed sites)',
      ),
    ],
  },
};

/**
 * Every non-default region, small on purpose (the Stage 1.6 brief calls for
 * "a small, extensible set" — see `docs/adr/0007`'s identical framing for the
 * spacing table). Designed to be extended one well-cited region at a time.
 */
export const CLIMATE_REGIONS: readonly ClimateProfile[] = [
  SOUTH_WEST_ENGLAND,
  NORTHERN_ENGLAND,
  SCOTLAND_HIGHLANDS,
];

/** Every climate profile this module ships, default included. */
export const ALL_CLIMATE_PROFILES: readonly ClimateProfile[] = [
  UK_DEFAULT_CLIMATE_PROFILE,
  ...CLIMATE_REGIONS,
];
