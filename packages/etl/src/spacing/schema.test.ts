import { describe, expect, it } from 'vitest';
import type { SourceRef } from '@garden-planner/engine';
import {
  MIN_SOURCES_PER_METHOD,
  SPACING_SANITY_BOUNDS,
  spacingRecordSources,
  spacingSanityIssues,
  validateSpacingRecord,
  validateSpacingTable,
  type SpacingRecord,
} from './schema.ts';

/** Two throwaway citations, enough to satisfy the ≥2-per-method rule in tests. */
function twoSources(): [SourceRef, SourceRef] {
  return [
    { source: 'RHS', url: 'https://www.rhs.org.uk/example', retrievedAt: '2026-07-22' },
    {
      source: "Old Farmer's Almanac",
      url: 'https://www.almanac.com/example',
      retrievedAt: '2026-07-22',
    },
  ];
}

/** A minimal, valid record (row + intensive) for tests to tweak. */
function baseRecord(overrides: Partial<SpacingRecord> = {}): SpacingRecord {
  return {
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    category: 'vegetable',
    spacing: {
      row: { inRowCm: 10, betweenRowCm: 30 },
      intensive: { plantsPerSquare: 9 },
    },
    provenance: {
      row: twoSources(),
      intensive: twoSources(),
    },
    ...overrides,
  };
}

describe('validateSpacingRecord — happy paths', () => {
  it('accepts a well-formed row + intensive record', () => {
    expect(() => validateSpacingRecord(baseRecord())).not.toThrow();
  });

  it('accepts a row-only record (intensive absent, as the schema allows)', () => {
    const rowOnly = baseRecord({
      id: 'potato',
      commonName: 'Potato',
      scientificName: 'Solanum tuberosum',
      spacing: { row: { inRowCm: 37, betweenRowCm: 75 } },
      provenance: { row: twoSources() },
    });
    expect(() => validateSpacingRecord(rowOnly)).not.toThrow();
  });

  it('accepts an intensive-only record', () => {
    const intensiveOnly = baseRecord({
      spacing: { intensive: { plantsPerSquare: 9 } },
      provenance: { intensive: twoSources() },
    });
    expect(() => validateSpacingRecord(intensiveOnly)).not.toThrow();
  });
});

describe('validateSpacingRecord — the ≥2-sources-per-method rule', () => {
  it('rejects a method figure backed by only one source', () => {
    const oneSource = baseRecord({
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
      provenance: { row: [twoSources()[0]] },
    });
    expect(() => validateSpacingRecord(oneSource)).toThrow();
  });

  it('exposes the required minimum as a constant (documented, not magic)', () => {
    expect(MIN_SOURCES_PER_METHOD).toBe(2);
  });
});

describe('validateSpacingRecord — method ⇔ provenance coupling', () => {
  it('rejects a row figure with no row provenance (the anti-inference rule)', () => {
    const missingRowProv = baseRecord({
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 }, intensive: { plantsPerSquare: 9 } },
      // Only intensive provenance — row citations are missing.
      provenance: { intensive: twoSources() },
    });
    expect(() => validateSpacingRecord(missingRowProv)).toThrow(/provenance\.row is missing/);
  });

  it('rejects an intensive figure with no intensive provenance', () => {
    const missingIntensiveProv = baseRecord({
      provenance: { row: twoSources() },
    });
    expect(() => validateSpacingRecord(missingIntensiveProv)).toThrow(
      /provenance\.intensive is missing/,
    );
  });

  it('rejects provenance for a method that has no figure (dangling citations)', () => {
    const danglingIntensive = baseRecord({
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
      provenance: { row: twoSources(), intensive: twoSources() },
    });
    expect(() => validateSpacingRecord(danglingIntensive)).toThrow(/spacing\.intensive is not/);
  });
});

describe('validateSpacingRecord — sanity bounds', () => {
  it('rejects negative/zero spacing (positivity floor from the engine schema)', () => {
    const negative = baseRecord({
      spacing: { row: { inRowCm: -5, betweenRowCm: 30 } },
      provenance: { row: twoSources() },
    });
    expect(() => validateSpacingRecord(negative)).toThrow();
  });

  it('rejects an implausibly tiny (but positive) in-row spacing', () => {
    const tooTiny = baseRecord({
      spacing: { row: { inRowCm: 0.3, betweenRowCm: 30 } },
      provenance: { row: twoSources() },
    });
    expect(() => validateSpacingRecord(tooTiny)).toThrow();
  });

  it('rejects a plot-scale-absurd spacing (a misplaced decimal)', () => {
    const tooBig = baseRecord({
      spacing: { row: { inRowCm: 37, betweenRowCm: 7500 } },
      provenance: { row: twoSources() },
    });
    expect(() => validateSpacingRecord(tooBig)).toThrow();
  });

  it('rejects between-row spacing tighter than in-row (transposed values)', () => {
    const transposed = baseRecord({
      spacing: { row: { inRowCm: 30, betweenRowCm: 10 } },
      provenance: { row: twoSources() },
    });
    expect(() => validateSpacingRecord(transposed)).toThrow(/likely transposed/);
  });

  it('rejects an absurd intensive density (ceiling)', () => {
    const tooDense = baseRecord({
      spacing: { intensive: { plantsPerSquare: 999 } },
      provenance: { intensive: twoSources() },
    });
    expect(() => validateSpacingRecord(tooDense)).toThrow();
  });

  it('rejects an implausibly sparse (but positive) intensive density (floor)', () => {
    const tooSparse = baseRecord({
      spacing: { intensive: { perSquareMetre: 0.01 } },
      provenance: { intensive: twoSources() },
    });
    expect(() => validateSpacingRecord(tooSparse)).toThrow(/floor/);
  });
});

describe('validateSpacingRecord — strictness', () => {
  it('rejects an unknown/misspelled key rather than dropping it silently', () => {
    const typo = { ...baseRecord(), intesive: { plantsPerSquare: 9 } };
    expect(() => validateSpacingRecord(typo)).toThrow();
  });

  it('rejects a non-slug id', () => {
    expect(() => validateSpacingRecord(baseRecord({ id: 'Broad Bean' }))).toThrow();
  });
});

describe('spacingSanityIssues (pure function, reused by the schema)', () => {
  it('returns no issues for a plausible block', () => {
    expect(spacingSanityIssues({ row: { inRowCm: 10, betweenRowCm: 30 } })).toEqual([]);
  });

  it('flags a ceiling breach with a readable message', () => {
    const issues = spacingSanityIssues({
      row: { inRowCm: 10, betweenRowCm: SPACING_SANITY_BOUNDS.maxDistanceCm + 1 },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/ceiling/);
  });
});

describe('validateSpacingTable', () => {
  it('rejects a table with duplicate ids', () => {
    expect(() => validateSpacingTable([baseRecord(), baseRecord()])).toThrow(/duplicate.*id/);
  });

  it('rejects a table with duplicate scientific names (the GBIF merge join key)', () => {
    // Distinct slugs, same species → would collide on the GBIF id in Stage 1.5.
    const onion = baseRecord({ id: 'onion', scientificName: 'Allium cepa' });
    const springOnion = baseRecord({ id: 'spring-onion', scientificName: 'allium  cepa' });
    expect(() => validateSpacingTable([onion, springOnion])).toThrow(/scientificName/);
  });

  it('returns typed rows for a valid, unique table', () => {
    const rows = validateSpacingTable([
      baseRecord(),
      baseRecord({ id: 'carrot', scientificName: 'Daucus carota' }),
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe('spacingRecordSources (flatten for Stage 1.5)', () => {
  it('merges row + intensive citations and de-duplicates by source+url', () => {
    const shared = {
      source: 'RHS',
      url: 'https://www.rhs.org.uk/shared',
      retrievedAt: '2026-07-22',
    };
    const record = baseRecord({
      provenance: {
        row: [shared, twoSources()[1]],
        intensive: [shared, twoSources()[0]],
      },
    });
    const sources = spacingRecordSources(record);
    // shared appears once; the two distinct others appear too → 3 total.
    expect(sources).toHaveLength(3);
    expect(sources.filter((s) => s.url === shared.url)).toHaveLength(1);
  });
});
