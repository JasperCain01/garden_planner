import { describe, it, expect } from 'vitest';
import { UK_DEFAULT_CLIMATE_PROFILE } from '../climate/regions.ts';
import { resolveClimate } from '../climate/resolve.ts';
import {
  PlotConditionsSchema,
  resolvePlotConditions,
  safeValidatePlotConditions,
  validatePlotConditions,
  type PlotConditions,
} from './conditions';

describe('plot conditions schema', () => {
  it('resolves a bare light level to the UK default climate', () => {
    const conditions = resolvePlotConditions({ light: 'full-sun' });

    expect(conditions.climate).toEqual(UK_DEFAULT_CLIMATE_PROFILE);
    expect(conditions.soil).toBeUndefined();
    expect(conditions.plantingMonth).toBeUndefined();
  });

  it('resolves a named region through the Stage 1.6 resolver', () => {
    const conditions = resolvePlotConditions({
      light: 'partial-shade',
      location: { kind: 'region', regionId: 'scotland-highlands' },
    });

    expect(conditions.climate.id).toBe('scotland-highlands');
    expect(conditions.climate).toEqual(
      resolveClimate({ kind: 'region', regionId: 'scotland-highlands' }),
    );
  });

  it('resolves coordinates to the nearest region', () => {
    // Truro, Cornwall.
    const conditions = resolvePlotConditions({
      light: 'full-sun',
      location: { kind: 'coordinates', lat: 50.26, lng: -5.05 },
    });

    expect(conditions.climate.id).toBe('south-west-england');
  });

  it('keeps the soil and planting month it was given', () => {
    const conditions = resolvePlotConditions({
      light: 'full-sun',
      soil: { texture: 'clay', ph: 'neutral', moisture: 'moist' },
      plantingMonth: 4,
    });

    expect(conditions.soil).toEqual({ texture: 'clay', ph: 'neutral', moisture: 'moist' });
    expect(conditions.plantingMonth).toBe(4);
  });

  it('rejects an empty soil block — omit it instead of describing nothing', () => {
    expect(() => resolvePlotConditions({ light: 'full-sun', soil: {} })).toThrow();
  });

  it('rejects an unknown light level, a stray key and a bad month', () => {
    expect(() => resolvePlotConditions({ light: 'dappled' })).toThrow();
    expect(() => resolvePlotConditions({ light: 'full-sun', shade: true })).toThrow();
    expect(() => resolvePlotConditions({ light: 'full-sun', plantingMonth: 13 })).toThrow();
  });

  it('requires a light level — a plot without one cannot be scored', () => {
    expect(() => resolvePlotConditions({})).toThrow();
  });

  it("propagates the resolver's throw for an unknown region id", () => {
    expect(() =>
      resolvePlotConditions({
        light: 'full-sun',
        location: { kind: 'region', regionId: 'atlantis' },
      }),
    ).toThrow(/atlantis/);
  });

  it('validates an already-resolved value, throwing or reporting as asked', () => {
    const conditions: PlotConditions = {
      light: 'full-sun',
      climate: UK_DEFAULT_CLIMATE_PROFILE,
    };

    expect(validatePlotConditions(conditions)).toEqual(conditions);
    expect(safeValidatePlotConditions(conditions).success).toBe(true);
    // A climate profile is required and must be a *complete* one.
    expect(safeValidatePlotConditions({ light: 'full-sun' }).success).toBe(false);
    expect(safeValidatePlotConditions({ light: 'full-sun', climate: { id: 'nope' } }).success).toBe(
      false,
    );
    expect(() => validatePlotConditions({ light: 'full-sun' })).toThrow();
  });

  it('is the single source of truth for its type (z.infer, not a hand-written interface)', () => {
    // If the schema and the type could drift, this assignment would still
    // compile; it is here as documentation of the intent, and the shape below is
    // type-checked against `PlotConditions` at author time.
    const parsed = PlotConditionsSchema.parse({
      light: 'partial-shade',
      climate: UK_DEFAULT_CLIMATE_PROFILE,
    });
    const typed: PlotConditions = parsed;
    expect(typed.light).toBe('partial-shade');
  });
});
