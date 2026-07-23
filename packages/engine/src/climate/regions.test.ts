import { describe, it, expect } from 'vitest';
import { ClimateProfileSchema } from './schema';
import { ALL_CLIMATE_PROFILES, CLIMATE_REGIONS, UK_DEFAULT_CLIMATE_PROFILE } from './regions';

describe('ALL_CLIMATE_PROFILES', () => {
  it('includes the UK default plus every region, with no duplicates', () => {
    expect(ALL_CLIMATE_PROFILES).toHaveLength(CLIMATE_REGIONS.length + 1);
    expect(ALL_CLIMATE_PROFILES[0]).toBe(UK_DEFAULT_CLIMATE_PROFILE);
  });

  it('has a unique id per profile', () => {
    const ids = ALL_CLIMATE_PROFILES.map((profile) => profile.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every profile validates against ClimateProfileSchema', () => {
    for (const profile of ALL_CLIMATE_PROFILES) {
      expect(ClimateProfileSchema.safeParse(profile).success, profile.id).toBe(true);
    }
  });

  it('every profile cites at least one source for hardiness and frost', () => {
    for (const profile of ALL_CLIMATE_PROFILES) {
      expect(
        profile.provenance.hardiness.length,
        `${profile.id} hardiness citations`,
      ).toBeGreaterThan(0);
      expect(profile.provenance.frost.length, `${profile.id} frost citations`).toBeGreaterThan(0);
    }
  });
});

describe('UK_DEFAULT_CLIMATE_PROFILE', () => {
  it('is the H4 national baseline', () => {
    expect(UK_DEFAULT_CLIMATE_PROFILE.hardiness.rhsRating).toBe('H4');
  });
});
