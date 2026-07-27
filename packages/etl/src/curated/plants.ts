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
 * ── Why these crops ──
 *
 * Stages 1.7 and 6.0 added them for different reasons, and the split is worth
 * keeping straight.
 *
 * **Stage 1.7 (`broad-bean`, `jerusalem-artichoke`)** proved the channel works
 * — see the note below. **Stage 6.0 (`apple`, `pear`, `raspberry`,
 * `brussels-sprouts`, `swede`, `pumpkin`)** uses it for the job it was built
 * for: six British staples the OpenFarm-derived catalogue simply never had, and
 * whose absence a British allotmenteer notices within five minutes. They ship
 * alongside the removal of 24 crops that cannot be grown outdoors here
 * (`../exclusions/`, ADR 0025) — the two halves of one judgement about what
 * belongs in a British planner's crop list.
 *
 * The Stage 6.0 six are also the first records here to carry a **full** set of
 * requirement fields (light, hardiness, soil, seasons, spacing). That is not
 * decoration: hardiness and seasons are the two dimensions the suitability
 * engine reports `unknown-plant` for across almost the whole catalogue, so
 * every record that states them is a record the engine can score on all four
 * dimensions instead of one. Six is not many; it is eight in total, up from
 * two, and it moves in the right direction.
 *
 * A caveat carried by all six, stated once here rather than six times below:
 * **these are species-level records for crops sold as dozens of cultivars.**
 * An apple's spacing depends on its rootstock, a raspberry's harvest month on
 * whether it is summer- or autumn-fruiting, a Brussels sprout's picking window
 * on the cultivar. Each record takes the figure a British gardener would get
 * from the ordinary RHS advice for the commonest garden form, and each entry's
 * provenance notes say which form that is. Anyone wanting cultivar precision
 * should add their own crop through Stage 3.6's form.
 *
 * ── How the citations were obtained (retrieval honesty, ADR 0007/0009) ──
 * This build environment cannot reach `rhs.org.uk` or `almanac.com` — both
 * answer it with HTTP 403 — so no cited page was fetched directly. Every RHS
 * figure below came from **web-search snippets of that exact page**, which is
 * why each source note quotes what the page states rather than paraphrasing
 * it: the quote is the checkable artifact. `NOTICE` records this for the
 * dataset as a whole, and the Stage 1.3 spacing table was sourced the same way.
 * A reviewer with unrestricted network access can verify any of it from the
 * URLs given.
 *
 * ── The original two ──
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
 * Every record here is **link-free** by design (no `companions`/`antagonists`
 * of its own) — see the ADR for why that's this channel's referential-integrity
 * policy. None sets `icon` either: `resolveIcon` falls back to the crop's `id`,
 * and Stage 4.1's generator writes one icon per shipped id, so a curated crop
 * gets a real icon by having its id classified in `tools/icons/
 * classification.ts` — not by naming one here.
 */

import type { Plant } from '@garden-planner/engine';

/** The date the Stage 1.7 records' facts were retrieved/verified (ISO-8601). */
const RETRIEVED_AT = '2026-07-26';

/** The date the Stage 6.0 records' facts were retrieved/verified (ISO-8601). */
const RETRIEVED_AT_6_0 = '2026-07-27';

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

  // ─────────────────────────────────────────────────────────────────────────
  // Stage 6.0 — the missing British staples.
  //
  // On the RHS hardiness bands used below: each band is a temperature range
  // (H4 = -10 to -5°C, H5 = -15 to -10°C, H6 = -20 to -15°C, H2 = 1 to 5°C),
  // and `minTempC` takes the **cold edge** of the band — the band's own claim
  // about what the plant survives. That matches the `broad-bean` record above
  // (H4, -10) so the two generations of curation read the same way.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'apple',
    commonName: 'Apple',
    scientificName: 'Malus domestica',
    gbifId: null,
    category: 'fruit',
    edibleParts: ['fruit'],
    light: 'full-sun',
    spacing: {
      // Rootstock decides an apple's size, so it decides its spacing — there is
      // no single honest figure. This is a bush tree on MM106 (semi-dwarfing),
      // the commonest garden rootstock: 3.6m between trees, 4.5m between rows.
      // A dwarfing M26 would sit at the 2.4m end of the same row width.
      row: { inRowCm: 360, betweenRowCm: 450 },
    },
    hardiness: { rhsRating: 'H6', minTempC: -20 },
    // No `textures`: RHS states what apples want in terms of depth and
    // fertility ("deep, fertile, moist but well-drained") and what they will
    // not take (very acid, shallow chalk), which is a pH and moisture claim,
    // not a texture one. Recording a texture list would be inventing detail.
    soil: { ph: ['neutral'], moisture: ['moist'] },
    seasons: {
      // `sow` is the planting window for a tree: bare-root stock is lifted and
      // planted while dormant. Harvest spans August (early cultivars like
      // 'Discovery') to November (late keepers like 'Sturmer Pippin').
      sow: [{ start: 11, end: 3 }],
      harvest: [{ start: 8, end: 11 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/fruit/fruit-trees/rootstocks',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Bush apples on MM106 are spaced 3.6m (12ft) apart with 4.5m (15ft) ' +
            'between rows; on the dwarfing M26, 2.4-3.6m (8-12ft) apart with the ' +
            'same 4.5m row width.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/fruit/apples/grow-your-own',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Buy bare-root trees between November and March, while dormant, for ' +
            'best establishment. Cultivar choice spreads picking from late July ' +
            "('Discovery') to November ('Sturmer Pippin').",
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/60558/malus-domestica-f/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Hardiness H6. Apples prefer deep, fertile, moist but well-drained, ' +
            'neutral soil in a sunny, sheltered position, and will not thrive on ' +
            'very acid soils, shallow chalk soils, or with shade for more than ' +
            'half the day.',
        },
      ],
    },
  },
  {
    id: 'pear',
    commonName: 'Pear',
    scientificName: 'Pyrus communis',
    gbifId: null,
    category: 'fruit',
    edibleParts: ['fruit'],
    light: 'full-sun',
    spacing: {
      // RHS quotes pear spacing tree-to-tree only (3.5-5.5m on 'Quince A', the
      // usual garden rootstock), with no separate row figure the way it gives
      // for apples. Rather than borrow apple's 4.5m row width, this takes the
      // low end of the stated range and applies it in both directions — a
      // square planting at the distance RHS actually states.
      row: { inRowCm: 350, betweenRowCm: 350 },
    },
    hardiness: { rhsRating: 'H6', minTempC: -20 },
    soil: { textures: ['clay', 'loam', 'sand'], ph: ['neutral'], moisture: ['moist'] },
    seasons: {
      // As apple: `sow` is the bare-root planting window. 'Conference', the
      // commonest British garden pear, is picked from late September.
      sow: [{ start: 11, end: 3 }],
      harvest: [{ start: 9, end: 10 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/fruit/pears/grow-your-own',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            "Space trees 3.5-5.5m (11-18ft) apart on 'Quince A' rootstock, or " +
            "2.5-3.5m (8-11ft) on 'Quince C'/'Quince Eline'.",
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/74814/pyrus-communis-conference-d/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            "Pear 'Conference': hardiness H6; soil types clay, loam and sand; pH " +
            'neutral; moist but well-drained or well-drained; full sun, sheltered.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/14227/pyrus-communis-f/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Pears need a deep, fertile, moist but well-drained, fairly neutral ' +
            'soil in a sheltered, sunny position; they will not thrive on very ' +
            'acid or shallow chalk soils, or with shade for more than half the day.',
        },
      ],
    },
  },
  {
    id: 'raspberry',
    commonName: 'Raspberry',
    scientificName: 'Rubus idaeus',
    gbifId: null,
    category: 'fruit',
    edibleParts: ['fruit'],
    light: 'full-sun',
    spacing: {
      row: { inRowCm: 45, betweenRowCm: 180 },
    },
    hardiness: { rhsRating: 'H6', minTempC: -20 },
    // The one crop of the six with a real pH preference rather than a
    // tolerance: RHS lists acid, and recommends mulching with acidic material
    // such as composted bark. Recorded as stated, so a chalky plot is told the
    // truth instead of being scored neutral-by-default.
    soil: { textures: ['loam', 'sand'], ph: ['acid'], moisture: ['moist'] },
    seasons: {
      // Two harvest windows because there are two kinds of raspberry, and which
      // one you plant is the single biggest decision about the crop:
      // summer-fruiting canes crop June-July on last year's growth,
      // autumn-fruiting ones August-October on this year's.
      sow: [{ start: 11, end: 3 }],
      harvest: [
        { start: 6, end: 7 },
        { start: 8, end: 10 },
      ],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/fruit/raspberries/grow-your-own',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Space canes 45cm apart with 1.8m between rows; plant in autumn or ' +
            "spring. Summer-fruiting types fruit on the previous year's growth, " +
            "autumn-fruiting types on the current season's.",
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/76281/rubus-idaeus-autumn-bliss-f/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            "Raspberry 'Autumn Bliss': hardiness H6; soil types loam and sand; " +
            'pH acid; moist but well-drained or well-drained; full sun; sheltered. ' +
            'Height 1.5-2.5m, spread 0.1-0.5m.',
        },
      ],
    },
  },
  {
    id: 'brussels-sprouts',
    commonName: 'Brussels sprouts',
    scientificName: 'Brassica oleracea (Gemmifera Group)',
    gbifId: null,
    category: 'vegetable',
    // Sprouts are axillary *buds* — leafy growing points, not flower heads
    // (that is cauliflower and broccoli) — so `leaf` is the closest of the
    // schema's edible parts. Recorded here rather than left off because the
    // distinction is the crop.
    edibleParts: ['leaf'],
    light: 'full-sun',
    spacing: {
      // The one figure on this crop gardeners routinely get wrong, and RHS is
      // emphatic about why: 60cm each way is what gives the plants the light
      // and air they need to crop and deters fungal disease. Do not crowd them.
      row: { inRowCm: 60, betweenRowCm: 60 },
    },
    hardiness: { rhsRating: 'H5', minTempC: -15 },
    soil: {
      textures: ['chalk', 'clay', 'loam', 'sand'],
      ph: ['neutral', 'alkaline'],
      moisture: ['moist'],
    },
    seasons: {
      // Sown in spring, planted out early summer, picked through the winter —
      // the long occupancy is the planning fact that matters on a small plot.
      // Harvest wraps the new year (October to February).
      sow: [{ start: 3, end: 4 }],
      harvest: [{ start: 10, end: 2 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/vegetables/brussels-sprouts/grow-your-own',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Space plants 60cm (2ft) apart with at least 60cm (2ft) between rows ' +
            '— the wide spacing gives plants light and air, helps them crop, and ' +
            'deters fungal disease, so "don\'t be tempted to plant more closely". ' +
            'Sprouts ripen from the base of the stalk upwards and are picked as ready.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/246762/brassica-oleracea-(gemmifera-group)-trafalgar/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            "Brussels sprout 'Trafalgar': hardiness H5; soil types chalk, clay, " +
            'loam and sand; pH alkaline and neutral; moist but well-drained; full ' +
            'sun, sheltered. Ready to pick November to January.',
        },
      ],
    },
  },
  {
    id: 'swede',
    commonName: 'Swede',
    scientificName: 'Brassica napus (Napobrassica Group)',
    gbifId: null,
    category: 'vegetable',
    // Botanically a swollen stem-and-root; `root` is how it is grown, lifted
    // and eaten, and matches how the dataset treats turnip and beetroot.
    edibleParts: ['root'],
    light: 'full-sun',
    spacing: {
      // Two RHS figures disagree slightly: the grow-your-own guide thins to
      // 20-25cm in rows 38cm apart, while the cultivar pages say 15cm in rows
      // 30cm apart. The guide's wider figures are used — swedes take up to six
      // months to size up, and the tighter spacing is the one that produces
      // small roots.
      row: { inRowCm: 25, betweenRowCm: 38 },
    },
    hardiness: { rhsRating: 'H4', minTempC: -10 },
    // "Non acid soil" is the emphatic bit — club root is the swede grower's
    // problem and liming against it is standard practice, so acid is left off
    // the tolerated list rather than treated as merely sub-optimal.
    soil: { ph: ['neutral', 'alkaline'], moisture: ['moist'] },
    seasons: {
      sow: [{ start: 4, end: 6 }],
      // Lifted from early autumn, or left in the ground through the winter —
      // hence a harvest window that wraps into January.
      harvest: [{ start: 9, end: 1 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/vegetables/swede/grow-your-own',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Sow direct from late spring to early summer in rows 38cm (15in) ' +
            'apart, thinning seedlings to 20-25cm (8-10in). Best in an open, ' +
            'sunny site with moist but free-draining, fertile soil; lime acid ' +
            'soil. Harvested in autumn and winter — dug from early autumn, or ' +
            'left in the ground until Christmas and beyond.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/149640/brassica-napus-(napobrassica-group)-brora-pbr/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            "Swede 'Brora': hardiness H4. Grow in well-firmed, non-acid soil in " +
            'full sun; sow outdoors April to June, 1cm deep, 30cm between rows, ' +
            'thinning to 15cm apart.',
        },
      ],
    },
  },
  {
    id: 'pumpkin',
    commonName: 'Pumpkin',
    scientificName: 'Cucurbita maxima',
    gbifId: null,
    category: 'vegetable',
    edibleParts: ['fruit'],
    light: 'full-sun',
    spacing: {
      // Pumpkins are trailing, so this takes RHS's trailing figure (1.5m) in
      // both directions rather than the 90cm quoted for bush squashes. The
      // dataset's existing squash records sit at 1.5-2.1m in-row for the same
      // reason. This is the crop most likely to be under-spaced on a small
      // plot, which is exactly what the density calculator should be saying.
      row: { inRowCm: 150, betweenRowCm: 150 },
    },
    // The only tender crop of the six: H2 means it tolerates low temperatures
    // but not being frozen, which is why it is sown under cover and planted out
    // after the last frost.
    hardiness: { rhsRating: 'H2', minTempC: 1 },
    // No texture list: RHS describes what pumpkins want as "rich, fertile,
    // moist but well drained" — a fertility and moisture claim, not a texture.
    soil: { moisture: ['moist'] },
    seasons: {
      sow: [{ start: 4, end: 6 }],
      harvest: [{ start: 9, end: 10 }],
    },
    provenance: {
      sources: [
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/vegetables/pumpkins/grow-your-own',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            'Space bush varieties 90cm (3ft) apart and trailing varieties 1.5m ' +
            '(5ft) apart. Start under cover at 18-21°C from mid-April and plant ' +
            'out in June after hardening off, or sow outdoors late May/early ' +
            'June. Harvest when the stem cracks and the skin hardens, picking ' +
            'before the first frosts in October or November.',
        },
        {
          source: 'RHS',
          url: 'https://www.rhs.org.uk/plants/237223/cucurbita-maxima-crown-prince/details',
          retrievedAt: RETRIEVED_AT_6_0,
          note:
            "Squash 'Crown Prince' (Cucurbita maxima): hardiness H2 — tolerant of " +
            'low temperatures, but not surviving being frozen (1 to 5°C). Grow in ' +
            'rich, fertile, moist but well-drained soil in full sun.',
        },
      ],
    },
  },
];
