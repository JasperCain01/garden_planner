import { describe, expect, it } from 'vitest';
import { datasetSpacingIssues } from './sanity.ts';

describe('datasetSpacingIssues', () => {
  it('accepts ordinary vegetable spacing', () => {
    expect(datasetSpacingIssues({ row: { inRowCm: 10, betweenRowCm: 30 } })).toEqual([]);
  });

  it('accepts wide fruit-tree spacing (tree-tolerant, unlike the Stage 1.3 bounds)', () => {
    // Star fruit at 8–9 m would trip the 300 cm curation ceiling but is a real crop.
    expect(datasetSpacingIssues({ row: { inRowCm: 800, betweenRowCm: 900 } })).toEqual([]);
  });

  it('does NOT flag in-row > between-row (no transposition heuristic at dataset level)', () => {
    // OpenFarm's spread often exceeds its row spacing; that is not an error here.
    expect(datasetSpacingIssues({ row: { inRowCm: 150, betweenRowCm: 90 } })).toEqual([]);
  });

  it('rejects an absurdly large distance (data error)', () => {
    const issues = datasetSpacingIssues({ row: { inRowCm: 10, betweenRowCm: 6000 } });
    expect(issues.some((i) => i.includes('ceiling'))).toBe(true);
  });

  it('rejects a decimal-slip tiny distance', () => {
    const issues = datasetSpacingIssues({ row: { inRowCm: 0.1, betweenRowCm: 30 } });
    expect(issues.some((i) => i.includes('floor'))).toBe(true);
  });

  it('rejects an implausible intensive density', () => {
    const issues = datasetSpacingIssues({ intensive: { plantsPerSquare: 500 } });
    expect(issues.some((i) => i.includes('ceiling'))).toBe(true);
  });
});
