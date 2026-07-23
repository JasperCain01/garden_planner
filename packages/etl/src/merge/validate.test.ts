import { describe, expect, it } from 'vitest';
import { validatePlant, type Plant } from '@garden-planner/engine';
import { assertValidDataset, validateDataset } from './validate.ts';

function plant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 8, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'OpenFarm', license: 'CC0-1.0' }] },
    ...overrides,
  });
}

describe('validateDataset — clean data', () => {
  it('passes a well-formed dataset with resolvable links', () => {
    const carrot = plant({ id: 'carrot', scientificName: 'Daucus carota' });
    const onion = plant({ companions: [{ plantId: 'carrot', evidence: 'traditional' }] });
    const report = validateDataset([onion, carrot]);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(assertValidDataset([onion, carrot])).toHaveLength(2);
  });
});

describe('validateDataset — the hard-fail gate catches every layer', () => {
  it('fails LOUDLY on an intentionally-broken (schema-invalid) record', () => {
    // WORKPLAN.md's Stage 1.5 verification bar: feed the gate a broken record and
    // assert it fails. Here `light` is not a valid enum value and `spreadCm` typo'd.
    const broken = {
      id: 'mystery',
      commonName: 'Mystery',
      scientificName: 'Ignotum ignotum',
      gbifId: null,
      category: 'vegetable',
      light: 'moonlight',
      spacing: { row: { inRowCm: 8, betweenRowCm: 30 } },
      provenance: { sources: [{ source: 'test' }] },
    };
    const report = validateDataset([broken]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.kind === 'schema' && i.plantId === 'mystery')).toBe(true);
    // The throwing form must actually throw, and name the problem.
    expect(() => assertValidDataset([broken])).toThrow(/Dataset validation failed/);
  });

  it('fails on a dangling companion link (referential integrity)', () => {
    const onion = plant({ companions: [{ plantId: 'ghost', evidence: 'traditional' }] });
    const report = validateDataset([onion]);
    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ kind: 'referential-integrity', plantId: 'onion' }),
    );
    expect(() => assertValidDataset([onion])).toThrow(/references unknown plant "ghost"/);
  });

  it('fails on a self-referential link', () => {
    const onion = plant({ antagonists: [{ plantId: 'onion', evidence: 'traditional' }] });
    const report = validateDataset([onion]);
    expect(report.issues.some((i) => i.kind === 'referential-integrity')).toBe(true);
  });

  it('fails on absurd spacing (sanity bounds)', () => {
    const absurd = plant({
      id: 'huge',
      scientificName: 'X y',
      spacing: { row: { inRowCm: 5000, betweenRowCm: 6000 } },
    });
    const report = validateDataset([absurd]);
    expect(report.issues.some((i) => i.kind === 'sanity')).toBe(true);
  });

  it('fails on a duplicate plant id (structural)', () => {
    const report = validateDataset([plant(), plant()]);
    expect(report.issues.some((i) => i.kind === 'structural')).toBe(true);
  });

  it('collects ALL issues, not just the first', () => {
    const onion = plant({ companions: [{ plantId: 'ghost', evidence: 'traditional' }] });
    const report = validateDataset([onion, { id: 'bad', not: 'a plant' }]);
    expect(report.issues.length).toBeGreaterThanOrEqual(2);
  });
});
