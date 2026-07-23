import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveClimate, findRegionById } from './resolve';
import { UK_DEFAULT_CLIMATE_PROFILE } from './regions';

/**
 * `fetch` is stubbed to throw for the whole suite: `resolveClimate` is
 * documented as fully offline, so if any code path here ever reached the
 * network, these tests would fail loudly instead of silently passing.
 */
function withNoNetwork<T>(run: () => T): T {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('unexpected network call: resolveClimate must be fully offline');
  }) as typeof fetch;
  try {
    return run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveClimate — offline default', () => {
  it('resolves the UK default with no location argument, with no network call', () => {
    const profile = withNoNetwork(() => resolveClimate());
    expect(profile).toBe(UK_DEFAULT_CLIMATE_PROFILE);
  });

  it('resolves the UK default for an explicit { kind: "default" } location', () => {
    const profile = withNoNetwork(() => resolveClimate({ kind: 'default' }));
    expect(profile).toBe(UK_DEFAULT_CLIMATE_PROFILE);
  });
});

describe('resolveClimate — region lookup', () => {
  it('resolves a known region id', () => {
    const profile = resolveClimate({ kind: 'region', regionId: 'south-west-england' });
    expect(profile.id).toBe('south-west-england');
  });

  it('throws a descriptive error for an unknown region id', () => {
    expect(() => resolveClimate({ kind: 'region', regionId: 'atlantis' })).toThrow(/atlantis/);
  });
});

describe('resolveClimate — coordinates', () => {
  it('resolves the nearest region for a point close to a region centroid', () => {
    // Near Inverness -> Scotland Highlands.
    const profile = resolveClimate({ kind: 'coordinates', lat: 57.5, lng: -4.2 });
    expect(profile.id).toBe('scotland-highlands');
  });

  it('resolves a different nearest region for a point close to another centroid', () => {
    // Near Truro -> South West England.
    const profile = resolveClimate({ kind: 'coordinates', lat: 50.26, lng: -5.05 });
    expect(profile.id).toBe('south-west-england');
  });

  it('never fails for a coordinate far outside the UK — always finds a nearest region', () => {
    const profile = withNoNetwork(() =>
      resolveClimate({ kind: 'coordinates', lat: -33.87, lng: 151.21 }),
    );
    expect(findRegionById(profile.id)).toBeDefined();
  });
});
