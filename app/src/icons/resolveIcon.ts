/**
 * The icon lookup/registry (Workplan Stage 4.1; brief: `docs/stage-4.1-brief.md`).
 *
 * This is the one piece of logic this stage hands off — the interface Stage
 * 4.2 (wiring icons into the palette and canvas) calls instead of reaching
 * into `crops/` directly. Resolution order, per the brief:
 *
 *   1. `plant.icon`, if set (a user crop may eventually pick one explicitly).
 *   2. `plant.id`, since a shipped crop's icon is usually named after its id
 *      (`PlantSchema.icon`'s own doc comment: "often equal to `id`").
 *   3. The generic fallback icon, if neither resolves to a bundled asset —
 *      this is the path every user-defined crop takes today (Stage 3.6 never
 *      sets `icon`), and the path any future crop takes before its icon ships.
 *
 * Every crop icon is a **build-time bundled asset**, never a runtime fetch:
 * `import.meta.glob` resolves all of `crops/*.svg` to their final Vite asset
 * URLs at build time (WORKPLAN.md §0.1 — no runtime backend, everything the
 * app needs is a static file shipped with it).
 */

import type { Plant } from '@garden-planner/engine';

import genericIconUrl from './generic.svg';

// `query: '?url', import: 'default'` asks Vite for the resolved asset URL
// (a string) rather than the raw SVG source or a parsed module — the same
// thing a plain `import x from './foo.svg'` gives for one file, generalized
// to every file the glob matches. `eager: true` resolves them all up front
// (there are only ~144, and the previous shape — one `import` per file —
// would mean hand-maintaining an import list in step with `classification.ts`).
const cropIconUrls = import.meta.glob('./crops/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

/** Crop id (e.g. `"onion"`, from `onion.svg`) -> bundled asset URL. */
const ICON_URLS_BY_ID: ReadonlyMap<string, string> = new Map(
  Object.entries(cropIconUrls).map(([filePath, url]) => {
    const id = filePath.slice(filePath.lastIndexOf('/') + 1).replace(/\.svg$/, '');
    return [id, url];
  }),
);

/** The key used for the generic fallback icon in a resolved {@link IconAsset}. */
export const GENERIC_ICON_KEY = 'generic';

/** The generic fallback icon's own bundled asset URL, exposed for direct use
 * (e.g. Stage 3.6's icon picker, once one exists, showing it as an explicit option). */
export const GENERIC_ICON_URL: string = genericIconUrl;

/** The resolved icon for a plant: which key matched (or `"generic"`), its
 * bundled URL, and whether resolution fell back to the generic icon. */
export interface IconAsset {
  readonly key: string;
  readonly url: string;
  readonly isFallback: boolean;
}

/**
 * Resolve a plant to its bundled icon asset, falling back to the generic icon
 * when neither `plant.icon` nor `plant.id` matches a bundled crop icon. Never
 * throws and never returns `undefined` — every plant, shipped or user-defined,
 * gets *some* icon, which is the "no silent gaps" guarantee this stage exists
 * to provide.
 */
export function resolveIcon(plant: Pick<Plant, 'icon' | 'id'>): IconAsset {
  const key = plant.icon ?? plant.id;
  const url = ICON_URLS_BY_ID.get(key);
  if (url !== undefined) {
    return { key, url, isFallback: false };
  }
  return { key: GENERIC_ICON_KEY, url: genericIconUrl, isFallback: true };
}

/** The number of crop-specific icons bundled, for tests asserting the set is complete. */
export function bundledCropIconCount(): number {
  return ICON_URLS_BY_ID.size;
}
