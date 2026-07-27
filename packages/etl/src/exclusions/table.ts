/**
 * The UK-outdoor exclusion list: crops the shipped dataset deliberately drops.
 *
 * Read `./schema.ts` first — it explains why this slice exists, why deletion
 * rather than a flag, and why a stated reason stands in for citations here.
 *
 * ## The test each row had to pass
 *
 * > **In an average British summer, can this crop give a usable harvest
 * > outdoors, in an open garden or allotment, with no greenhouse, polytunnel or
 * > heated protection?**
 *
 * Every clause of that matters. *Average* rules out the crop that fruits once a
 * decade in a record summer. *Usable harvest* rules out the tree that grows
 * happily and never ripens anything — a planner for edibles has no use for a
 * plant you cannot eat. And *no protection* is the line that keeps the test
 * decidable: "under glass" is a different app, and once greenhouses are in
 * scope almost nothing is excluded.
 *
 * Twenty-four crops fail it, on the two grounds `EXCLUSION_BASES` names.
 *
 * ## Why twenty-four and not the ~32 the workplan estimated
 *
 * `WORKPLAN.md`'s Stage 6.0 entry guessed "roughly 32" without enumerating
 * them. Working the actual list against the test above lands on 24, and the
 * difference is worth stating because it is not an oversight: the remaining
 * candidates are crops that a British gardener really does grow outdoors,
 * awkwardly but successfully. **Aubergine, chillies, sweet potato, soya beans,
 * cape gooseberry, tomatillo and the tender herbs** (Thai basil, stevia,
 * pineapple sage, Mexican tarragon) are all grown here as summer annuals,
 * planted out after the last frost and cleared before the first. They are
 * marginal, not impossible, and marginal is precisely what a suitability score
 * is for — hiding them would be the app answering a question it should be
 * ranking.
 *
 * Two further borderline keeps, both deliberate:
 *
 * - **Saffron and liquorice** sound exotic and are not: saffron crocus has been
 *   grown in Essex since the fourteenth century (Saffron Walden is named for
 *   it) and liquorice was a Yorkshire field crop at Pontefract.
 * - **Myoga ginger** is not culinary ginger — it is a hardy Japanese perennial
 *   that takes British winters, unlike `ginger` below.
 *
 * ## What this list is not
 *
 * It is **not** a de-duplication pass. The dataset also carries cultivar
 * padding — four onions, three cauliflowers, three carrots, four radishes,
 * seven squashes, six peppers — and every one of those grows here perfectly
 * well. Removing them would be a different decision on different grounds
 * (catalogue tidiness, not viability), so it is deliberately out of scope; see
 * ADR 0025's Consequences.
 */

import type { ExcludedCrop } from './schema.ts';

/**
 * Crops excluded from `data/plants.json`, grouped by why. The merge does not
 * care about order; the grouping is for the reader.
 */
export const EXCLUDED_CROPS: readonly ExcludedCrop[] = [
  // ── Too tender: a British winter, or an ordinary British night, kills it ───
  // Tropical and subtropical perennials that need a full year of warmth. None
  // can be grown to a harvest as a summer annual either, which is the test that
  // separates these from the tender annuals the dataset keeps (see the module
  // doc's note on aubergines and chillies).
  {
    id: 'dragon-fruit',
    commonName: 'Dragon fruit',
    basis: 'too-tender',
    note: 'A tropical climbing cactus that needs frost-free warmth year round and a long hot season to flower at all; outdoors in Britain it rots in the first wet winter.',
  },
  {
    id: 'papaya',
    commonName: 'Papaya',
    basis: 'too-tender',
    note: 'Killed outright at around 0°C, and needs a year or more of continuous warmth before it fruits — so a British summer cannot even be used as a run-up.',
  },
  {
    id: 'pineapple',
    commonName: 'Pineapple',
    basis: 'too-tender',
    note: 'A tropical bromeliad taking roughly eighteen months of warmth to fruit. Historically grown here in heated pineapple pits, which is the exception that proves the rule.',
  },
  {
    id: 'star-fruit',
    commonName: 'Star fruit',
    basis: 'too-tender',
    note: 'Carambola is damaged below about 5°C and drops its leaves well above freezing; it needs a tropical or warm-subtropical climate to crop.',
  },
  {
    id: 'strawberry-guava',
    commonName: 'Strawberry guava',
    basis: 'too-tender',
    note: 'A subtropical evergreen shrub cut back or killed by British frosts, and needing far more summer heat than Britain gives to ripen fruit.',
  },
  {
    id: 'yellow-strawberry-guava',
    commonName: 'Yellow strawberry guava',
    basis: 'too-tender',
    note: 'The yellow-fruited form of the same subtropical species, with the same intolerance of a British winter — one of two near-duplicate guava records the dataset carried.',
  },
  {
    id: 'grapefruit',
    commonName: 'Grapefruit',
    basis: 'too-tender',
    note: 'Citrus needs a frost-free winter and a long hot summer to ripen; grapefruit is the most heat-demanding of the common citrus, so it is a conservatory plant here, not a garden tree.',
  },
  {
    id: 'orange',
    commonName: 'Orange',
    basis: 'too-tender',
    note: 'As grapefruit — sweet orange needs a frost-free winter. British "orangeries" exist precisely because the tree cannot be left outside.',
  },
  {
    id: 'lemongrass',
    commonName: 'Lemongrass',
    basis: 'too-tender',
    note: 'A tropical grass killed by the first frost, and one British summer is not long or warm enough for it to build stems thick enough to be worth cutting.',
  },
  {
    id: 'ginger',
    commonName: 'Ginger',
    basis: 'too-tender',
    note: 'Culinary ginger needs eight to ten months of warm, humid growth to make a rhizome worth lifting; the British season offers roughly half that, and the plant is frost-tender throughout.',
  },
  {
    id: 'water-spinach',
    commonName: 'Water spinach',
    basis: 'too-tender',
    note: 'A tropical aquatic that stops growing below about 24°C water temperature and is killed by frost — it needs standing warm water Britain does not have outdoors.',
  },
  {
    id: 'olive',
    commonName: 'Olive',
    basis: 'too-tender',
    note: 'Young trees survive in mild southern gardens, but olives need a Mediterranean summer to ripen and a cool-dry (not cold-wet) winter to set flower buds. Grown here as an ornamental, not a crop.',
  },

  // ── Won't ripen: it lives here quite happily, and never gives you anything ─
  // The harder half of the judgement, and the more useful one. These are the
  // plants a British gardener can buy, plant, and keep alive for years without
  // ever picking a crop — which is exactly the disappointment a suitability
  // ranking exists to prevent.
  {
    id: 'okra',
    commonName: 'Okra',
    basis: 'wont-ripen',
    note: 'Needs months of sustained heat above 20°C to set and swell pods. Outdoors in Britain it sulks at ankle height and pods barely at all; it is a polytunnel crop here.',
  },
  {
    id: 'peanut',
    commonName: 'Peanut',
    basis: 'wont-ripen',
    note: 'Flowers push their pegs underground and need a long hot season to fill; a cool British summer leaves empty shells, and the autumn is too wet to cure the crop.',
  },
  {
    id: 'black-eyed-pea',
    commonName: 'Black-eyed pea',
    basis: 'wont-ripen',
    note: 'Cowpea is a hot-climate legume that will germinate here but sets almost nothing below sustained warmth — a British summer gives foliage and no beans worth drying.',
  },
  {
    id: 'cumin',
    commonName: 'Cumin',
    basis: 'wont-ripen',
    note: 'Needs three to four months of steady heat to ripen seed. In Britain it flowers late and the seed heads rot in the damp autumn before they dry.',
  },
  {
    id: 'melon',
    commonName: 'Melon',
    basis: 'wont-ripen',
    note: 'Melons need greenhouse or polytunnel heat to ripen in Britain — the standard advice is to grow them under cover, which puts them outside the outdoor scope this dataset is curated for.',
  },
  {
    id: 'cantaloupe',
    commonName: 'Cantaloupe',
    basis: 'wont-ripen',
    note: 'As melon: the hardiest of the group and still an under-cover crop here. One of three near-duplicate melon records the dataset carried.',
  },
  {
    id: 'honeydew-melon',
    commonName: 'Honeydew melon',
    basis: 'wont-ripen',
    note: 'As melon, and the slowest-ripening of the three — it needs a longer hot season than either cantaloupe or an ordinary British summer supplies.',
  },
  {
    id: 'loquat',
    commonName: 'Loquat',
    basis: 'wont-ripen',
    note: 'The tree is hardy enough for southern Britain, but it flowers in late autumn and winter, so British frosts destroy the blossom and the fruit almost every year.',
  },
  {
    id: 'pomegranate',
    commonName: 'Pomegranate',
    basis: 'wont-ripen',
    note: 'Flowers readily against a warm wall, but ripening the fruit needs a long, hot, dry autumn. In Britain it is grown for the flowers and the fruit stays hard and sour.',
  },
  {
    id: 'persimmon',
    commonName: 'Persimmon',
    basis: 'wont-ripen',
    note: 'The wood takes British cold, but the fruit needs a long warm autumn to ripen off the tree; outside the warmest, most sheltered southern gardens it does not get there.',
  },
  {
    id: 'feijoa',
    commonName: 'Feijoa',
    basis: 'wont-ripen',
    note: 'Hardy to roughly -10°C, so it survives in mild gardens, but setting and ripening fruit needs a hotter, longer season than Britain gives. Widely planted here as an ornamental shrub.',
  },
  {
    id: 'pawpaw',
    commonName: 'Pawpaw',
    basis: 'wont-ripen',
    note: 'Asimina triloba is fully hardy — the limit is heat, not cold: it needs a long, hot continental summer to ripen, and British summers rarely accumulate enough.',
  },
];
