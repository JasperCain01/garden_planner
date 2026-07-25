/**
 * The dataset-loading layer for the **shipped** half of the runtime plant list
 * (Workplan Stage 3.1; brief: `docs/stage-3.1-brief.md`).
 *
 * `data/plants.json` is a build-time artifact of `packages/etl` (Stage 1.5):
 * already merged, already schema-valid, already committed. Vite bundles it as
 * an ordinary JSON import, so "load" here is just resolving that import — no
 * fetch, no loading state, no network. "Validate" is the part worth keeping:
 * this module re-runs every record through the engine's own `safeValidatePlant`
 * before anything else in the app sees it, so a hand-edited or corrupted
 * artifact fails loudly at startup (mirroring the ETL's own hard-fail gate,
 * ADR 0009) rather than silently misbehaving three components deep.
 *
 * This is deliberately the *only* place that reaches into the raw JSON shape.
 * Every other module — the state layer, routes, and later stages — consumes
 * {@link SHIPPED_PLANTS}, a plain `Plant[]`.
 */

import { safeValidatePlant, type Plant } from '@garden-planner/engine';
// The dataset artifact lives at the repo root (`/data`), outside this workspace,
// because it is a build output shared by anything that might load it — today
// just `app`, but not modelled as `app`-owned. `resolveJsonModule` (set in
// `tsconfig.base.json`) lets TypeScript see through the import; Vite bundles a
// JSON import like any other module, so this is a build-time asset with no
// runtime fetch involved.
import rawDataset from '../../../data/plants.json';

/**
 * The shape of `data/plants.json` we actually read. The artifact carries a
 * metadata header too (`schemaVersion`, `sources`, ...; see `data/README.md`),
 * but nothing in the app needs it, so only `plants` is modelled here rather
 * than duplicating `packages/etl`'s full artifact schema for a file this
 * module doesn't own.
 */
interface PlantsArtifact {
  readonly plants: readonly unknown[];
}

/**
 * Validate every record in the raw artifact against the canonical `Plant`
 * schema, throwing one aggregated, readable error if any record fails.
 *
 * Failing hard (rather than dropping bad records and continuing) matches
 * `DESIGN.md`'s "no malformed data ever ships" promise: if this ever fires, the
 * dataset artifact itself is broken and every later stage would be building on
 * sand, so the app should refuse to start rather than run with a silently
 * incomplete plant list.
 */
function loadShippedPlants(): Plant[] {
  const { plants } = rawDataset as PlantsArtifact;
  const validated: Plant[] = [];
  const failures: string[] = [];

  plants.forEach((record, index) => {
    const result = safeValidatePlant(record);
    if (result.success) {
      validated.push(result.data);
    } else {
      const id = (record as { id?: unknown })?.id;
      const label = typeof id === 'string' ? id : `index ${index}`;
      failures.push(`  - ${label}: ${result.error.message}`);
    }
  });

  if (failures.length > 0) {
    throw new Error(
      `data/plants.json contains ${failures.length} record(s) that fail Plant validation:\n${failures.join('\n')}`,
    );
  }

  return validated;
}

/**
 * The shipped dataset, loaded and validated once at module load. Never
 * mutated — the session-scoped overlay of user-defined crops lives separately
 * in `state/user-plants-store.ts`, and the two are only ever concatenated for
 * reading (`state/use-plant-list.ts`), never merged back into this array.
 */
export const SHIPPED_PLANTS: readonly Plant[] = loadShippedPlants();
