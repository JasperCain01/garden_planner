/**
 * The **hard-fail validation gate** for the shipped dataset (WORKPLAN.md §1.1,
 * Stage 1.5; see `docs/adr/0009-dataset-merge-and-licensing.md`). This is the
 * promise the whole pipeline has been deferring to Stage 1.5: **no malformed or
 * dangling-referenced record ever ships.**
 *
 * It enforces the three layers §1.1 names, over the *whole merged set* (not one
 * record at a time — two of the three checks are cross-record and can only run
 * here, where the entire dataset is visible):
 *
 *   1. **Schema** — every record must pass `@garden-planner/engine`'s
 *      `validatePlant` (strict zod: an unknown/typo'd key is a failure, not a
 *      silently dropped fact).
 *   2. **Referential integrity** — every `companions`/`antagonists` link must
 *      point at a plant id that actually exists in the final dataset, and no
 *      plant may link to itself. This is the check ADR 0008 / the schema's own
 *      `PlantLink` doc comment explicitly deferred to this gate.
 *   3. **Sanity bounds** — every plant's spacing must clear the dataset-level
 *      plausibility bounds (`sanity.ts#datasetSpacingIssues`: no absurd distances
 *      or densities; tree-tolerant, so it fits the full merged set rather than
 *      just the 12-veg curation table). Plus structural sanity: unique ids, and a
 *      non-empty dataset (an empty artifact is a build failure, not valid data).
 *
 * The gate **collects every issue and then fails once**, listing them all, so a
 * contributor sees the full picture rather than fixing one error only to hit the
 * next. `assertValidDataset` is the throwing form the build calls; `validateDataset`
 * is the non-throwing form tests and reports use.
 */

import { safeValidatePlant, type Plant } from '@garden-planner/engine';
import { datasetSpacingIssues } from './sanity.ts';

/** A single validation problem, tagged by which of the three layers caught it. */
export interface DatasetIssue {
  readonly kind: 'schema' | 'referential-integrity' | 'sanity' | 'structural';
  /** The offending plant's id, when known (a schema failure may have no usable id). */
  readonly plantId?: string;
  readonly message: string;
}

export interface DatasetValidationReport {
  readonly ok: boolean;
  readonly issues: DatasetIssue[];
  /** The records that passed schema validation, typed as `Plant`. */
  readonly plants: Plant[];
}

/**
 * Best-effort id for error messages when a record fails *schema* validation (so
 * we can't trust it as a `Plant`). Falls back to a positional label.
 */
function looseId(record: unknown, index: number): string {
  if (typeof record === 'object' && record !== null && 'id' in record) {
    const id = (record as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return `#${index}`;
}

/**
 * Validate a whole candidate dataset against all three layers, collecting every
 * issue. Never throws — returns a report. The build turns a failing report into a
 * loud thrown error via {@link assertValidDataset}.
 */
export function validateDataset(records: readonly unknown[]): DatasetValidationReport {
  const issues: DatasetIssue[] = [];
  const plants: Plant[] = [];

  // --- Layer 1: schema, per record ---
  records.forEach((record, index) => {
    const result = safeValidatePlant(record);
    if (result.success) {
      plants.push(result.data);
    } else {
      issues.push({
        kind: 'schema',
        plantId: looseId(record, index),
        message: result.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; '),
      });
    }
  });

  // --- Structural: non-empty, unique ids ---
  // Fires whenever no record validated — whether the input was empty or every
  // record failed schema. Either way the build has no shippable plant.
  if (plants.length === 0) {
    issues.push({
      kind: 'structural',
      message: 'dataset is empty — a valid build must ship at least one plant',
    });
  }
  const idCounts = new Map<string, number>();
  for (const plant of plants) idCounts.set(plant.id, (idCounts.get(plant.id) ?? 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) {
      issues.push({
        kind: 'structural',
        plantId: id,
        message: `duplicate plant id "${id}" appears ${count} times`,
      });
    }
  }

  // Referential integrity resolves against the ids that actually validated.
  const knownIds = new Set(plants.map((p) => p.id));

  for (const plant of plants) {
    // --- Layer 2: referential integrity ---
    for (const [kind, links] of [
      ['companions', plant.companions ?? []],
      ['antagonists', plant.antagonists ?? []],
    ] as const) {
      for (const link of links) {
        if (link.plantId === plant.id) {
          issues.push({
            kind: 'referential-integrity',
            plantId: plant.id,
            message: `${kind} link points at itself ("${plant.id}")`,
          });
        } else if (!knownIds.has(link.plantId)) {
          issues.push({
            kind: 'referential-integrity',
            plantId: plant.id,
            message: `${kind} link references unknown plant "${link.plantId}"`,
          });
        }
      }
    }

    // --- Layer 3: sanity bounds ---
    // Dataset-level absurdity bounds (tree-tolerant, no transposition heuristic —
    // see `sanity.ts`), not the stricter Stage 1.3 curation check.
    for (const problem of datasetSpacingIssues(plant.spacing)) {
      issues.push({ kind: 'sanity', plantId: plant.id, message: problem });
    }
  }

  return { ok: issues.length === 0, issues, plants };
}

/**
 * The throwing gate the build calls. Returns the validated `Plant[]` on success;
 * on any issue, throws an `Error` listing **every** problem found. This is the
 * "fails loudly" behaviour WORKPLAN.md's Stage 1.5 verification bar requires.
 */
export function assertValidDataset(records: readonly unknown[]): Plant[] {
  const report = validateDataset(records);
  if (!report.ok) {
    const lines = report.issues.map(
      (issue) => `  [${issue.kind}] ${issue.plantId ? `${issue.plantId}: ` : ''}${issue.message}`,
    );
    throw new Error(
      `Dataset validation failed with ${report.issues.length} issue(s):\n${lines.join('\n')}`,
    );
  }
  return report.plants;
}
