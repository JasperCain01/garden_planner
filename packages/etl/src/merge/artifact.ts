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
 * The dataset licence: **CC0-1.0**, a public-domain dedication — as open as a
 * dataset gets (ADR 0023, superseding ADR 0009's licensing section).
 *
 * ADR 0009 held the dataset at CC BY-NC-SA for one reason: to absorb Plants For
 * A Future (CC BY-NC-SA) without a later licence flip-flop. That ingest is no
 * longer planned (Stage 6.0 fills the data gaps by curation instead), so the
 * anticipatory restriction had nothing left to anticipate.
 *
 * What actually ships is CC0 or original curation the project owns outright:
 * the OpenFarm crops rescue is CC0-1.0 (ADR 0006 §rescue verified this and
 * corrected `DESIGN.md`'s earlier CC BY-SA guess), and everything else —
 * spacing figures, companion links, curated plants, the moisture table — is
 * either an uncopyrightable fact or this project's own work. Nothing in the
 * artifact compels a restriction, so none is imposed.
 *
 * Attribution is still recorded per record in `provenance`, and `/NOTICE`
 * still credits every source. Under CC0 that is courtesy and traceability
 * rather than a licence condition — which is the point: it stays useful to a
 * reader without binding a reuser.
 */
export const DATASET_LICENSE = 'CC0-1.0';
export const DATASET_LICENSE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';

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

/**
 * Write the artifact to disk as pretty-printed JSON with a trailing newline.
 *
 * `JSON.stringify(_, null, 2)` and Prettier disagree about short arrays —
 * Prettier keeps `["seed"]` on one line, `JSON.stringify` expands it — so the
 * raw output here does **not** satisfy `npm run format:check`. Rather than
 * reach for Prettier from inside this module (which would drag a formatter
 * into an otherwise dependency-light writer), the `build:data` script runs
 * `prettier --write` over the emitted file straight afterwards. If you call
 * `writeArtifact` from somewhere new, format the result too, or the repo goes
 * red on a check that has nothing to do with your change.
 */
export function writeArtifact(path: string, artifact: DatasetArtifact): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
}
