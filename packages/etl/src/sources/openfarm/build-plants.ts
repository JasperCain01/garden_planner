/**
 * Ties `map.ts`'s per-record mapping together with GBIF resolution to produce
 * finished `Plant` records — the concrete "adapter produces schema-shaped,
 * GBIF-resolved, individually-`validatePlant`-passing records" deliverable
 * for WORKPLAN.md Stage 1.2 (see `docs/adr/0006-openfarm-source-adapter.md`).
 *
 * Deliberately **not** wired into `pipeline/run.ts` or `src/index.ts`'s CLI
 * output: the generic pipeline only orchestrates name resolution and stays
 * agnostic to any one source's mapping logic (`pipeline/source.ts`), and
 * turning these `Plant`s into the merged `/data` artifact is Stage 1.5's job,
 * not this adapter's. This function exists so that capability is real and
 * tested today — see `build-plants.test.ts` — ready for Stage 1.5 to import.
 */

import type { Plant } from '@garden-planner/engine';
import type { GbifResolver } from '../../resolve/gbif-resolver.ts';
import { applyGbifResolution } from '../../resolve/apply-resolution.ts';
import { mapOpenFarmCrop, type OpenFarmSkip } from './map.ts';
import type { OpenFarmCropRaw } from './types.ts';

export interface BuildOpenFarmPlantsResult {
  /** Every record that mapped cleanly *and* resolved against GBIF. */
  readonly plants: Plant[];
  /** Every record left out, and why — local mapping failures and GBIF misses alike. */
  readonly skipped: OpenFarmSkip[];
}

/**
 * Map and resolve a batch of raw OpenFarm records. Sequential resolution
 * (not `Promise.all`) matches `GbifResolver.resolveMany`'s own reasoning: a
 * build-time tool has no reason to hammer a shared public API concurrently.
 */
export async function buildOpenFarmPlants(
  rawRecords: readonly OpenFarmCropRaw[],
  resolver: GbifResolver,
): Promise<BuildOpenFarmPlantsResult> {
  const plants: Plant[] = [];
  const skipped: OpenFarmSkip[] = [];

  for (const raw of rawRecords) {
    const mapped = mapOpenFarmCrop(raw);
    if (mapped.skipped) {
      skipped.push({ slug: mapped.slug, reason: mapped.reason });
      continue;
    }

    const outcome = await resolver.resolve(mapped.resolveName);
    if (outcome.status === 'resolved') {
      // Re-validated inside applyGbifResolution — proven, not just plausible.
      plants.push(applyGbifResolution(mapped.plant, outcome));
    } else if (outcome.status === 'unresolved') {
      skipped.push({
        slug: mapped.plant.id,
        reason: `GBIF has no confident match for "${mapped.resolveName}"`,
      });
    } else {
      skipped.push({
        slug: mapped.plant.id,
        reason: `GBIF resolution failed for "${mapped.resolveName}": ${outcome.message}`,
      });
    }
  }

  return { plants, skipped };
}
