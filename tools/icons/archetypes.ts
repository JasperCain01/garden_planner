/**
 * Shape library for the Stage 4.1 crop icon set.
 *
 * Rather than hand-drawing 160 unique illustrations, every icon is composed
 * from a small set of reusable *archetypes* (leaf, root, pod, round fruit,
 * ...) built out of an even smaller set of geometric primitives (a leaf
 * silhouette, a lobed body, a cluster of circles, ...). `classification.ts`
 * maps each of the 160 shipped crop ids onto one archetype (plus, for a
 * handful of visually distinctive crops, its own one-off archetype).
 *
 * This keeps the set genuinely "placeholder-quality but consistent" (per
 * `docs/stage-4.1-brief.md`'s own caution against over-investing illustration
 * time): a contributor can look at 19 small functions here to understand the
 * whole visual vocabulary, and add a 20th the same way, rather than
 * reverse-engineering 160 independent paths.
 *
 * Every archetype takes the same `(fill, ink)` pair — see
 * `docs/icon-style-guide.md` for the colour/stroke conventions this assumes
 * (64x64 viewBox, ~2.5 stroke width, single ink stroke colour, category fill).
 */

export const VIEWBOX_SIZE = 64;
export const STROKE_WIDTH = 2.5;

/** Wraps inner markup in the standard icon shell. See the style guide for why. */
export function svgShell(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}">\n${inner}\n</svg>\n`;
}

/** A single almond-shaped leaf centred at (cx, cy), pointing "up" before rotation. */
function leafPath(cx: number, cy: number, length: number, width: number): string {
  const half = length / 2;
  return [
    `M ${cx} ${cy - half}`,
    `C ${cx + width} ${cy - half / 2}, ${cx + width} ${cy + half / 2}, ${cx} ${cy + half}`,
    `C ${cx - width} ${cy + half / 2}, ${cx - width} ${cy - half / 2}, ${cx} ${cy - half}`,
    'Z',
  ].join(' ');
}

interface LeafOptions {
  cx: number;
  cy: number;
  length: number;
  width: number;
  angle?: number;
  fill: string;
  ink: string;
}

/** A leaf silhouette with a faint midrib, optionally rotated around its own centre. */
function leaf({ cx, cy, length, width, angle = 0, fill, ink }: LeafOptions): string {
  const midribInset = Math.min(4, length / 4);
  return `<g transform="rotate(${angle} ${cx} ${cy})">
    <path d="${leafPath(cx, cy, length, width)}" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <line x1="${cx}" y1="${cy - length / 2 + midribInset}" x2="${cx}" y2="${cy + length / 2 - midribInset}" stroke="${ink}" stroke-width="1" stroke-opacity="0.4"/>
  </g>`;
}

/** A short ground-line, used by root/bulb/tuber archetypes to suggest soil level. */
function groundLine(ink: string): string {
  return `<line x1="14" y1="54" x2="50" y2="54" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.35" stroke-linecap="round"/>`;
}

/** A generic round/oval fruit body with a small leaf and stem — the fallback "fruit" shape. */
function roundBody(fill: string, ink: string, ry = 20): string {
  return `<ellipse cx="32" cy="36" rx="18" ry="${ry}" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>`;
}

function stemAndCap(ink: string, fill: string): string {
  return `
    <path d="M32 16 C 34 12, 38 10, 42 11" fill="none" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
    ${leaf({ cx: 38, cy: 12, length: 14, width: 6, angle: 30, fill, ink })}
  `;
}

// ---------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------

/** A single broad leaf — the default look for leafy greens. */
export function leafArchetype(fill: string, ink: string): string {
  return leaf({ cx: 32, cy: 32, length: 42, width: 14, angle: 6, fill, ink });
}

/** Three overlapping leaves forming a rosette — cabbage/lettuce-style heads. */
export function roundHeadArchetype(fill: string, ink: string): string {
  return `
    ${leaf({ cx: 32, cy: 36, length: 34, width: 14, angle: -35, fill, ink })}
    ${leaf({ cx: 32, cy: 36, length: 34, width: 14, angle: 35, fill, ink })}
    ${leaf({ cx: 32, cy: 32, length: 36, width: 14, angle: 0, fill, ink })}
  `;
}

/** A stem with a dome of small florets — broccoli/cauliflower/artichoke/romanesco. */
export function flowerHeadArchetype(fill: string, ink: string): string {
  const florets = [
    [32, 24, 11],
    [21, 30, 9],
    [43, 30, 9],
    [32, 34, 10],
    [14, 34, 6],
    [50, 34, 6],
  ] as const;
  const circles = florets
    .map(
      ([cx, cy, r]) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>`,
    )
    .join('\n');
  return `
    <rect x="28" y="40" width="8" height="16" rx="3" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>
    ${circles}
    ${groundLine(ink)}
  `;
}

/** A round root bulb with a leafy top — beet/radish/turnip. */
export function rootRoundArchetype(fill: string, ink: string): string {
  return `
    <path d="M32 30 C 46 30, 48 46, 32 54 C 16 46, 18 30, 32 30 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    ${leaf({ cx: 26, cy: 20, length: 20, width: 6, angle: -20, fill, ink })}
    ${leaf({ cx: 38, cy: 20, length: 20, width: 6, angle: 20, fill, ink })}
    ${groundLine(ink)}
  `;
}

/** A long tapering root with a leafy top — carrot/parsnip/daikon/horseradish. */
export function rootLongArchetype(fill: string, ink: string): string {
  return `
    <path d="M24 24 C 24 24, 40 24, 40 24 C 40 36, 34 56, 32 58 C 30 56, 24 36, 24 24 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    ${leaf({ cx: 24, cy: 16, length: 20, width: 6, angle: -25, fill, ink })}
    ${leaf({ cx: 32, cy: 12, length: 20, width: 6, angle: 0, fill, ink })}
    ${leaf({ cx: 40, cy: 16, length: 20, width: 6, angle: 25, fill, ink })}
  `;
}

/** A layered bulb with a green sprout — onion/garlic/shallot. */
export function bulbAlliumArchetype(fill: string, ink: string): string {
  return `
    <path d="M32 26 C 46 26, 46 46, 32 54 C 18 46, 18 26, 32 26 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <path d="M24 34 C 30 34, 30 46, 26 50" fill="none" stroke="${ink}" stroke-width="1" stroke-opacity="0.4"/>
    <path d="M40 34 C 34 34, 34 46, 38 50" fill="none" stroke="${ink}" stroke-width="1" stroke-opacity="0.4"/>
    ${leaf({ cx: 28, cy: 16, length: 22, width: 4, angle: -10, fill, ink })}
    ${leaf({ cx: 36, cy: 16, length: 22, width: 4, angle: 10, fill, ink })}
    <path d="M28 54 L26 60 M32 54 L32 60 M36 54 L38 60" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.5" stroke-linecap="round"/>
  `;
}

/** A handful of upright ribbed stalks — celery/asparagus/rhubarb. */
export function stalkArchetype(fill: string, ink: string): string {
  const stalks = [
    [20, 30, 44],
    [30, 20, 54],
    [40, 26, 48],
  ] as const;
  const bars = stalks
    .map(
      ([x, y, h]) =>
        `<rect x="${x - 4}" y="${y}" width="8" height="${h}" rx="4" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>`,
    )
    .join('\n');
  return `
    ${bars}
    ${leaf({ cx: 30, cy: 16, length: 16, width: 8, angle: 0, fill, ink })}
  `;
}

/** A curved pod with a few seed bumps — beans/peas/soy/black-eyed pea/peanut. */
export function podArchetype(fill: string, ink: string): string {
  return `
    <path d="M14 22 C 40 14, 54 28, 50 44 C 44 58, 20 54, 14 40 C 10 32, 10 26, 14 22 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <circle cx="24" cy="28" r="3.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.5"/>
    <circle cx="32" cy="34" r="3.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.5"/>
    <circle cx="38" cy="42" r="3.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.5"/>
  `;
}

/** A cob with a kernel grid and two husk leaves — corn. */
export function cornArchetype(fill: string, ink: string): string {
  const kernelRows = [20, 26, 32, 38, 44].flatMap((y) =>
    [26, 32, 38].map(
      (x) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${ink}" fill-opacity="0.55"/>`,
    ),
  );
  return `
    ${leaf({ cx: 20, cy: 36, length: 34, width: 10, angle: -18, fill, ink })}
    ${leaf({ cx: 44, cy: 36, length: 34, width: 10, angle: 18, fill, ink })}
    <rect x="24" y="14" width="16" height="36" rx="7" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>
    ${kernelRows.join('\n')}
  `;
}

/** A ribbed round/oval squash body with a curled stem — winter squashes. */
export function squashArchetype(fill: string, ink: string): string {
  return `
    <ellipse cx="32" cy="36" rx="20" ry="18" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>
    <path d="M18 30 C 24 40, 24 42, 18 50" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.4"/>
    <path d="M32 20 C 34 32, 34 42, 32 54" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.4"/>
    <path d="M46 30 C 40 40, 40 42, 46 50" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.4"/>
    <path d="M32 18 C 32 12, 36 10, 38 14" fill="none" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
  `;
}

/** A long smooth curved capsule — cucumber/zucchini. */
export function elongatedVegArchetype(fill: string, ink: string): string {
  return `
    <path d="M18 46 C 14 30, 22 14, 38 12 C 52 10, 54 20, 48 32 C 42 46, 26 56, 18 46 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <path d="M24 40 C 30 32, 38 24, 44 20" fill="none" stroke="${ink}" stroke-width="1" stroke-opacity="0.35"/>
  `;
}

/** A rounded bulb narrowing to a calyx — eggplant. */
export function eggplantArchetype(fill: string, ink: string): string {
  return `
    <path d="M32 22 C 48 26, 50 44, 36 54 C 26 60, 16 50, 18 38 C 20 26, 26 20, 32 22 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <path d="M26 16 L32 22 L38 15" fill="none" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
    ${leaf({ cx: 30, cy: 12, length: 12, width: 6, angle: -15, fill, ink })}
  `;
}

/** A tapered, ridged pod with a pointed tip — okra. */
export function okraArchetype(fill: string, ink: string): string {
  return `
    <path d="M28 10 C 40 16, 44 34, 36 48 C 33 54, 30 56, 28 58 C 27 52, 22 34, 24 20 C 25 14, 26 11, 28 10 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <line x1="28" y1="14" x2="30" y2="52" stroke="${ink}" stroke-width="1" stroke-opacity="0.35"/>
  `;
}

/** A lobed pepper body with a stem cap. */
export function pepperArchetype(fill: string, ink: string): string {
  return `
    <path d="M32 20 C 46 18, 50 34, 44 46 C 40 56, 26 56, 20 48 C 14 40, 16 24, 26 20 C 28 24, 30 22, 32 20 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <path d="M30 20 C 28 14, 32 10, 38 12" fill="none" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
  `;
}

/** A round fruit body with a leaf and stem — tomatoes, citrus, stone fruit, ... */
export function roundFruitArchetype(fill: string, ink: string): string {
  return `
    ${roundBody(fill, ink, 19)}
    ${stemAndCap(ink, fill)}
  `;
}

/** An irregular lumpy blob with a couple of "eyes" — potato/sweet potato. */
export function tuberArchetype(fill: string, ink: string): string {
  return `
    <path d="M16 34 C 14 24, 24 18, 34 20 C 44 22, 52 26, 50 36 C 48 46, 40 50, 30 48 C 20 46, 18 44, 16 34 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <circle cx="26" cy="30" r="1.6" fill="${ink}" fill-opacity="0.5"/>
    <circle cx="38" cy="34" r="1.6" fill="${ink}" fill-opacity="0.5"/>
    <circle cx="32" cy="41" r="1.6" fill="${ink}" fill-opacity="0.5"/>
    ${groundLine(ink)}
  `;
}

/** A cluster of small round berries on a twig. */
export function berryClusterArchetype(fill: string, ink: string): string {
  const berries = [
    [26, 34, 9],
    [38, 32, 9],
    [32, 44, 9],
  ] as const;
  const circles = berries
    .map(
      ([cx, cy, r]) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>`,
    )
    .join('\n');
  return `
    <path d="M32 24 L32 14" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
    ${leaf({ cx: 32, cy: 14, length: 14, width: 6, angle: -10, fill, ink })}
    ${circles}
  `;
}

/** A large round fruit with rind arcs — melons. */
export function melonArchetype(fill: string, ink: string): string {
  return `
    <ellipse cx="32" cy="34" rx="21" ry="19" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>
    <path d="M14 26 C 22 30, 22 38, 14 42" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.35"/>
    <path d="M32 15 C 32 26, 32 42, 32 53" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.35"/>
    <path d="M50 26 C 42 30, 42 38, 50 42" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity="0.35"/>
    <path d="M32 15 C 32 11, 36 9, 39 12" fill="none" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
  `;
}

/** A rounded nut with a scalloped cap — chestnut/hazelnut. */
export function nutArchetype(fill: string, ink: string): string {
  return `
    <path d="M32 28 C 44 28, 48 40, 40 50 C 34 56, 30 56, 24 50 C 16 40, 20 28, 32 28 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <path d="M20 28 C 20 20, 26 16, 32 18 C 38 16, 44 20, 44 28 C 36 24, 28 24, 20 28 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
  `;
}

/** A slender sprig with several small leaflets — the default herb look. */
export function herbSprigArchetype(fill: string, ink: string): string {
  const pairs = [
    [24, 20, -35],
    [40, 20, 35],
    [22, 32, -25],
    [42, 32, 25],
    [24, 44, -15],
    [40, 44, 15],
  ] as const;
  const leaves = pairs
    .map(([cx, cy, angle]) => leaf({ cx, cy, length: 14, width: 5, angle, fill, ink }))
    .join('\n');
  return `
    <path d="M32 54 L32 14" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
    ${leaves}
    ${leaf({ cx: 32, cy: 12, length: 14, width: 5, angle: 0, fill, ink })}
  `;
}

/** A criss-crossed oval body with a spiky leaf crown — pineapple. */
export function pineappleArchetype(fill: string, ink: string): string {
  const crossHatch = [-16, -8, 0, 8, 16]
    .map(
      (dx) =>
        `<path d="M${32 + dx} 26 L${32 + dx + 10} 52" stroke="${ink}" stroke-width="1" stroke-opacity="0.35"/>`,
    )
    .join('\n');
  return `
    <path d="M32 24 C 46 24, 48 42, 40 54 C 36 58, 28 58, 24 54 C 16 42, 18 24, 32 24 Z" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>
    <g clip-path="none">${crossHatch}</g>
    ${leaf({ cx: 32, cy: 14, length: 20, width: 5, angle: 0, fill, ink })}
    ${leaf({ cx: 24, cy: 16, length: 16, width: 5, angle: -25, fill, ink })}
    ${leaf({ cx: 40, cy: 16, length: 16, width: 5, angle: 25, fill, ink })}
  `;
}

/** An oval body with small triangular spikes — dragon fruit. */
export function dragonFruitArchetype(fill: string, ink: string): string {
  const spikes = [
    [22, 20],
    [42, 20],
    [16, 34],
    [48, 34],
    [22, 48],
    [42, 48],
  ] as const;
  const spikeShapes = spikes
    .map(
      ([cx, cy]) =>
        `<path d="M${cx} ${cy} l-3 -6 l6 0 Z" fill="${fill}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>`,
    )
    .join('\n');
  return `
    <ellipse cx="32" cy="34" rx="17" ry="20" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}"/>
    ${spikeShapes}
    ${leaf({ cx: 32, cy: 12, length: 12, width: 5, angle: 0, fill, ink })}
  `;
}

/** A five-pointed star cross-section — star fruit. */
export function starFruitArchetype(fill: string, ink: string): string {
  const points: string[] = [];
  const outerR = 22;
  const innerR = 9;
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = 32 + r * Math.cos(angle);
    const y = 34 + r * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round"/>`;
}

/** The generic fallback icon: a simple two-leaf seedling. Used when a crop has no icon at all. */
export function seedlingArchetype(fill: string, ink: string): string {
  return `
    <path d="M32 56 L32 30" stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>
    ${leaf({ cx: 22, cy: 30, length: 24, width: 10, angle: -30, fill, ink })}
    ${leaf({ cx: 42, cy: 30, length: 24, width: 10, angle: 30, fill, ink })}
    ${groundLine(ink)}
  `;
}

/** All archetype keys, mapped to their builder function. Used by the generator and its tests. */
export const ARCHETYPES = {
  leaf: leafArchetype,
  roundHead: roundHeadArchetype,
  flowerHead: flowerHeadArchetype,
  rootRound: rootRoundArchetype,
  rootLong: rootLongArchetype,
  bulbAllium: bulbAlliumArchetype,
  stalk: stalkArchetype,
  pod: podArchetype,
  corn: cornArchetype,
  squash: squashArchetype,
  elongatedVeg: elongatedVegArchetype,
  eggplant: eggplantArchetype,
  okra: okraArchetype,
  pepper: pepperArchetype,
  roundFruit: roundFruitArchetype,
  tuber: tuberArchetype,
  berryCluster: berryClusterArchetype,
  melon: melonArchetype,
  nut: nutArchetype,
  herbSprig: herbSprigArchetype,
  pineapple: pineappleArchetype,
  dragonFruit: dragonFruitArchetype,
  starFruit: starFruitArchetype,
} as const;

export type ArchetypeKey = keyof typeof ARCHETYPES;
