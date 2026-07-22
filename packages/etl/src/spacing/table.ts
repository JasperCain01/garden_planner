/**
 * The hand-verified, method-aware spacing table for a starter set of common
 * British edibles (Workplan Stage 1.3 ⭐; design in
 * `docs/adr/0007-hand-verified-spacing.md`).
 *
 * Why a `.ts` file, not `data/*.json`: every figure below carries a *reason*
 * (why this value, from what range, with which caveat), and JSON can't hold the
 * inline comments that make this table reviewable and teachable — which is the
 * whole point of WORKPLAN.md §0.2. The data is still schema-validated (identical
 * discipline to a JSON artifact) by `table.test.ts` via
 * {@link validateSpacingTable}; it just also gets to explain itself. See the ADR.
 *
 * ── How these figures were sourced (read this before trusting a number) ──
 * Each figure is cross-checked against **≥2 independent authoritative sources**
 * (WORKPLAN.md §1.1). For row (in-row × between-row) figures that is the **RHS**
 * grow guide plus a second extension-grade guide (the **Old Farmer's Almanac**
 * plant pages). For intensive figures it is **≥2 square-foot-gardening charts**
 * (the Square Foot Gardening Foundation's own site plus a reproduced chart) —
 * never derived from a row figure (see the ADR's anti-inference rule).
 *
 * **Honesty note on retrieval.** In the environment this table was authored in
 * (2026-07-22), direct page fetches to `rhs.org.uk`, `almanac.com` and
 * `squarefootgardening.org` were blocked by the sandbox's egress policy (HTTP
 * 403 at the proxy) — the same class of blocker Stages 1.1/1.2 documented for
 * GBIF/PFAF. The figures here were retrieved instead via **web search result
 * snippets** of those exact pages (a genuine retrieval of the sources' own
 * words, not a guess), and every URL below is the real page the figure came
 * from. Where sources genuinely disagree (e.g. onion 9-vs-16 per square), the
 * `note` records the disagreement and which value was chosen and why, rather
 * than papering over it. This is verification a reviewer can redo from a session
 * with unrestricted network access — see the ADR's Consequences.
 */

import type { SourceRef } from '@garden-planner/engine';
import { type SpacingRecord } from './schema.ts';

/** The date every figure below was retrieved/verified (ISO-8601). */
const RETRIEVED_AT = '2026-07-22';

/**
 * Build a {@link SourceRef} for a named source. Keeps the ~50 citations below
 * uniform (same `retrievedAt`, no typo'd source names) and readable. The
 * per-figure caveat, when there is one, goes in `note`.
 */
function cite(source: string, url: string, note?: string): SourceRef {
  return note === undefined
    ? { source, url, retrievedAt: RETRIEVED_AT }
    : { source, url, retrievedAt: RETRIEVED_AT, note };
}

/** RHS grow-guide page — the primary UK-authoritative source for row spacing. */
const rhs = (url: string, note?: string): SourceRef => cite('RHS', url, note);
/** Old Farmer's Almanac plant page — the extension-grade second row source. */
const almanac = (url: string, note?: string): SourceRef => cite("Old Farmer's Almanac", url, note);
/** Square Foot Gardening Foundation — the primary intensive/per-square source. */
const sfgFoundation = (url: string, note?: string): SourceRef =>
  cite('Square Foot Gardening Foundation', url, note);
/** A reproduced square-foot-gardening plant-spacing chart — the second SFG source. */
const sfgChart = (source: string, url: string, note?: string): SourceRef => cite(source, url, note);

/**
 * The starter crop set: 12 of the most commonly grown British allotment/garden
 * edibles, chosen to (a) include the Stage 1.1 demo five (onion, lettuce,
 * carrot, potato, tomato) and (b) overlap heavily with the crops OpenFarm's
 * adapter already maps, maximising future merge overlap (Stage 1.5) — see the
 * ADR for the full selection rationale. All are `vegetable`; herbs and fruit are
 * a deliberate later extension so this first table stays bounded and verifiable.
 *
 * Kept small and real-world-common on purpose (DESIGN.md's "the set is small and
 * bounded" framing): every figure here was hand-verified, which is a per-crop
 * cost, so breadth is traded for trustworthiness.
 */
export const HAND_VERIFIED_SPACING: readonly SpacingRecord[] = [
  {
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    category: 'vegetable',
    // Row: RHS gives 5–15 cm in-row (wider = bigger bulbs), rows 20–30 cm.
    // Almanac gives sets 3–4 in (~7.5–10 cm), rows 12–18 in (~30–45 cm).
    // 10 × 30 cm sits in both sources' overlap.
    spacing: {
      row: { inRowCm: 10, betweenRowCm: 30 },
      // Intensive: the classic square-foot figure for *bulbing* onions is 9 per
      // square (≈10 cm / 4 in). This is the split the sources make explicit.
      intensive: { plantsPerSquare: 9 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/onions/grow-your-own',
          'sets 5–15 cm apart, rows 20–30 cm',
        ),
        almanac('https://www.almanac.com/plant/onions', 'sets 3–4 in apart, rows 12–18 in'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          '9 per square for bulbing onions, 16 for bunching/green onions',
        ),
        sfgChart(
          'Square-foot gardening chart (Organic Backyard Gardening)',
          'https://organicbackyardgardening.com/square-foot-gardening-chart/',
          'onion listed at 9 per square',
        ),
      ],
    },
    note: 'Bulb onion. SFG sources split: 9/square for full-size bulbs (≈10 cm), 16/square for salad/bunching onions (≈7.5 cm); 9 recorded as the bulb figure, consistent with RHS "wider spacing = larger bulbs".',
  },
  {
    id: 'lettuce',
    commonName: 'Lettuce',
    scientificName: 'Lactuca sativa',
    category: 'vegetable',
    // Row: RHS rows 30 cm, thin 15–30 cm by type. Almanac butterhead 8 in
    // (~20 cm), rows 12–15 in (~30–38 cm). 20 × 30 cm = general/butterhead.
    spacing: {
      row: { inRowCm: 20, betweenRowCm: 30 },
      // Intensive: SFG "leaf lettuce" is a 6 in / 4-per-square crop.
      intensive: { plantsPerSquare: 4 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/lettuce/grow-your-own',
          'rows 30 cm apart, thin 15–30 cm by variety',
        ),
        almanac(
          'https://www.almanac.com/plant/lettuce',
          'loose-leaf 4 in / butterhead 8 in / crisphead 16 in; rows 12–15 in',
        ),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          'leaf lettuce in the 6 in / 4-per-square class',
        ),
        sfgChart(
          "Square-foot garden plan (Old Farmer's Almanac)",
          'https://www.almanac.com/square-foot-garden-plan',
          'lettuce at 4 per square',
        ),
      ],
    },
    note: 'Figures for general/butterhead lettuce. Hearting (crisphead) types want ~30 cm in-row; dense loose-leaf can go tighter than 4/square. 4/square recorded as the standard SFG leaf-lettuce figure.',
  },
  {
    id: 'carrot',
    commonName: 'Carrot',
    scientificName: 'Daucus carota',
    category: 'vegetable',
    // Row: RHS thin 5–7.5 cm, rows 15–30 cm. Almanac 2–3 in (~5–7.5 cm),
    // rows 12 in (30 cm). in-row 6 cm; between-row 20 cm (mid of RHS range).
    spacing: {
      row: { inRowCm: 6, betweenRowCm: 20 },
      // Intensive: carrots are a canonical 3 in / 16-per-square SFG crop.
      intensive: { plantsPerSquare: 16 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/carrots/grow-your-own',
          'thin to 5–7.5 cm, rows 15–30 cm',
        ),
        almanac('https://www.almanac.com/plant/carrots', '2–3 in apart, rows 12 in'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          'carrot in the 3 in / 16-per-square class',
        ),
        sfgChart(
          "Square-foot garden plan (Old Farmer's Almanac)",
          'https://www.almanac.com/square-foot-garden-plan',
          'carrots at 16 per square',
        ),
      ],
    },
    note: 'Between-row 20 cm is mid-range (RHS 15–30 cm, Almanac 30 cm).',
  },
  {
    id: 'potato',
    commonName: 'Potato',
    scientificName: 'Solanum tuberosum',
    category: 'vegetable',
    // Row only. RHS maincrop 37 cm apart, rows 75 cm; earlies 30/60 cm.
    // Almanac maincrop ~18 in (45 cm), rows to 30–36 in (75–90 cm). Maincrop
    // recorded. No intensive figure: potatoes are earthed-up in trenches/bags,
    // not a square-foot crop — inventing a per-square number would be exactly
    // the unstated inference this stage avoids (see the ADR).
    spacing: {
      row: { inRowCm: 37, betweenRowCm: 75 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/potatoes/grow-your-own',
          'maincrop 37 cm apart, rows 75 cm (earlies 30/60 cm)',
        ),
        almanac(
          'https://www.almanac.com/plant/potatoes',
          'maincrop ~18 in apart; traditional rows ~30–36 in',
        ),
      ],
    },
    note: 'Maincrop figures. Row-only by design: potatoes are grown with earthing-up (trenches/bags), so no honest square-foot density exists to record.',
  },
  {
    id: 'tomato',
    commonName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    category: 'vegetable',
    // Row: RHS cordon 45–60 cm apart, rows 60–90 cm. Almanac staked 18–24 in
    // (~45–60 cm), rows 24 in+ (60 cm+). 45 × 60 cm = cordon/indeterminate.
    spacing: {
      row: { inRowCm: 45, betweenRowCm: 60 },
      // Intensive: a vine/cordon tomato is the SFG 12 in / 1-per-square crop.
      intensive: { plantsPerSquare: 1 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/tomatoes/grow-your-own',
          'cordons 45–60 cm apart, rows 60–90 cm',
        ),
        almanac('https://www.almanac.com/plant/tomatoes', 'staked 18–24 in apart, rows 24 in+'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          'vine tomato in the 12 in / 1-per-square class',
        ),
        sfgChart(
          "Square-foot garden plan (Old Farmer's Almanac)",
          'https://www.almanac.com/square-foot-garden-plan',
          'vine tomatoes at 1 per square',
        ),
      ],
    },
    note: 'Cordon/indeterminate tomato grown up a single stem. Bush (determinate) types sprawl wider.',
  },
  {
    id: 'beetroot',
    commonName: 'Beetroot',
    scientificName: 'Beta vulgaris',
    category: 'vegetable',
    // Row: RHS 10 cm apart, rows 30 cm. Almanac thin 3–4 in (~7.5–10 cm),
    // rows 12–18 in (30–45 cm). 10 × 30 cm agreed by both.
    spacing: {
      row: { inRowCm: 10, betweenRowCm: 30 },
      // Intensive: beetroot is a 4 in / 9-per-square SFG crop.
      intensive: { plantsPerSquare: 9 },
    },
    provenance: {
      row: [
        rhs('https://www.rhs.org.uk/vegetables/beetroot/grow-your-own', '10 cm apart, rows 30 cm'),
        almanac('https://www.almanac.com/plant/beets', 'thin to 3–4 in, rows 12–18 in'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          'beet in the 4 in / 9-per-square class',
        ),
        sfgChart(
          "Square-foot garden plan (Old Farmer's Almanac)",
          'https://www.almanac.com/square-foot-garden-plan',
          'beets at 9 per square',
        ),
      ],
    },
    note: 'Each beet "seed" is a cluster; multi-sown clumps are thinned. Figures are for single roots.',
  },
  {
    id: 'radish',
    commonName: 'Radish',
    scientificName: 'Raphanus sativus',
    category: 'vegetable',
    // Row: RHS salad radish 2.5–5 cm apart, rows 15 cm. Almanac 1 in (2.5 cm),
    // rows 12 in (30 cm). in-row 3 cm; between-row 15 cm (RHS, salad radish).
    spacing: {
      row: { inRowCm: 3, betweenRowCm: 15 },
      // Intensive: salad radish is a canonical 3 in / 16-per-square SFG crop.
      intensive: { plantsPerSquare: 16 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/radishes/grow-your-own',
          'salad radish 2.5–5 cm apart, rows 15 cm',
        ),
        almanac('https://www.almanac.com/plant/radishes', '1 in apart, rows 12 in'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          'radish in the 3 in / 16-per-square class',
        ),
        sfgChart(
          'Square-foot gardening chart (Organic Backyard Gardening)',
          'https://organicbackyardgardening.com/square-foot-gardening-chart/',
          'radish at 16 per square',
        ),
      ],
    },
    note: 'Salad (spring) radish. Winter/mooli radishes are far larger (RHS spaces them ~15 cm) and are not covered by these figures.',
  },
  {
    id: 'garlic',
    commonName: 'Garlic',
    scientificName: 'Allium sativum',
    category: 'vegetable',
    // Row: RHS cloves 15 cm apart, rows 30 cm. Almanac 4–6 in (~10–15 cm),
    // rows 12–18 in (30–45 cm). 15 × 30 cm agreed.
    spacing: {
      row: { inRowCm: 15, betweenRowCm: 30 },
      // Intensive: SFG garlic is 9 per square at 3–4 in (larger heads: 4/square).
      intensive: { plantsPerSquare: 9 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/garlic/grow-your-own',
          'cloves 15 cm apart, rows 30 cm',
        ),
        almanac('https://www.almanac.com/plant/garlic', 'cloves 4–6 in apart, rows 12–18 in'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2020/11/square-foot-garlic/',
          '9 cloves per square at 3–4 in spacing (4/square if planted 6 in apart)',
        ),
        sfgChart(
          'Square-foot gardening chart (Organic Backyard Gardening)',
          'https://organicbackyardgardening.com/square-foot-gardening-chart/',
          'garlic in the 4 in / 9-per-square class',
        ),
      ],
    },
    note: 'Standard spacing (9/square). Large hardneck heads are sometimes given more room (4/square).',
  },
  {
    id: 'leek',
    commonName: 'Leek',
    scientificName: 'Allium ampeloprasum',
    category: 'vegetable',
    // Row only. RHS 15–20 cm apart (10 cm for baby leeks), rows 30 cm. Almanac
    // 4–6 in (~10–15 cm), rows 12–16 in (30–40 cm). 15 × 30 cm recorded.
    // No intensive figure: SFG sources genuinely split leeks between 4/square
    // and 9/square, so rather than pick a contested number this leaves the
    // intensive block absent (the schema allows row-only) — honest omission
    // over a forced figure, exactly the discipline the brief asks for.
    spacing: {
      row: { inRowCm: 15, betweenRowCm: 30 },
    },
    provenance: {
      row: [
        rhs('https://www.rhs.org.uk/vegetables/leeks/grow-your-own', '15–20 cm apart, rows 30 cm'),
        almanac('https://www.almanac.com/plant/leeks', '4–6 in apart, rows 12–16 in'),
      ],
    },
    note: 'Row-only: SFG references disagree on leek density (4 vs 9 per square), so no intensive figure is recorded rather than committing to a contested value.',
  },
  {
    id: 'pea',
    commonName: 'Pea',
    scientificName: 'Pisum sativum',
    category: 'vegetable',
    // Row: RHS seeds ~7.5 cm apart, rows spaced ≈ variety height (dwarf
    // ~45–60 cm). Almanac 2 in (~5 cm), rows 18–24 in (~45–60 cm). in-row 7 cm;
    // between-row 60 cm.
    spacing: {
      row: { inRowCm: 7, betweenRowCm: 60 },
      // Intensive: the SFG figure for peas is 8 per square.
      intensive: { plantsPerSquare: 8 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/peas/grow-your-own',
          "seeds ~7.5 cm apart; rows spaced ≈ the variety's height",
        ),
        almanac('https://www.almanac.com/plant/peas', '~2 in apart; rows 18–24 in for dwarf types'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2023/08/square-foot-spacing-for-growing-peas/',
          '8 seeds per square',
        ),
        sfgChart(
          "Square-foot garden plan (Old Farmer's Almanac)",
          'https://www.almanac.com/square-foot-garden-plan',
          'peas at 8 per grid section',
        ),
      ],
    },
    note: 'Often grown in double rows with a support in between; between-row spacing scales with variety height (dwarf ~45–60 cm, tall climbers more). 60 cm recorded for a typical dwarf/support row.',
  },
  {
    id: 'broad-bean',
    commonName: 'Broad bean',
    scientificName: 'Vicia faba',
    category: 'vegetable',
    // Row only. RHS 15–23 cm apart, double rows 23 cm apart with 60 cm between
    // double rows. Almanac/extension ~8 in (20 cm) apart, double rows, 60–75 cm
    // between. in-row 20 cm; between-row 60 cm (double-row gap). No standard SFG
    // density for broad beans, so intensive is omitted rather than invented.
    spacing: {
      row: { inRowCm: 20, betweenRowCm: 60 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/broad-beans/grow-your-own',
          '15–23 cm apart; double rows 23 cm, 60 cm between double rows',
        ),
        almanac(
          'https://www.almanac.com/plant/fava-beans',
          '~8 in apart in double rows, 60–75 cm between double rows',
        ),
      ],
    },
    note: 'Between-row 60 cm is the gap between double rows (broad beans are grown in mutually-supporting double rows). Row-only: no established square-foot density.',
  },
  {
    id: 'french-bean',
    commonName: 'French bean',
    scientificName: 'Phaseolus vulgaris',
    category: 'vegetable',
    // Row: RHS dwarf 15 cm apart in blocks/double rows. Almanac bush beans
    // ~2 in (5 cm) in-row, rows 18 in (45 cm). in-row 15 cm (RHS, block growing);
    // between-row 45 cm.
    spacing: {
      row: { inRowCm: 15, betweenRowCm: 45 },
      // Intensive: bush/dwarf French beans are a 4 in / 9-per-square SFG crop.
      intensive: { plantsPerSquare: 9 },
    },
    provenance: {
      row: [
        rhs(
          'https://www.rhs.org.uk/vegetables/french-beans/grow-your-own',
          'dwarf 15 cm apart in blocks/double rows',
        ),
        almanac('https://www.almanac.com/plant/beans', 'bush beans ~2 in apart, rows 18 in'),
      ],
      intensive: [
        sfgFoundation(
          'https://squarefootgardening.org/2024/02/square-foot-spacing/',
          'bush bean in the 4 in / 9-per-square class',
        ),
        sfgChart(
          "Square-foot garden plan (Old Farmer's Almanac)",
          'https://www.almanac.com/square-foot-garden-plan',
          'bush beans at 9 per square',
        ),
      ],
    },
    note: 'Dwarf/bush French bean, grown in blocks so plants support each other; in-row spacing ranges 5–15 cm across sources (15 cm recorded for block growing). Climbing French beans need much wider spacing and are not covered here.',
  },
];
