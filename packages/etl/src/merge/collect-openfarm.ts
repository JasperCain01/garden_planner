/**
 * Gather OpenFarm `Plant`s for the Stage 1.5 merge, **resiliently** — i.e. in a
 * way that survives GBIF being unreachable.
 *
 * ── Why not just call `buildOpenFarmPlants`? ──
 * Stage 1.2's `sources/openfarm/build-plants.ts#buildOpenFarmPlants` is the
 * strict, GBIF-*required* variant: it only emits a plant once GBIF confidently
 * resolves its scientific name, and **skips** every record whose resolution is
 * `unresolved` or `error`. That is the right behaviour for a run whose purpose is
 * to populate the GBIF cache. But GBIF is unreachable in this sandbox class
 * (confirmed this session: `api.gbif.org` → 403 policy denial at the egress
 * proxy) and the committed name cache is empty, so `buildOpenFarmPlants` would
 * skip **all 161** mappable records and hand the merge an empty dataset.
 *
 * The join-key policy (ADR 0009) exists precisely so a record without a `gbifId`
 * is still shippable: it degrades to the scientific-name / slug fallback. So the
 * merge needs the mappable OpenFarm plants **with `gbifId` filled when GBIF is
 * reachable and left `null` when it isn't** — never dropped merely because a name
 * couldn't be resolved. That is what this collector does.
 *
 * It reuses `mapOpenFarmCrop` (the same pure mapper `buildOpenFarmPlants` and the
 * companion id-universe use, so it can't drift) and `applyGbifResolution`, adding
 * only the leniency: a resolution failure keeps the plant with `gbifId: null`
 * rather than discarding it. A record that fails **mapping** (unknown category,
 * missing light/spacing/binomial) is still skipped with its stated reason — that
 * discipline is unchanged; only the GBIF miss is treated as non-fatal.
 */

import { applyGbifResolution } from '../resolve/apply-resolution.ts';
import type { GbifResolver } from '../resolve/gbif-resolver.ts';
import { mapOpenFarmCrop, type OpenFarmSkip } from '../sources/openfarm/map.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';
import type { Plant } from '@garden-planner/engine';

/** How a plant's `gbifId` ended up the way it did — surfaced in the merge report. */
export interface GbifResolutionTally {
  /** Records whose name GBIF confidently resolved (real `gbifId`). */
  resolved: number;
  /** Records GBIF was reached for but had no confident match (`gbifId: null`). */
  unresolved: number;
  /** Records whose resolution failed at the transport (GBIF unreachable; `gbifId: null`). */
  error: number;
}

export interface CollectOpenFarmResult {
  /** Every mappable record, `gbifId` filled where GBIF resolved it, `null` otherwise. */
  readonly plants: Plant[];
  /** Records that failed *mapping* (not resolution), each with its reason. */
  readonly skipped: OpenFarmSkip[];
  /** Where each mapped record's `gbifId` came from — a health signal for the build log. */
  readonly gbif: GbifResolutionTally;
}

/**
 * Map and (best-effort) GBIF-resolve a batch of raw OpenFarm records, keeping
 * every mappable record whether or not GBIF could place it. Sequential
 * resolution matches `buildOpenFarmPlants`' reasoning: a build-time tool has no
 * reason to hammer a shared public API concurrently.
 */
export async function collectOpenFarmPlants(
  rawRecords: readonly OpenFarmCropRaw[],
  resolver: GbifResolver,
): Promise<CollectOpenFarmResult> {
  const plants: Plant[] = [];
  const skipped: OpenFarmSkip[] = [];
  const gbif: GbifResolutionTally = { resolved: 0, unresolved: 0, error: 0 };

  for (const raw of rawRecords) {
    const mapped = mapOpenFarmCrop(raw);
    if (mapped.skipped) {
      skipped.push({ slug: mapped.slug, reason: mapped.reason });
      continue;
    }

    const outcome = await resolver.resolve(mapped.resolveName);
    if (outcome.status === 'resolved') {
      gbif.resolved++;
      // Re-validated inside applyGbifResolution — proven, not just plausible.
      plants.push(applyGbifResolution(mapped.plant, outcome));
    } else {
      // GBIF had no confident match, or the transport failed (GBIF unreachable).
      // Either way the record is still shippable with gbifId: null — the merge
      // will join it by scientific name / slug (ADR 0009). Not dropped.
      if (outcome.status === 'unresolved') gbif.unresolved++;
      else gbif.error++;
      plants.push(mapped.plant);
    }
  }

  return { plants, skipped, gbif };
}
