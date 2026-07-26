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

/** The `- Crop` rows of the legend, trimmed — the "key" part it exists to produce. */
function cropLinesOf(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.trim());
}

describe('buildLegendText', () => {
  it('lists one line per distinct crop, in first-placed order, with a count', () => {
    // A key, not a placement log: two onions are one row saying so. Onion is
    // listed first because it was placed first, even though the second onion
    // came after the kale.
    const text = buildLegendText(
      [placed(ONION, 0, 0), placed(KALE, 50, 50), placed(ONION, 10, 10)],
      null,
    );

    expect(cropLinesOf(text)).toEqual(['- Onion × 2', '- Kale']);
  });

  it('omits the count for a crop placed once, so the common case reads as a plain name', () => {
    expect(cropLinesOf(buildLegendText([placed(KALE, 0, 0)], null))).toEqual(['- Kale']);
  });

  it('stays a fixed number of lines however many of one crop are placed', () => {
    // The property that matters: `compositeExportCanvas` sizes the legend
    // panel (and so the exported PNG) from the line count, so a big bed must
    // not produce a legend hundreds of rows tall.
    const oneOnion = buildLegendText([placed(ONION, 0, 0)], null);
    const sixtyOnions = buildLegendText(
      Array.from({ length: 60 }, (_unused, index) => placed(ONION, index, 0)),
      null,
    );

    expect(cropLinesOf(sixtyOnions)).toEqual(['- Onion × 60']);
    expect(sixtyOnions.split('\n')).toHaveLength(oneOnion.split('\n').length);
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
