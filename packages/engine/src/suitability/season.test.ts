import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant, type Seasons } from '../schema/plant.ts';
import { resolveClimate } from '../climate/resolve.ts';
import type { ClimateProfile } from '../climate/schema.ts';
import type { PlotConditions } from './conditions';
import { scoreSeason } from './season';

function plantWith(seasons?: Seasons): Plant {
  return validatePlant({
    id: 'test-crop',
    commonName: 'Test Crop',
    scientificName: 'Testum cropii',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(seasons === undefined ? {} : { seasons }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const UK_DEFAULT = resolveClimate();
const HIGHLANDS = resolveClimate({ kind: 'region', regionId: 'scotland-highlands' });

function plot(climate: ClimateProfile, plantingMonth?: number): PlotConditions {
  return {
    light: 'full-sun',
    climate,
    ...(plantingMonth === undefined ? {} : { plantingMonth }),
  };
}

describe('scoreSeason', () => {
  it('reports unknown when the crop carries no seasons (the whole shipped dataset today)', () => {
    const result = scoreSeason(plantWith(), plot(UK_DEFAULT, 4));

    expect(result).toMatchObject({
      dimension: 'season',
      finding: 'unknown-plant',
      score: null,
      weight: 0.15,
    });
    expect(result.reason).toContain('No sowing or harvest data');
  });

  it('treats an empty seasons block as no data rather than a match', () => {
    const result = scoreSeason(plantWith({}), plot(UK_DEFAULT, 4));

    expect(result).toMatchObject({ finding: 'unknown-plant', score: null });
  });

  describe('with a planting month — "can I sow this now?"', () => {
    const springSown = plantWith({ sow: [{ start: 3, end: 4 }] });

    it('scores a month inside the sowing window perfectly', () => {
      const result = scoreSeason(springSown, plot(UK_DEFAULT, 4));

      expect(result).toMatchObject({ finding: 'match', score: 1 });
      expect(result.reason).toBe('April falls inside its March–April sowing window.');
    });

    it('scores the month either side as marginal', () => {
      expect(scoreSeason(springSown, plot(UK_DEFAULT, 5))).toMatchObject({
        finding: 'marginal',
        score: 0.6,
      });
      expect(scoreSeason(springSown, plot(UK_DEFAULT, 2))).toMatchObject({
        finding: 'marginal',
        score: 0.6,
      });
    });

    it('scores a month well outside the window low, but never as unsuitable', () => {
      const result = scoreSeason(springSown, plot(UK_DEFAULT, 9));

      expect(result).toMatchObject({ finding: 'mismatch', score: 0.2 });
      expect(result.finding).not.toBe('unsuitable');
      expect(result.reason).toContain('plan for rather than plant now');
    });

    it('handles a sowing window that wraps the new year', () => {
      const overwintered = plantWith({ sow: [{ start: 10, end: 2 }] });

      expect(scoreSeason(overwintered, plot(UK_DEFAULT, 1))).toMatchObject({ score: 1 });
      expect(scoreSeason(overwintered, plot(UK_DEFAULT, 12))).toMatchObject({ score: 1 });
      expect(scoreSeason(overwintered, plot(UK_DEFAULT, 3))).toMatchObject({ score: 0.6 });
      expect(scoreSeason(overwintered, plot(UK_DEFAULT, 6))).toMatchObject({ score: 0.2 });
    });

    it('considers every sowing window a crop has', () => {
      const twiceSown = plantWith({
        sow: [
          { start: 3, end: 4 },
          { start: 8, end: 8 },
        ],
      });

      expect(scoreSeason(twiceSown, plot(UK_DEFAULT, 8))).toMatchObject({ score: 1 });
      expect(scoreSeason(twiceSown, plot(UK_DEFAULT, 6))).toMatchObject({ score: 0.2 });
    });
  });

  describe('without a planting month — "does this crop fit this region?"', () => {
    it('scores an ordinary British sowing window as a comfortable fit', () => {
      // The UK default's frost-free season is May–October; the workable window
      // widens that to March–December, so a March sowing is not "out of season".
      const result = scoreSeason(plantWith({ sow: [{ start: 3, end: 4 }] }), plot(UK_DEFAULT));

      expect(result).toMatchObject({ finding: 'match', score: 1 });
      expect(result.reason).toContain('March–December');
    });

    it('penalises a window the region cannot accommodate, in proportion', () => {
      const result = scoreSeason(plantWith({ sow: [{ start: 1, end: 4 }] }), plot(UK_DEFAULT));

      // January and February fall outside March–December: 2 of 4 months fit.
      expect(result.score).toBe(0.5);
      expect(result.reason).toContain('only 2 of those 4 months');
    });

    it('discriminates between regions with different seasons', () => {
      const earlySown = plantWith({ sow: [{ start: 3, end: 4 }] });

      const south = scoreSeason(earlySown, plot(UK_DEFAULT));
      const north = scoreSeason(earlySown, plot(HIGHLANDS));

      // The Highlands' frost-free season starts a month later, so its workable
      // window is April–December and a March sowing is only half accommodated.
      expect(south.score).toBe(1);
      expect(north.score).toBe(0.5);
    });

    it('floors a completely unworkable window instead of disqualifying the crop', () => {
      const result = scoreSeason(plantWith({ sow: [{ start: 1, end: 2 }] }), plot(UK_DEFAULT));

      expect(result).toMatchObject({ finding: 'mismatch', score: 0.25 });
      expect(result.finding).not.toBe('unsuitable');
      expect(result.reason).toContain('need protection or a different timing');
    });

    it('falls back to harvest windows when the crop states no sowing window', () => {
      const result = scoreSeason(plantWith({ harvest: [{ start: 8, end: 9 }] }), plot(UK_DEFAULT));

      expect(result).toMatchObject({ finding: 'match', score: 1 });
      expect(result.reason).toContain('Harvested August–September');
    });

    it('uses the harvest window even when a planting month was given, if there is no sow window', () => {
      const result = scoreSeason(
        plantWith({ harvest: [{ start: 8, end: 9 }] }),
        plot(UK_DEFAULT, 4),
      );

      expect(result.reason).toContain('Harvested August–September');
    });
  });
});
