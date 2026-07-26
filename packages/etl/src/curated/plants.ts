/**
 * Maintainer-curated, full-bar plant records (Workplan Stage 1.7 — see
 * `docs/adr/0021-curated-plant-input.md`).
 *
 * This is a channel for the **maintainer** to add a crop to the shipped
 * dataset by hand, permanently — distinct from Stage 3.6's user-defined crops
 * (`docs/adr/0011-user-defined-crop-schema.md`), which live only for a
 * browser session and were deliberately relaxed-schema. Every record here is
 * a first-class `Plant`, held to the *same* unrelaxed `validatePlant` bar as
 * every OpenFarm-sourced record: real provenance, full identity, no
 * shortcut — proven by `plants.test.ts`.
 *
 * Kept a plain array validated by a test, matching `spacing/table.ts`'s
 * convention (Stage 1.3), rather than wrapping every entry in `validatePlant`
 * here — the point of this stage is the *same* discipline one level up (full
 * records, not a thin slice), not a new one.
 *
 * ── Why these two crops ──
 * `broad-bean` closes a documented gap: `docs/adr/0009`'s Consequences record
 * that OpenFarm has no mappable *Vicia faba*, so the Stage 1.3 hand-verified
 * spacing row and the `leek`↔`broad-bean` antagonist link (Stage 1.4) have
 * never had a plant to attach to. Adding it here — with no OpenFarm plant to
 * collide with — lets both attach through the ordinary Stage 1.5 join
 * machinery for the first time, no special-casing needed.
 * `jerusalem-artichoke` is a plain new addition (no spacing/companion data
 * references it), proving the "just add a crop OpenFarm's dump never had"
 * path on its own.
 *
 * Both are **link-free** by design (no `companions`/`antagonists` of their
 * own) — see the ADR for why that's this stage's referential-integrity
 * policy. Neither has a bespoke icon (`icon` omitted); the UI's existing
 * generic-icon fallback (Stage 4.1/4.2) already covers that.
 *
 * Start small on purpose (`WORKPLAN.md` Stage 1.7): this proves the curated
 * input end to end. Growing the list further is mechanical, settled-pattern
 * work for a later session (see `docs/stage-1.7-brief.md`).
 */

import type { Plant } from '@garden-planner/engine';

/** The date these two records' facts were retrieved/verified (ISO-8601). */
const RETRIEVED_AT = '2026-07-26';

export const CURATED_PLANTS: readonly Plant[] = [
  {
    id: 'broad-bean',
    commonName: 'Broad bean',
    scientificName: 'Vicia faba',
    gbifId: null,
    category: 'vegetable',
    edibleParts: ['seed'],
    light: 'full-sun',
    spacing: {
      // Matches the Stage 1.3 hand-verified row (`spacing/table.ts`), which
      // wins over this figure at merge time regardless — recorded honestly
      // here anyway, since a curated record is a full `Plant` in its own right.
      row: { inRowCm: 20, betweenRowCm: 60 },
    },
    hardiness: { rhsRating: 'H4', minTempC: -10 },
    soil: { textures: ['loam'], ph: ['neutral'], moisture: ['moist'] },
    seasons: {
      sow: [
        { start: 11, end: 11 },
        { start: 2, end: 5 },
      ],
      harvest: [{ start: 6, end: 8 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/vegetables/broad-beans/grow-your-own',
          retrievedAt: RETRIEVED_AT,
          note:
            'Sunny, sheltered site; fertile, moist but well-drained soil; ' +
            '15-23cm apart in double rows 23cm apart, 60cm between double rows.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/advice/grow-your-own/features/sowing-broad-beans',
          retrievedAt: RETRIEVED_AT,
          note:
            'Hardy varieties can be autumn/November-sown (surviving down to ' +
            '-10°C); spring sowing March-May is the main, less weather-dependent window.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/105463/vicia-faba/details',
          retrievedAt: RETRIEVED_AT,
          note:
            'H4 hardiness ("hardy in most of the UK, -10 to -5°C") is the rating ' +
            "shared across RHS's individual Vicia faba cultivar pages (e.g. " +
            "'Express', 'Vroma', 'Meteor').",
        },
      ],
    },
  },
  {
    id: 'jerusalem-artichoke',
    commonName: 'Jerusalem artichoke',
    scientificName: 'Helianthus tuberosus',
    gbifId: null,
    category: 'vegetable',
    edibleParts: ['tuber'],
    light: 'full-sun',
    spacing: {
      row: { inRowCm: 30, betweenRowCm: 90 },
    },
    hardiness: { minTempC: -30 },
    soil: {
      textures: ['sand', 'loam', 'clay'],
      ph: ['neutral', 'alkaline'],
      moisture: ['moist'],
    },
    seasons: {
      sow: [{ start: 3, end: 4 }],
      // Wrap-around: harvest runs October through January, spanning the new
      // year — `MonthRangeSchema` explicitly allows `end < start` for this.
      harvest: [{ start: 10, end: 1 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/vegetables/jerusalem-artichokes/grow-your-own',
          retrievedAt: RETRIEVED_AT,
          note:
            'Full sun; moderately fertile, moist but well-drained soil; tubers ' +
            '30cm apart, rows at least 1m apart.',
        },
        {
          source: "Old Farmer's Almanac",
          url: 'https://www.almanac.com/plant/jerusalem-artichokes-how-grow-and-harvest-hardy-perennial',
          retrievedAt: RETRIEVED_AT,
          note:
            "12-18in apart, rows 36in apart — wider in-row spacing than RHS's " +
            "figure; RHS's tighter in-row figure is used here, paired with its own row gap.",
        },
        {
          source: 'North Carolina Extension Gardener Plant Toolbox',
          url: 'https://plants.ces.ncsu.edu/plants/helianthus-tuberosus/',
          retrievedAt: RETRIEVED_AT,
          note:
            'Suitable for sandy, loamy and clay soils; prefers well-drained, ' +
            'slightly alkaline soil (pH 7-7.5); hardy USDA zones 2b-8b.',
        },
        {
          source: 'Deep Green Permaculture',
          url: 'https://deepgreenpermaculture.com/2025/12/06/jerusalem-artichokes-growing-guide/',
          retrievedAt: RETRIEVED_AT,
          note:
            'Tubers survive in-ground winter soil temperatures down to about ' +
            '-30°C under a mulch layer; top growth is frost-tender well above that.',
        },
      ],
    },
  },
];
