import { describe, expect, it } from 'vitest';
import { validatePlant, type Plant } from '@garden-planner/engine';
import { ARTIFACT_SCHEMA_VERSION, DATASET_LICENSE, buildArtifact } from './artifact.ts';

function plant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 8, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'OpenFarm', license: 'CC0-1.0', url: 'https://a.test/1' }] },
    ...overrides,
  });
}

describe('buildArtifact', () => {
  it('assembles the header and plants', () => {
    const artifact = buildArtifact([plant()], { generatedAt: '2026-07-23' });
    expect(artifact).toMatchObject({
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      license: DATASET_LICENSE,
      plantCount: 1,
      generatedAt: '2026-07-23',
    });
    expect(artifact.plants).toHaveLength(1);
  });

  it('omits generatedAt when not provided (deterministic committed diffs)', () => {
    const artifact = buildArtifact([plant()]);
    expect(artifact.generatedAt).toBeUndefined();
  });

  it('rolls sources up by (source, licence), de-duplicating per-URL entries', () => {
    const artifact = buildArtifact([
      plant({
        provenance: {
          sources: [{ source: 'OpenFarm', license: 'CC0-1.0', url: 'https://a.test/1' }],
        },
      }),
      plant({
        id: 'carrot',
        scientificName: 'Daucus carota',
        provenance: {
          sources: [{ source: 'OpenFarm', license: 'CC0-1.0', url: 'https://a.test/2' }],
        },
      }),
    ]);
    // Two different OpenFarm URLs collapse to one header entry.
    expect(artifact.sources).toEqual([{ source: 'OpenFarm', license: 'CC0-1.0' }]);
  });

  it('includes per-field provenance sources in the roll-up', () => {
    const artifact = buildArtifact([
      plant({
        provenance: {
          sources: [{ source: 'OpenFarm', license: 'CC0-1.0' }],
          fields: { spacing: [{ source: 'RHS' }] },
        },
      }),
    ]);
    expect(artifact.sources.map((s) => s.source)).toContain('RHS');
  });
});
