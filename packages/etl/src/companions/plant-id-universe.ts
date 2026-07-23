/**
 * The plant-id universe companion/antagonist links are validated against
 * (Workplan Stage 1.4 — see `docs/adr/0008-companion-planting-data.md`).
 *
 * Referential integrity (every link resolves to a real plant in the final,
 * merged dataset) is formally Stage 1.5's job — a relationship authored here
 * can't see the whole eventual merged dataset, the same reasoning
 * `PlantLinkSchema`'s own doc comment gives for not enforcing it in the
 * schema. But this stage shouldn't author dangling links *by construction*
 * either. The natural id universe *before* the Stage 1.5 merge is the union
 * of the two id-producing stages that exist today:
 *
 * - the Stage 1.3 hand-verified spacing table (`HAND_VERIFIED_SPACING`, 12 ids), and
 * - every OpenFarm crop Stage 1.2's adapter can actually turn into a `Plant`
 *   (`mapOpenFarmCrop`, ~161 ids) — deliberately the *mapped* set, not the
 *   full 340-record dump and not even the 162-slug `categories.ts`
 *   allow-list, since a handful of curated slugs still fail the mapper's
 *   other checks (e.g. `water-chestnut`'s zero row spacing — see
 *   `docs/adr/0006`).
 */

import { mapOpenFarmCrop } from '../sources/openfarm/map.ts';
import { loadOpenFarmCache } from '../sources/openfarm/cache.ts';
import { OPENFARM_CACHE_PATH } from '../sources/openfarm/source.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';
import { HAND_VERIFIED_SPACING } from '../spacing/table.ts';

/**
 * Compute the id universe from explicit inputs — pure and synchronous, so
 * tests exercise it against small fixtures rather than the real ~500-record
 * combined dataset. Reuses `mapOpenFarmCrop` itself (never re-derives its
 * mapping rules) so this can't silently drift from what Stage 1.2 actually
 * ships as a `Plant`.
 */
export function buildPlantIdUniverse(
  spacingIds: readonly string[],
  openFarmRecords: readonly OpenFarmCropRaw[],
): ReadonlySet<string> {
  const ids = new Set<string>(spacingIds);
  for (const raw of openFarmRecords) {
    const outcome = mapOpenFarmCrop(raw);
    if (!outcome.skipped) {
      ids.add(outcome.plant.id);
    }
  }
  return ids;
}

/**
 * The raw OpenFarm cache, loaded once here and re-exported so
 * `openfarm-derived.ts` can reuse the same parsed-and-validated records
 * instead of reading and re-validating the 340-record cache file a second
 * time — both modules need it, and `loadOpenFarmCache` has no memoization of
 * its own.
 */
export const OPENFARM_CACHE_RECORDS: readonly OpenFarmCropRaw[] =
  loadOpenFarmCache(OPENFARM_CACHE_PATH);

/**
 * The real id universe, computed from the data this repo actually ships: the
 * 12 hand-verified spacing ids plus every OpenFarm crop the Stage 1.2 mapper
 * can turn into a `Plant` today. `curated.ts` and `openfarm-derived.ts`
 * validate every relationship's `from`/`to` against this set.
 */
export const PLANT_ID_UNIVERSE: ReadonlySet<string> = buildPlantIdUniverse(
  HAND_VERIFIED_SPACING.map((record) => record.id),
  OPENFARM_CACHE_RECORDS,
);
