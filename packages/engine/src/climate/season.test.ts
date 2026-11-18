import { describe, it, expect } from 'vitest';
import { deriveGrowingSeason } from './season';

describe('deriveGrowingSeason', () => {
  // A frost in the second half of its month costs that month; one in the first
  // half doesn't. Both ends, plus both year wraps.
  it.each([
    [
      'pushes the start to next month when the last frost is late in its month',
      { month: 4, day: 20 },
      { month: 11, day: 5 },
      'start',
      5,
    ],
    [
      'keeps the start month when the last frost is early in its month',
      { month: 4, day: 5 },
      { month: 11, day: 25 },
      'start',
      4,
    ],
    [
      'pulls the end back a month when the first frost is early in its month',
      { month: 4, day: 5 },
      { month: 11, day: 5 },
      'end',
      10,
    ],
    [
      'keeps the end month when the first frost is late in its month',
      { month: 4, day: 5 },
      { month: 11, day: 25 },
      'end',
      11,
    ],
    [
      'wraps December -> January at the start',
      { month: 12, day: 20 },
      { month: 6, day: 5 },
      'start',
      1,
    ],
    ['wraps January -> December at the end', { month: 3, day: 5 }, { month: 1, day: 5 }, 'end', 12],
  ] as const)('%s', (_case, lastSpringFrost, firstAutumnFrost, end, expected) => {
    expect(deriveGrowingSeason({ lastSpringFrost, firstAutumnFrost })[end]).toBe(expected);
  });
});
