import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PLANT_ID_UNIVERSE } from '../companions/plant-id-universe.ts';
import { EXCLUDED_CROPS } from './table.ts';
import { EXCLUSION_BASES, validateExclusionTable } from './schema.ts';

/**
 * The exclusion list's own gate.
 *
 * Two of these tests carry the weight, and they pull in opposite directions on
 * purpose:
 *
 * - **Every excluded id must be a crop that would otherwise ship.** This slice
 *   joins on the exact plant id and nothing else, so a typo or a stale row
 *   excludes nothing at all and the list quietly stops meaning what it says.
 *   Checking against the *pre-merge* id universe (`PLANT_ID_UNIVERSE`, the
 *   spacing ids plus everything the OpenFarm mapper can turn into a `Plant`) is
 *   the only place this can be checked — by the time `data/plants.json` exists
 *   the excluded records are gone from it by design.
 * - **No excluded id may appear in the shipped artifact.** The other direction:
 *   proof the list actually reached the build, not just the source tree.
 */

const DATASET_PATH = fileURLToPath(new URL('../../../../data/plants.json', import.meta.url));

interface DatasetArtifact {
  readonly plants: readonly { readonly id: string }[];
}

const SHIPPED_IDS = new Set(
  (JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as DatasetArtifact).plants.map(
    (plant) => plant.id,
  ),
);

describe('the UK-outdoor exclusion list', () => {
  it('validates as a whole: every row parses and no crop is listed twice', () => {
    expect(() => validateExclusionTable(EXCLUDED_CROPS)).not.toThrow();
  });

  it('names only crops that would otherwise ship — a typo fails here, not silently', () => {
    const unknown = EXCLUDED_CROPS.filter((row) => !PLANT_ID_UNIVERSE.has(row.id)).map(
      (row) => row.id,
    );
    expect(unknown).toEqual([]);
  });

  it('actually keeps them out of the shipped dataset', () => {
    const leaked = EXCLUDED_CROPS.filter((row) => SHIPPED_IDS.has(row.id)).map((row) => row.id);
    expect(leaked).toEqual([]);
  });

  it('prunes a real slice of the catalogue without gutting it', () => {
    // Pinned deliberately: 24 is the number the stated test (see `table.ts`)
    // actually produces, not the "roughly 32" the workplan estimated before
    // anyone enumerated it. If this changes, the module doc's argument about
    // which marginal crops are kept should change with it.
    expect(EXCLUDED_CROPS).toHaveLength(24);
    expect(EXCLUDED_CROPS.filter((row) => row.basis === 'too-tender')).toHaveLength(12);
    expect(EXCLUDED_CROPS.filter((row) => row.basis === 'wont-ripen')).toHaveLength(12);
  });

  it('uses only the two documented grounds, and gives every row a real reason', () => {
    for (const row of EXCLUDED_CROPS) {
      expect(EXCLUSION_BASES).toContain(row.basis);
      // Not merely non-empty: "tropical" tells a reviewer nothing they could
      // disagree with, and disagreement is the point of writing it down.
      expect(row.note.length).toBeGreaterThan(40);
      expect(row.commonName.length).toBeGreaterThan(0);
    }
  });

  it('leaves the marginal-but-real British crops alone', () => {
    // The keeps argued in `table.ts`'s module doc, pinned so a later "tidy-up"
    // pass has to argue with the reasoning rather than quietly widen the list.
    const excludedIds = new Set(EXCLUDED_CROPS.map((row) => row.id));
    for (const kept of [
      'eggplant',
      'habanero-pepper',
      'sweet-potato',
      'soybean',
      'cape-gooseberry',
      'tomatillo',
      'thai-basil',
      'stevia',
      'saffron',
      'licorice',
      'myoga-ginger',
    ]) {
      expect(excludedIds.has(kept)).toBe(false);
      expect(SHIPPED_IDS.has(kept)).toBe(true);
    }
  });
});
