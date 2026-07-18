/**
 * A demo/placeholder `SourceAdapter` (WORKPLAN.md Stage 1.1), used until
 * Stage 1.2 registers real ones (PFAF, the OpenFarm dump, Permapeople).
 *
 * Two reasons this exists as an actual `SourceAdapter` rather than a special
 * case inside the pipeline orchestrator: it makes `npm run start -w
 * @garden-planner/etl` exercise the real resolve-and-cache step today instead
 * of being a no-op while waiting for 1.2, and it gives the `SourceAdapter`
 * interface (`source.ts`) a real implementation to prove it out before any
 * "real" adapter exists. `pipeline/run.ts` stays agnostic to demo vs. real
 * sources — this module (and the choice to register it) belongs to the call
 * site in `src/index.ts`, not to the orchestrator itself.
 */

import type { SourceAdapter, SourceRecord } from './source.ts';

/** A small starter list of common edible names — the classic examples from `DESIGN.md`. */
export const STARTER_NAMES: readonly string[] = ['onion', 'lettuce', 'carrot', 'potato', 'tomato'];

export const starterNamesSource: SourceAdapter = {
  id: 'starter-names',
  label: 'Stage 1.1 starter demo list',
  async fetchRecords(): Promise<SourceRecord[]> {
    return STARTER_NAMES.map((name) => ({ name, raw: null }));
  },
};
