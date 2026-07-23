/**
 * The OpenFarm `SourceAdapter` (WORKPLAN.md Stage 1.2 — the first source
 * adapter, establishing the pattern PFAF/Permapeople follow next). See
 * `docs/adr/0006-openfarm-source-adapter.md` for why OpenFarm, and why this
 * is a community rescue dump rather than an official one.
 *
 * `fetchRecords()` reads the committed cache (`cache/openfarm-crops.json`,
 * see `cache.ts`) — never the network — and returns one `SourceRecord` per
 * record this adapter can actually turn into a `Plant` (per `map.ts`'s
 * checks). Records it can't map (unknown category, missing spacing/light/
 * binomial data) are left out here rather than handed to the pipeline's name
 * resolver for a GBIF lookup that could never produce a shippable record —
 * see `createOpenFarmSource`'s returned `getSkipped()` for inspecting what
 * got left out and why.
 */

import { fileURLToPath } from 'node:url';
import type { SourceAdapter, SourceRecord } from '../../pipeline/source.ts';
import { loadOpenFarmCache } from './cache.ts';
import { mapOpenFarmCrop, type OpenFarmSkip } from './map.ts';
import type { OpenFarmCropRaw } from './types.ts';

/** The committed raw-dump cache this adapter reads by default (see `cache.ts`). */
export const OPENFARM_CACHE_PATH = fileURLToPath(
  new URL('../../../cache/openfarm-crops.json', import.meta.url),
);

export interface CreateOpenFarmSourceOptions {
  /**
   * Supplies the raw records. Defaults to reading the committed cache file
   * from disk. Tests inject a small in-memory fixture here instead — the
   * same injection shape as the GBIF resolver's `transport` option — so
   * nothing in this package's test suite depends on the real 340-record file.
   */
  reader?: () => readonly OpenFarmCropRaw[];
}

/**
 * Build the OpenFarm `SourceAdapter`. Returns a `SourceAdapter` extended with
 * `getSkipped()` — the records `fetchRecords()` most recently left out, and
 * why. Exposed as an extra method (not part of the `SourceAdapter` contract
 * itself, which has no room for a "records we chose not to return" channel)
 * so callers can log/diagnose without the pipeline needing to know about it.
 * `getSkipped()` is reset on every `fetchRecords()` call.
 */
export function createOpenFarmSource(options: CreateOpenFarmSourceOptions = {}): SourceAdapter & {
  /** Why each left-out record was left out, from the most recent `fetchRecords()` call. */
  getSkipped(): readonly OpenFarmSkip[];
} {
  const reader = options.reader ?? (() => loadOpenFarmCache(OPENFARM_CACHE_PATH));
  let lastSkipped: OpenFarmSkip[] = [];

  return {
    id: 'openfarm',
    label: 'OpenFarm crops rescue (community dump)',
    async fetchRecords(): Promise<SourceRecord[]> {
      const rawRecords = reader();
      const records: SourceRecord[] = [];
      const skipped: OpenFarmSkip[] = [];

      for (const raw of rawRecords) {
        const outcome = mapOpenFarmCrop(raw);
        if (outcome.skipped) {
          skipped.push({ slug: outcome.slug, reason: outcome.reason });
        } else {
          records.push({ name: outcome.resolveName, raw });
        }
      }

      lastSkipped = skipped;
      return records;
    },
    getSkipped: () => lastSkipped,
  };
}

/** The adapter registered by default in `src/index.ts`. */
export const openfarmSource = createOpenFarmSource();
