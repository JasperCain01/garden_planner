/**
 * The curated soil-moisture table: what each core crop wants underfoot.
 *
 * Read `./schema.ts` first — it explains why this slice exists, why its
 * evidence bar is deliberately lower than the hand-verified spacing table's,
 * and what the `note` on each row is for.
 *
 * ## Scope: the crops people actually grow here
 *
 * Roughly 70 rows covering the British garden and allotment core — not all 144
 * shipped crops. When this table was written the dataset still carried a long
 * tail of things that will not grow outdoors in Britain (dragon fruit, papaya,
 * lemongrass, okra), and skipping them was one of the reasons the table is
 * shorter than the catalogue. Stage 6.0 has since removed those crops outright
 * (`../exclusions/`, ADR 0025), so what is left uncovered here is mostly the
 * cultivar padding — four onions, seven squashes, six peppers — which is not
 * worth a moisture opinion of its own, because Purple Carrot wants exactly
 * what Carrot wants.
 *
 * A crop with no row here simply keeps `soil` absent and its `soil` dimension
 * reports `unknown-plant` — the same honest "we don't know" the engine already
 * gives, not a guess.
 *
 * ## How to read the values
 *
 * `moisture` is what the crop is **happy in**, not what it will barely
 * survive. Three values, coarse on purpose:
 *
 * - **`dry`** — copes with, or prefers, ground that dries out between waterings.
 * - **`moist`** — wants steady moisture; the default for most vegetables.
 * - **`wet`** — happy in ground that stays properly damp.
 *
 * Arrays express range. `['dry','moist']` is a crop that tolerates a dry spell
 * but does not need one; `['moist','wet']` is one that will not forgive drying
 * out. Single-value rows are the emphatic cases at either end — rosemary really
 * does want it dry, watercress really does want it wet.
 *
 * ## The one bias worth declaring
 *
 * These are **British outdoor** judgements. "Dry" here means a free-draining
 * bank in a UK summer, not a Mediterranean hillside; every crop below would
 * want more water in a hotter climate. `DESIGN.md` sets Britain as the default
 * and this table follows it.
 */

import type { MoistureRecord } from './schema.ts';

/**
 * Moisture preferences, grouped by how thirsty the crop is so the table reads
 * as an argument rather than an alphabetical list. The merge does not care
 * about order.
 */
export const CURATED_MOISTURE: readonly MoistureRecord[] = [
  // ── Wants it genuinely damp ────────────────────────────────────────────────
  // The short list of crops where letting the ground dry out is the failure
  // mode, not merely a setback.
  {
    id: 'watercress',
    moisture: ['wet'],
    note: 'A marginal aquatic — grown in or beside running water, and the one crop here that will not tolerate merely "moist".',
  },
  {
    id: 'celery',
    moisture: ['moist', 'wet'],
    note: 'Descended from wild marsh celery; drying out is what makes the sticks stringy and bitter.',
  },
  {
    id: 'celeriac',
    moisture: ['moist', 'wet'],
    note: 'Same marsh ancestry as celery — a check from dry soil makes the root woody and small.',
  },
  {
    id: 'mint',
    moisture: ['moist', 'wet'],
    note: 'Thrives in damp ground and shrugs off conditions that would sulk most herbs; the usual problem is containing it, not watering it.',
  },
  {
    id: 'rhubarb',
    moisture: ['moist', 'wet'],
    note: 'A gross feeder with big leaves losing water fast; wants moisture-retentive ground, though not standing water in winter.',
  },

  // ── Steady moisture: most vegetables ───────────────────────────────────────
  // The default. Nearly all annual veg is bred for fast, uninterrupted growth,
  // and a dry check shows up as bolting, splitting, or toughness.
  {
    id: 'pea',
    moisture: ['moist'],
    note: 'Dryness at flowering and pod-fill is the classic cause of poor pods; mulching and steady water matter more than feeding.',
  },
  {
    id: 'snap-pea',
    moisture: ['moist'],
    note: 'As pea — edible pods need steady moisture to stay tender rather than fibrous.',
  },
  {
    id: 'snow-pea',
    moisture: ['moist'],
    note: 'As pea; the flat pods toughen quickly if the plant is checked by drought.',
  },
  {
    id: 'green-bean',
    moisture: ['moist'],
    note: 'Pods set and swell only with steady moisture; a dry spell at flowering drops the flowers outright.',
  },
  {
    id: 'runner-bean',
    moisture: ['moist'],
    note: 'The thirstiest of the common beans — traditionally grown over a moisture-holding trench for exactly this reason.',
  },
  {
    id: 'wax-bean',
    moisture: ['moist'],
    note: 'As green bean; a wax-podded form with the same water needs.',
  },
  {
    id: 'potato',
    moisture: ['moist'],
    note: 'Tuber bulking needs consistent water; irregular watering causes hollow heart and misshapen tubers.',
  },
  {
    id: 'lettuce',
    moisture: ['moist'],
    note: 'Shallow-rooted and quick to bolt or turn bitter once the ground dries.',
  },
  {
    id: 'romaine-lettuce',
    moisture: ['moist'],
    note: 'As lettuce — a cos type with the same shallow roots and bolting response to drought.',
  },
  {
    id: 'looseleaf-lettuce',
    moisture: ['moist'],
    note: 'As lettuce; cut-and-come-again picking makes steady moisture more important, not less.',
  },
  {
    id: 'arugula',
    moisture: ['moist'],
    note: 'Bolts fast and turns fiercely hot when dry; steady moisture keeps the leaf mild.',
  },
  {
    id: 'endive',
    moisture: ['moist'],
    note: 'A chicory grown for leaf — dryness compounds the natural bitterness.',
  },
  {
    id: 'spinach',
    moisture: ['moist'],
    note: 'One of the quickest crops to bolt in dry ground, which ends the harvest entirely.',
  },
  {
    id: 'sorrel',
    moisture: ['moist'],
    note: 'A leaf crop wanting damp ground; dries to toughness and runs to seed.',
  },
  {
    id: 'rainbow-chard',
    moisture: ['moist'],
    note: 'More drought-resilient than spinach thanks to a deeper root, but leaf quality still depends on steady water.',
  },
  {
    id: 'swiss-chard-3',
    moisture: ['moist'],
    note: 'As rainbow chard — the same plant, grown for its stems and leaves.',
  },
  {
    id: 'beet',
    moisture: ['moist'],
    note: 'Steady water keeps roots tender; a dry spell followed by rain is what splits them.',
  },
  {
    id: 'golden-beet',
    moisture: ['moist'],
    note: 'As beetroot — a colour form with identical needs.',
  },
  {
    id: 'radish',
    moisture: ['moist'],
    note: 'Fast growth is the whole point; dry ground makes roots woody, hot, and prone to bolting.',
  },
  {
    id: 'turnip',
    moisture: ['moist'],
    note: 'Wants quick uninterrupted growth — checked roots go woody and sharp.',
  },
  {
    id: 'kohlrabi',
    moisture: ['moist'],
    note: 'The swollen stem turns fibrous if growth is checked by drought.',
  },
  {
    id: 'cabbage',
    moisture: ['moist'],
    note: 'A heavy leafy crop on firm, moisture-retentive ground; heads split when drought is broken by heavy rain.',
  },
  {
    id: 'red-cabbage',
    moisture: ['moist'],
    note: 'As cabbage — same crop, same needs.',
  },
  {
    id: 'broccoli',
    moisture: ['moist'],
    note: 'Head quality depends on unchecked growth; dryness gives small, loose heads that run to flower.',
  },
  {
    id: 'cauliflower',
    moisture: ['moist'],
    note: 'The least forgiving brassica — any check from dry soil produces a "button" curd that never recovers.',
  },
  {
    id: 'romanesco',
    moisture: ['moist'],
    note: 'A cauliflower in all but appearance, and just as unforgiving of a dry check.',
  },
  {
    id: 'kale',
    moisture: ['moist'],
    note: 'Tougher than most brassicas and will survive a dry spell, but leaf quality follows the water.',
  },
  {
    id: 'lacinato-kale',
    moisture: ['moist'],
    note: 'As kale — cavolo nero, with the same tolerance and the same preference.',
  },
  {
    id: 'collard-greens',
    moisture: ['moist'],
    note: 'A loose-leaf brassica; steady moisture keeps leaves tender rather than leathery.',
  },
  {
    id: 'leek',
    moisture: ['moist'],
    note: 'A long season in the ground and no drought tolerance to speak of; dry spells give thin shanks.',
  },
  {
    id: 'spring-onion',
    moisture: ['moist'],
    note: 'Shallow-rooted and harvested young — unlike bulb onions it wants steady moisture throughout.',
  },
  {
    id: 'green-onion',
    moisture: ['moist'],
    note: 'A bunching onion grown for the green — as spring onion, steady moisture keeps it tender.',
  },
  {
    id: 'zucchini',
    moisture: ['moist'],
    note: 'Enormous leaves and continuous fruiting make it one of the thirstiest crops on the plot.',
  },
  {
    id: 'butternut-squash',
    moisture: ['moist'],
    note: 'Wants plenty of water while fruits swell, though it will scavenge deeply once established.',
  },
  {
    id: 'cucumber-straight-eight',
    moisture: ['moist'],
    note: 'Fruit is almost entirely water; a dry check makes it bitter and misshapen.',
  },
  {
    id: 'corn',
    moisture: ['moist'],
    note: 'Critical water need at tasselling and cob-fill; drought then gives gappy, unfilled cobs.',
  },
  {
    id: 'tomato',
    moisture: ['moist'],
    note: 'Wants even moisture above all — it is fluctuation, not quantity, that causes blossom-end rot and splitting.',
  },
  {
    id: 'cherry-tomato',
    moisture: ['moist'],
    note: 'As tomato, and rather more prone to splitting after an irregular watering.',
  },
  {
    id: 'bell-pepper',
    moisture: ['moist'],
    note: 'Steady moisture while fruit swells; like tomato it resents drying out and flooding in turn.',
  },
  {
    id: 'eggplant',
    moisture: ['moist'],
    note: 'A hungry, thirsty crop under British conditions, where it is usually under cover anyway.',
  },
  {
    id: 'strawberry',
    moisture: ['moist'],
    note: 'Shallow-rooted with fruit that swells fast; dry ground at fruiting means small, seedy berries.',
  },
  {
    id: 'asparagus',
    moisture: ['moist'],
    note: 'Wants moisture-retentive but genuinely free-draining ground — a permanent bed rots in winter wet.',
  },
  {
    id: 'artichoke',
    moisture: ['moist'],
    note: 'A big architectural plant losing a lot through its leaves; bud size follows water.',
  },
  {
    id: 'horseradish',
    moisture: ['moist'],
    note: 'Roots run deep and stay productive in damp ground; drought makes them tough and stringy.',
  },
  {
    id: 'basil',
    moisture: ['moist'],
    note: 'Wants warmth and steady moisture together — it wilts dramatically and recovers poorly.',
  },
  {
    id: 'coriander',
    moisture: ['moist'],
    note: 'Bolts almost immediately if allowed to dry, which ends the leaf harvest.',
  },
  {
    id: 'chervil',
    moisture: ['moist'],
    note: 'A cool, damp-loving annual herb; dryness makes it run to seed at once.',
  },
  {
    id: 'dill',
    moisture: ['moist'],
    note: 'Steady moisture prolongs leaf production before it flowers.',
  },
  {
    id: 'chives',
    moisture: ['moist'],
    note: 'A clump-forming allium wanting damper ground than its bulbing relatives.',
  },
  {
    id: 'garlic-chives',
    moisture: ['moist'],
    note: 'As chives — grown for leaf, so steady moisture keeps it cutting.',
  },
  {
    id: 'lemon-balm',
    moisture: ['moist'],
    note: 'A mint relative with the same liking for damp ground, if less aggressively so.',
  },
  {
    id: 'lovage',
    moisture: ['moist'],
    note: 'A tall perennial herb of damp ground; leaves coarsen quickly when dry.',
  },

  // ── Copes with dry ground, or actively wants it ────────────────────────────
  // Two distinct cases sharing a value: Mediterranean herbs that rot in wet
  // soil, and deep-rooted or bulbing crops that merely tolerate drying out.
  {
    id: 'rosemary',
    moisture: ['dry'],
    note: 'Mediterranean shrub — far more is lost to winter wet than to drought, which is the usual British failure.',
  },
  {
    id: 'thyme',
    moisture: ['dry'],
    note: 'Wants sharp drainage and a dry root run; damp ground rots the crown.',
  },
  {
    id: 'sage',
    moisture: ['dry'],
    note: 'Mediterranean sub-shrub; sulks and rots in heavy wet soil, thrives on a dry bank.',
  },
  {
    id: 'marjoram',
    moisture: ['dry'],
    note: 'As with oregano generally — flavour concentrates on a dry, poor site and dilutes on a rich damp one.',
  },
  {
    id: 'summer-savory',
    moisture: ['dry', 'moist'],
    note: 'Tolerates a dry site like its Mediterranean neighbours, but as an annual it is less fussy about it.',
  },
  {
    id: 'borage',
    moisture: ['dry', 'moist'],
    note: 'Deep-rooted and genuinely drought-tolerant once away; self-seeds happily on poor dry ground.',
  },
  {
    id: 'fennel',
    moisture: ['dry', 'moist'],
    note: 'Deep tap root copes with dry spells, though bulbing Florence types want more water than the herb.',
  },
  {
    id: 'carrot',
    moisture: ['dry', 'moist'],
    note: 'Wants light, free-draining ground — roots fork and split in soil that stays wet, so drying out is the lesser risk.',
  },
  {
    id: 'parsnip',
    moisture: ['dry', 'moist'],
    note: 'As carrot: a deep tap root that reaches its own water and dislikes waterlogged ground.',
  },
  {
    id: 'onion',
    moisture: ['dry', 'moist'],
    note: 'Wants water while bulking but a dry finish to ripen and store; wet ground at maturity causes neck rot.',
  },
  {
    id: 'red-onion',
    moisture: ['dry', 'moist'],
    note: 'As onion — the same crop, and the same need for a dry ripening period.',
  },
  {
    id: 'shallot',
    moisture: ['dry', 'moist'],
    note: 'As onion, and if anything more prone to rotting in ground that stays wet.',
  },
  {
    id: 'garlic',
    moisture: ['dry', 'moist'],
    note: 'Overwinters in the ground, so drainage matters more than watering; a wet winter bed rots the cloves.',
  },
  {
    id: 'sweet-potato',
    moisture: ['dry', 'moist'],
    note: 'Tolerates dry spells well once established, and resents cold wet ground far more.',
  },
  {
    id: 'tomatillo',
    moisture: ['dry', 'moist'],
    note: 'Noticeably more drought-tolerant than the tomato it resembles.',
  },
];
