import { describe, it, expect } from 'vitest';
import {
  validatePlant,
  type Plant,
  type Hardiness,
  type Seasons,
  type PlantLink,
} from '../schema/plant';
import { createUserPlant } from '../schema/user-plant';
import { resolveClimate } from '../climate/resolve';
import type { ClimateProfile } from '../climate/schema';
import type { PlotConditions } from '../suitability/conditions';
import type { CropPlacement } from './model';
import { evaluatePlot } from './evaluate';

/** A fully-controlled fixture plant: every optional field is explicit, nothing is left to chance. */
function fixturePlant(options: {
  id: string;
  light?: Plant['light'];
  spacing?: Plant['spacing'];
  hardiness?: Hardiness;
  seasons?: Seasons;
  companions?: PlantLink[];
  antagonists?: PlantLink[];
}): Plant {
  return validatePlant({
    id: options.id,
    commonName: options.id,
    scientificName: `${options.id} scientificus`,
    gbifId: null,
    category: 'vegetable',
    light: options.light ?? 'full-shade',
    spacing: options.spacing ?? { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(options.hardiness === undefined ? {} : { hardiness: options.hardiness }),
    ...(options.seasons === undefined ? {} : { seasons: options.seasons }),
    ...(options.companions === undefined ? {} : { companions: options.companions }),
    ...(options.antagonists === undefined ? {} : { antagonists: options.antagonists }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

/**
 * A 100 cm square bed with its bottom-left corner at `(minX, minY)`. Beds are
 * spaced 300 cm apart in the fixtures below, except the antagonist pair, which
 * is placed deliberately touching (0 cm apart) to trigger that one rule.
 */
function bed(minX: number, minY = 0, size = 100) {
  return {
    vertices: [
      { x: minX, y: minY },
      { x: minX + size, y: minY },
      { x: minX + size, y: minY + size },
      { x: minX, y: minY + size },
    ],
  };
}

const HIGHLANDS: ClimateProfile = resolveClimate({
  kind: 'region',
  regionId: 'scotland-highlands',
}); // H6, harsh
const PLOT: PlotConditions = { light: 'full-shade', climate: HIGHLANDS, plantingMonth: 9 };

describe('evaluatePlot — a fixture plot deliberately triggering each of the five warnings', () => {
  // All crops below are `full-shade` (matching the plot's light) and carry no
  // hardiness/seasons *unless the fixture is specifically testing that
  // dimension* -- so each placement triggers exactly the one warning it's
  // built for, and none of the others.

  const sunLover = fixturePlant({ id: 'sun-lover', light: 'full-sun' });
  const tenderCrop = fixturePlant({ id: 'tender-crop', hardiness: { rhsRating: 'H1a' } });
  const outOfSeasonCrop = fixturePlant({
    id: 'out-of-season-crop',
    seasons: { sow: [{ start: 3, end: 4 }] },
  });
  const overcrowdedCrop = fixturePlant({ id: 'overcrowded-crop' });
  const antagonistA = fixturePlant({
    id: 'antagonist-a',
    antagonists: [
      { plantId: 'antagonist-b', evidence: 'well-supported', note: 'shared disease risk' },
    ],
  });
  const antagonistB = fixturePlant({ id: 'antagonist-b' });

  const placements: CropPlacement[] = [
    { id: 'sun-lover-bed', plant: sunLover, region: bed(0), count: 1 },
    { id: 'tender-bed', plant: tenderCrop, region: bed(300), count: 1 },
    { id: 'season-bed', plant: outOfSeasonCrop, region: bed(600), count: 1 },
    { id: 'overcrowded-bed', plant: overcrowdedCrop, region: bed(900), count: 100 }, // way more than fits
    { id: 'antagonist-bed-a', plant: antagonistA, region: bed(1200), count: 1 },
    // Placed touching antagonist-bed-a (shares the edge at x = 1300).
    { id: 'antagonist-bed-b', plant: antagonistB, region: bed(1300), count: 1 },
  ];

  const evaluation = evaluatePlot(PLOT, placements);

  it('raises exactly one warning per rule, each on the placement that caused it', () => {
    // The rules' own logic (thresholds, severities, wording) is tested in
    // suitability-rules, overcrowding and antagonists.test.ts. What
    // evaluatePlot adds is routing: every rule runs, each warning names the
    // right placement(s), and nothing extra is raised.
    const summary = evaluation.warnings
      .map((w) => ({
        kind: w.kind,
        severity: w.severity,
        placements: w.subjects.map((subject) => subject.placementId).sort(),
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind));

    expect(summary).toEqual([
      {
        kind: 'antagonist-adjacency',
        severity: 'severe',
        placements: ['antagonist-bed-a', 'antagonist-bed-b'],
      },
      { kind: 'climate-mismatch', severity: 'severe', placements: ['tender-bed'] },
      { kind: 'overcrowded', severity: 'severe', placements: ['overcrowded-bed'] },
      { kind: 'wrong-light', severity: 'severe', placements: ['sun-lover-bed'] },
      { kind: 'wrong-sowing-season', severity: 'warning', placements: ['season-bed'] },
    ]);
  });
});

describe('evaluatePlot — a user-defined crop degrades to silence, never a crash', () => {
  it('produces neither companion suggestions nor antagonist warnings for a user-defined crop', () => {
    const shipped = fixturePlant({
      id: 'shipped-antagonist',
      companions: [{ plantId: 'user-cherry-belle', evidence: 'traditional' }], // impossible in real shipped data
      antagonists: [{ plantId: 'user-cherry-belle', evidence: 'traditional' }], // impossible in real shipped data
    });
    const userCrop = createUserPlant({
      commonName: 'Cherry Belle',
      category: 'vegetable',
      light: 'full-sun', // deliberately mismatched, to prove suitability rules still run
      spacing: { row: { inRowCm: 3, betweenRowCm: 15 } },
    });

    const placements: CropPlacement[] = [
      { id: 'shipped-bed', plant: shipped, region: bed(0), count: 1 },
      { id: 'user-bed', plant: userCrop, region: bed(300), count: 1 },
    ];

    const evaluation = evaluatePlot(PLOT, placements);

    // No suggestion or antagonist warning names the user crop at all -- even
    // though the (deliberately unrealistic) shipped fixture above points at it.
    expect(evaluation.suggestions.some((s) => s.suggestedPlantId === userCrop.id)).toBe(false);
    expect(evaluation.warnings.some((w) => w.kind === 'antagonist-adjacency')).toBe(false);

    // But the user crop is not invisible to the engine -- it still gets a
    // wrong-light warning like any other plant, since that rule has nothing to
    // do with companion/antagonist data (ADR 0011: no origin-awareness).
    expect(
      evaluation.warnings.some(
        (w) => w.kind === 'wrong-light' && w.subjects.some((s) => s.placementId === 'user-bed'),
      ),
    ).toBe(true);
  });
});

describe('evaluatePlot — input validation', () => {
  it('rejects a negative planted count', () => {
    const plant = fixturePlant({ id: 'anything' });
    const placements: CropPlacement[] = [{ id: 'bed-1', plant, region: bed(0), count: -1 }];
    expect(() => evaluatePlot(PLOT, placements)).toThrow();
  });
});
