import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SoilSchema } from '@garden-planner/engine';
import { CURATED_MOISTURE } from './table.ts';
import { MoistureRecordSchema, validateMoistureTable } from './schema.ts';

/**
 * The curated moisture table's own gate.
 *
 * Two of these tests matter more than the rest and are worth naming:
 *
 * - **Every id must resolve to a shipped crop.** This slice joins on the exact
 *   plant id and nothing else, so a typo enriches nothing and the merge would
 *   only report it in a log line nobody reads. Asserting it here turns a silent
 *   no-op into a failing test.
 * - **Every value must satisfy the engine's own `SoilSchema`.** The table is
 *   only useful if what it produces is a valid `Plant.soil` block, so it is
 *   checked against the engine's schema rather than against a restatement of
 *   it — the same "reuse, don't redefine" rule the spacing table follows.
 */

const DATASET_PATH = fileURLToPath(new URL('../../../../data/plants.json', import.meta.url));

interface DatasetArtifact {
  readonly plants: readonly { readonly id: string; readonly commonName: string }[];
}

const SHIPPED = (JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as DatasetArtifact).plants;
const SHIPPED_IDS = new Set(SHIPPED.map((plant) => plant.id));

describe('the curated moisture table', () => {
  it('validates as a whole: every row parses and no crop is listed twice', () => {
    expect(() => validateMoistureTable(CURATED_MOISTURE)).not.toThrow();
  });

  it('covers a useful slice of the catalogue without pretending to cover it all', () => {
    // Sized deliberately: the British garden/allotment core, not the tropicals
    // or the cultivar padding. If this drifts far from ~60 something has
    // changed about the table's scope and the module doc should change too.
    expect(CURATED_MOISTURE.length).toBeGreaterThanOrEqual(50);
    expect(CURATED_MOISTURE.length).toBeLessThan(SHIPPED.length);
  });

  it('names only crops that actually ship — a typo fails here, not silently', () => {
    const unknown = CURATED_MOISTURE.filter((row) => !SHIPPED_IDS.has(row.id)).map((row) => row.id);
    expect(unknown).toEqual([]);
  });

  it('produces values the engine accepts as a real `Plant.soil` block', () => {
    for (const row of CURATED_MOISTURE) {
      expect(() => SoilSchema.parse({ moisture: row.moisture })).not.toThrow();
    }
  });

  it('gives every row a reason, since that is what stands in for citations here', () => {
    for (const row of CURATED_MOISTURE) {
      // Not just non-empty — a bare "moist" tells a reviewer nothing.
      expect(row.note.length).toBeGreaterThan(20);
    }
  });

  it('actually discriminates: the point is a second axis, not a constant', () => {
    const distinct = new Set(CURATED_MOISTURE.map((row) => row.moisture.join('+')));
    // A table that said 'moist' for everything would pass every other test here
    // and be worthless — it would rank crops identically, which is the failure
    // mode `light` already has (148 of 162 crops are full-sun).
    expect(distinct.size).toBeGreaterThanOrEqual(3);
    const drySide = CURATED_MOISTURE.filter((row) => row.moisture.includes('dry'));
    const wetSide = CURATED_MOISTURE.filter((row) => row.moisture.includes('wet'));
    expect(drySide.length).toBeGreaterThanOrEqual(5);
    expect(wetSide.length).toBeGreaterThanOrEqual(3);
  });

  it('holds the judgements the whole exercise was for', () => {
    const find = (id: string) => CURATED_MOISTURE.find((row) => row.id === id);
    // The question that prompted this table: would peas suffer in dry ground?
    expect(find('pea')?.moisture).toEqual(['moist']);
    // …and the crop it was being compared against.
    expect(find('potato')?.moisture).toEqual(['moist']);
    // The emphatic ends of the range, which are what make the axis useful.
    expect(find('rosemary')?.moisture).toEqual(['dry']);
    expect(find('watercress')?.moisture).toEqual(['wet']);
    expect(find('carrot')?.moisture).toEqual(['dry', 'moist']);
  });
});

describe('MoistureRecordSchema', () => {
  it('rejects an empty moisture list — "no opinion" means omitting the row', () => {
    expect(() =>
      MoistureRecordSchema.parse({ id: 'pea', moisture: [], note: 'a sufficiently long note' }),
    ).toThrow();
  });

  it('rejects a moisture value outside the engine vocabulary', () => {
    expect(() =>
      MoistureRecordSchema.parse({ id: 'pea', moisture: ['damp'], note: 'a long enough note' }),
    ).toThrow();
  });

  it('rejects a row with no reason', () => {
    expect(() => MoistureRecordSchema.parse({ id: 'pea', moisture: ['moist'] })).toThrow();
    expect(() =>
      MoistureRecordSchema.parse({ id: 'pea', moisture: ['moist'], note: '' }),
    ).toThrow();
  });

  it('rejects a stray key rather than dropping it', () => {
    expect(() =>
      MoistureRecordSchema.parse({
        id: 'pea',
        moisture: ['moist'],
        note: 'a sufficiently long note',
        texture: ['loam'],
      }),
    ).toThrow();
  });

  it('rejects a duplicate crop, which would make the merge order-dependent', () => {
    const row = { id: 'pea', moisture: ['moist'], note: 'a sufficiently long note' };
    expect(() => validateMoistureTable([row, row])).toThrow(/more than once/);
  });
});
