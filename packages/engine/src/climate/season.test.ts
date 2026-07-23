import { describe, it, expect } from 'vitest';
import { deriveGrowingSeason } from './season';

describe('deriveGrowingSeason', () => {
  it('pushes the start to next month when the last frost falls late in its month', () => {
    const season = deriveGrowingSeason({
      lastSpringFrost: { month: 4, day: 20 }, // late April
      firstAutumnFrost: { month: 11, day: 5 },
    });
    expect(season.start).toBe(5); // May
  });

  it('keeps the start month when the last frost falls early in its month', () => {
    const season = deriveGrowingSeason({
      lastSpringFrost: { month: 4, day: 5 }, // early April
      firstAutumnFrost: { month: 11, day: 25 },
    });
    expect(season.start).toBe(4); // April
  });

  it('pulls the end back a month when the first frost falls early in its month', () => {
    const season = deriveGrowingSeason({
      lastSpringFrost: { month: 4, day: 5 },
      firstAutumnFrost: { month: 11, day: 5 }, // early November
    });
    expect(season.end).toBe(10); // October
  });

  it('keeps the end month when the first frost falls late in its month', () => {
    const season = deriveGrowingSeason({
      lastSpringFrost: { month: 4, day: 5 },
      firstAutumnFrost: { month: 11, day: 25 }, // late November
    });
    expect(season.end).toBe(11); // November
  });

  it('wraps December -> January correctly at the start boundary', () => {
    const season = deriveGrowingSeason({
      lastSpringFrost: { month: 12, day: 20 }, // late December
      firstAutumnFrost: { month: 6, day: 5 },
    });
    expect(season.start).toBe(1); // January
  });

  it('wraps January -> December correctly at the end boundary', () => {
    const season = deriveGrowingSeason({
      lastSpringFrost: { month: 3, day: 5 },
      firstAutumnFrost: { month: 1, day: 5 }, // early January
    });
    expect(season.end).toBe(12); // December
  });
});
