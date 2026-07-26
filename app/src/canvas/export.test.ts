import { describe, expect, it } from 'vitest';
import { resolvePlotConditions, validatePlant, type Plant } from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { buildLegendText } from './export.ts';

function plantWith(id: string, commonName: string): Plant {
  return validatePlant({
    id,
    commonName,
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const ONION = plantWith('onion', 'Onion');
const KALE = plantWith('kale', 'Kale');

function placed(plant: Plant, x: number, y: number): PlacedPlant {
  return { id: `${plant.id}-${x}-${y}`, plant, x, y };
}

describe('buildLegendText', () => {
  it('lists placed crops one per line, in placement order', () => {
    const text = buildLegendText(
      [placed(ONION, 0, 0), placed(KALE, 50, 50), placed(ONION, 10, 10)],
      null,
    );

    const cropLines = text
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.trim());
    expect(cropLines).toEqual(['- Onion', '- Kale', '- Onion']);
  });

  it('says nothing is placed yet when the canvas is empty', () => {
    expect(buildLegendText([], null)).toMatch(/none placed/i);
  });

  it('includes the resolved location name and hardiness band', () => {
    const conditions = resolvePlotConditions({ light: 'full-sun' });

    const text = buildLegendText([], conditions);

    expect(text).toContain('United Kingdom (national default)');
    expect(text).toMatch(/Hardiness: H\d/);
    expect(text).toMatch(/Light: full sun/i);
  });

  it('includes soil texture only when known', () => {
    const withSoil = resolvePlotConditions({ light: 'full-sun', soil: { texture: 'clay' } });
    const withoutSoil = resolvePlotConditions({ light: 'full-sun' });

    expect(buildLegendText([], withSoil)).toContain('Soil: clay');
    expect(buildLegendText([], withoutSoil)).not.toContain('Soil:');
  });

  it('reports conditions as not set when they fail to resolve', () => {
    expect(buildLegendText([], null)).toMatch(/not set/i);
  });
});
