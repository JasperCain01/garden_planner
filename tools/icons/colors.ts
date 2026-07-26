/**
 * Colour tokens for the Stage 4.1 icon set. See `docs/icon-style-guide.md` for
 * the reasoning: fill colour encodes the plant's edible *category* (so the
 * palette/canvas keeps a consistent "vegetable vs. fruit vs. herb" read even
 * before Stage 4.2 wires in any other UI colour-coding); silhouette (see
 * `archetypes.ts`) encodes the crop family. One ink stroke colour is shared by
 * every icon so the set reads as one system rather than 160 independent ones.
 */

import type { EdibleCategory } from '../../packages/engine/src/schema/plant.ts';

/** The single stroke colour used across every icon, including the fallback. */
export const INK = '#20301f';

/** Fill colour per edible category. */
export const CATEGORY_FILL: Record<EdibleCategory, string> = {
  vegetable: '#4f8a45',
  fruit: '#d1683a',
  herb: '#2f8577',
};

/** Fill colour for the generic fallback icon — deliberately neutral/desaturated
 * so it reads as "no specific icon" rather than as a fourth category. */
export const FALLBACK_FILL = '#8a8f87';
