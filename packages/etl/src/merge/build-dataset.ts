/**
 * Orchestrates the Stage 1.5 dataset build end to end: gather → merge → validate
 * → assemble artifact. This is the seam between the pure pieces (`collect-openfarm`,
 * `merge`, `validate`, `artifact`) and the side-effecting CLI (`../build-data.ts`,
 * which reads caches, chooses a resolver, and writes the file).
 *
 * Kept free of file-system and network access itself — it takes the raw records,
 * a resolver, and the curated inputs as arguments — so the whole build can be
 * exercised in a test with fixtures and a stub resolver (see `build-dataset.test.ts`),
 * never touching the real 340-record cache or the network.
 */

import type { Plant } from '@garden-planner/engine';
import type { GbifResolver } from '../resolve/gbif-resolver.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';
import type { SpacingRecord } from '../spacing/schema.ts';
import { HAND_VERIFIED_SPACING } from '../spacing/table.ts';
import { toPlantLinksById, type PlantLinksByKind } from '../companions/relationships.ts';
import { collectOpenFarmPlants, type CollectOpenFarmResult } from './collect-openfarm.ts';
import { mergeDataset, type MergeReport } from './merge.ts';
import { assertValidDataset } from './validate.ts';
import { buildArtifact, type DatasetArtifact } from './artifact.ts';

/** Minimal logger so the CLI can print progress and tests can stay quiet. */
export type BuildLogger = (message: string) => void;

export interface BuildDatasetInputs {
  /** Raw OpenFarm records (the committed cache, or a fixture in tests). */
  readonly rawOpenFarm: readonly OpenFarmCropRaw[];
  /** GBIF resolver — real (network) or offline/stub. Its cache state decides gbifId fill. */
  readonly resolver: GbifResolver;
  /** Spacing rows; defaults to the hand-verified table. */
  readonly spacingRecords?: readonly SpacingRecord[];
  /** Companion links by pre-merge id; defaults to the full relationship set. */
  readonly linksById?: ReadonlyMap<string, PlantLinksByKind>;
  /** ISO date for the artifact header; omit to leave it off. */
  readonly generatedAt?: string;
  /** Progress logger; defaults to a no-op so tests are silent unless they opt in. */
  readonly log?: BuildLogger;
}

export interface BuildDatasetResult {
  readonly artifact: DatasetArtifact;
  readonly plants: Plant[];
  readonly mergeReport: MergeReport;
  readonly collect: CollectOpenFarmResult;
}

/**
 * Build the dataset. Throws (via the validation gate) if any merged record is
 * malformed, dangling-referenced, or out of sanity bounds — the hard-fail
 * behaviour Stage 1.5 requires. On success, returns the artifact plus the merge
 * and collection reports for the caller to log.
 */
export async function buildDataset(inputs: BuildDatasetInputs): Promise<BuildDatasetResult> {
  const log = inputs.log ?? (() => {});
  const spacingRecords = inputs.spacingRecords ?? HAND_VERIFIED_SPACING;
  const linksById = inputs.linksById ?? toPlantLinksById();

  log('Stage 1.5 dataset build — gathering OpenFarm plants…');
  const collect = await collectOpenFarmPlants(inputs.rawOpenFarm, inputs.resolver);
  log(
    `  OpenFarm: ${collect.plants.length} mappable plant(s), ${collect.skipped.length} unmappable; ` +
      `gbif resolved=${collect.gbif.resolved} unresolved=${collect.gbif.unresolved} error=${collect.gbif.error}.`,
  );

  log('Merging spacing and companion/antagonist data…');
  const { plants: merged, report } = mergeDataset({
    openFarmPlants: collect.plants,
    spacingRecords,
    linksById,
  });
  log(
    `  Spacing attached to ${report.spacingAttached.length} plant(s); ` +
      `${report.spacingUnattached.length} spacing row(s) had no home.`,
  );
  for (const u of report.spacingUnattached)
    log(`    · spacing "${u.spacingId}" unattached: ${u.reason}`);
  if (report.plantsDroppedForSanity.length > 0) {
    log(`  Dropped ${report.plantsDroppedForSanity.length} plant(s) for absurd spacing:`);
    for (const d of report.plantsDroppedForSanity) {
      log(`    · ${d.plantId}: ${d.issues.join('; ')}`);
    }
  }
  log(
    `  Companion/antagonist links: kept ${report.companionLinksKept}, ` +
      `remapped ${report.companionLinksRemapped}, dropped ${report.companionLinksDropped.length}.`,
  );
  for (const d of report.companionLinksDropped) {
    log(`    · dropped ${d.kind} ${d.ownerId} → ${d.targetId}: ${d.reason}`);
  }

  log('Running the hard-fail validation gate (schema + referential integrity + sanity)…');
  const validated = assertValidDataset(merged);
  log(`  ✓ ${validated.length} plant(s) passed the gate.`);

  const artifact = buildArtifact(validated, { generatedAt: inputs.generatedAt });
  return { artifact, plants: validated, mergeReport: report, collect };
}
