/**
 * Build and emit the committed `/data` artifact (WORKPLAN.md Stage 1.5; shape
 * rationale in `docs/adr/0009-dataset-merge-and-licensing.md`).
 *
 * The artifact is **plain JSON** — the obvious default `data/README.md` already
 * sketched, and the right one for a static site: the browser loads it directly
 * with `fetch`/`import`, no WASM/SQLite runtime needed for a dataset this size.
 * It carries a small metadata header (schema version, generation date, licence,
 * a de-duplicated source roll-up) followed by the validated, id-sorted plants,
 * so a reader can see *what* they have and *under what terms* without parsing
 * every record.
 *
 * `buildArtifact` is pure (no I/O) so it is unit-testable; `writeArtifact` is the
 * thin file-system wrapper the orchestrator calls.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Plant, SourceRef } from '@garden-planner/engine';

/**
 * The dataset licence. Chosen in ADR 0009: the shipped content today is OpenFarm
 * (CC0) plus original curation (hand-verified spacing facts, companion links),
 * none of which *compels* NonCommercial — but the project deliberately holds the
 * dataset at CC BY-NC-SA per WORKPLAN.md §0.5's ratified non-commercial stance and
 * to absorb PFAF (CC BY-NC-SA) seamlessly the moment its egress block lifts,
 * avoiding a licence flip-flop. See ADR 0009's licensing section and `/NOTICE`.
 */
export const DATASET_LICENSE = 'CC-BY-NC-SA-4.0';
export const DATASET_LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

/** The current artifact schema version. Bump on a breaking shape change. */
export const ARTIFACT_SCHEMA_VERSION = 1;

/** A de-duplicated source roll-up entry for the artifact header. */
export interface ArtifactSource {
  readonly source: string;
  readonly license?: string;
}

export interface DatasetArtifact {
  readonly schemaVersion: number;
  /** ISO date the artifact was generated (date-only, to keep committed diffs small). */
  readonly generatedAt?: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly plantCount: number;
  /** Distinct sources contributing to any record, rolled up from per-record provenance. */
  readonly sources: ArtifactSource[];
  readonly plants: Plant[];
}

export interface BuildArtifactOptions {
  /** ISO date string for the header; omit to leave `generatedAt` off entirely. */
  readonly generatedAt?: string;
}

/**
 * Roll every record's provenance sources up into a distinct, sorted list of
 * (source, licence) — the honest, data-derived answer to "what is in here and
 * under what terms", rather than a hand-maintained list that can drift from what
 * actually shipped. Deliberately keyed by source + licence only (not per-URL): the
 * header is a licensing/attribution summary, and the per-record URLs stay in each
 * plant's own `provenance`.
 */
function rollUpSources(plants: readonly Plant[]): ArtifactSource[] {
  const seen = new Map<string, ArtifactSource>();
  const consider = (ref: SourceRef): void => {
    const key = `${ref.source}|${ref.license ?? ''}`;
    if (!seen.has(key)) seen.set(key, { source: ref.source, license: ref.license });
  };
  for (const plant of plants) {
    for (const ref of plant.provenance.sources) consider(ref);
    for (const refs of Object.values(plant.provenance.fields ?? {})) {
      for (const ref of refs ?? []) consider(ref);
    }
  }
  return [...seen.values()].sort((a, b) => a.source.localeCompare(b.source));
}

/** Assemble the artifact object from validated plants. Pure. */
export function buildArtifact(
  plants: readonly Plant[],
  options: BuildArtifactOptions = {},
): DatasetArtifact {
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
    license: DATASET_LICENSE,
    licenseUrl: DATASET_LICENSE_URL,
    plantCount: plants.length,
    sources: rollUpSources(plants),
    plants: [...plants],
  };
}

/** Write the artifact to disk as pretty-printed JSON with a trailing newline. */
export function writeArtifact(path: string, artifact: DatasetArtifact): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
}
