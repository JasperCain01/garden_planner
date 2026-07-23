import { describe, it, expect } from 'vitest';
import {
  CalendarDayOfYearSchema,
  ClimateProfileSchema,
  FrostWindowSchema,
  LocationInputSchema,
} from './schema';
import { UK_DEFAULT_CLIMATE_PROFILE, CLIMATE_REGIONS } from './regions';

describe('CalendarDayOfYearSchema', () => {
  it('accepts a valid month/day pair', () => {
    expect(CalendarDayOfYearSchema.safeParse({ month: 4, day: 20 }).success).toBe(true);
  });

  it('rejects a day that does not exist in the given month (30 February)', () => {
    const result = CalendarDayOfYearSchema.safeParse({ month: 2, day: 30 });
    expect(result.success).toBe(false);
  });

  it('rejects a month outside 1-12', () => {
    expect(CalendarDayOfYearSchema.safeParse({ month: 13, day: 1 }).success).toBe(false);
  });

  it('rejects an unknown extra key (strict)', () => {
    expect(CalendarDayOfYearSchema.safeParse({ month: 4, day: 20, year: 2026 }).success).toBe(
      false,
    );
  });
});

describe('FrostWindowSchema', () => {
  it('accepts a last-spring/first-autumn pair', () => {
    const result = FrostWindowSchema.safeParse({
      lastSpringFrost: { month: 4, day: 20 },
      firstAutumnFrost: { month: 11, day: 5 },
    });
    expect(result.success).toBe(true);
  });
});

describe('ClimateProfileSchema', () => {
  it('validates the shipped UK default profile', () => {
    const result = ClimateProfileSchema.safeParse(UK_DEFAULT_CLIMATE_PROFILE);
    expect(result.success).toBe(true);
  });

  it('validates every shipped region profile', () => {
    for (const region of CLIMATE_REGIONS) {
      const result = ClimateProfileSchema.safeParse(region);
      expect(result.success, `${region.id} should validate`).toBe(true);
    }
  });

  it('rejects a profile missing frost provenance', () => {
    const invalid = {
      ...UK_DEFAULT_CLIMATE_PROFILE,
      provenance: { hardiness: UK_DEFAULT_CLIMATE_PROFILE.provenance.hardiness },
    };
    expect(ClimateProfileSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects a profile with an empty citation array', () => {
    const invalid = {
      ...UK_DEFAULT_CLIMATE_PROFILE,
      provenance: { ...UK_DEFAULT_CLIMATE_PROFILE.provenance, hardiness: [] },
    };
    expect(ClimateProfileSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an id that is not a valid slug', () => {
    const invalid = { ...UK_DEFAULT_CLIMATE_PROFILE, id: 'Not A Slug!' };
    expect(ClimateProfileSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('LocationInputSchema', () => {
  it('accepts a default location', () => {
    expect(LocationInputSchema.safeParse({ kind: 'default' }).success).toBe(true);
  });

  it('accepts a region location with a slug regionId', () => {
    expect(
      LocationInputSchema.safeParse({ kind: 'region', regionId: 'scotland-highlands' }).success,
    ).toBe(true);
  });

  it('rejects a region location with a non-slug regionId', () => {
    expect(LocationInputSchema.safeParse({ kind: 'region', regionId: 'Not A Slug!' }).success).toBe(
      false,
    );
  });

  it('accepts valid coordinates', () => {
    expect(
      LocationInputSchema.safeParse({ kind: 'coordinates', lat: 52.5, lng: -1.9 }).success,
    ).toBe(true);
  });

  it('rejects an out-of-range latitude', () => {
    expect(
      LocationInputSchema.safeParse({ kind: 'coordinates', lat: 200, lng: -1.9 }).success,
    ).toBe(false);
  });

  it('rejects an out-of-range longitude', () => {
    expect(
      LocationInputSchema.safeParse({ kind: 'coordinates', lat: 52.5, lng: -300 }).success,
    ).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(LocationInputSchema.safeParse({ kind: 'postcode', value: 'SW1A 1AA' }).success).toBe(
      false,
    );
  });
});
