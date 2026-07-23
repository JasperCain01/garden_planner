/**
 * Public surface of the Stage 1.5 dataset merge, validation gate, and artifact
 * emitter (WORKPLAN.md Stage 1.5 ⭐ keystone). See
 * `docs/adr/0009-dataset-merge-and-licensing.md` for the join-key policy,
 * conflict-resolution rules, and licensing decision, and `data/README.md` for how
 * the emitted artifact is consumed.
 *
 * The CLI entry point that actually writes `/data` is `../build-data.ts`
 * (run via `npm run build:data -w @garden-planner/etl`); this module exports the
 * pure, testable building blocks it composes.
 */

export { SLUG_ALIASES } from './aliases.ts';

export {
  buildPlantIndex,
  canonicalPlantId,
  findSpacingTarget,
  normalizeScientificName,
  unifyPlantsByIdentity,
  type IdentityGroup,
  type PlantIndex,
  type SpacingJoin,
  type SpacingJoinVia,
} from './join.ts';

export {
  collectOpenFarmPlants,
  type CollectOpenFarmResult,
  type GbifResolutionTally,
} from './collect-openfarm.ts';

export {
  mergeDataset,
  type DroppedLink,
  type MergeInputs,
  type MergeReport,
  type MergeResult,
  type SpacingAttachment,
} from './merge.ts';

export {
  assertValidDataset,
  validateDataset,
  type DatasetIssue,
  type DatasetValidationReport,
} from './validate.ts';

export {
  ARTIFACT_SCHEMA_VERSION,
  DATASET_LICENSE,
  DATASET_LICENSE_URL,
  buildArtifact,
  writeArtifact,
  type ArtifactSource,
  type BuildArtifactOptions,
  type DatasetArtifact,
} from './artifact.ts';

export {
  buildDataset,
  type BuildDatasetInputs,
  type BuildDatasetResult,
  type BuildLogger,
} from './build-dataset.ts';
