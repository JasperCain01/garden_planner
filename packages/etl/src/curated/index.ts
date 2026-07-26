/**
 * Public surface of the maintainer-curated full-plant input (Workplan
 * Stage 1.7 ⭐). See `docs/adr/0021-curated-plant-input.md` for the design,
 * and `packages/etl/README.md`'s "Maintainer-curated plants" section for how
 * to read and extend it. Not wired into the pipeline run (this data has no
 * `SourceAdapter` — there is no external source to fetch); Stage 1.5 imports
 * {@link CURATED_PLANTS} directly as the merge's fourth input.
 */

export { CURATED_PLANTS } from './plants.ts';
