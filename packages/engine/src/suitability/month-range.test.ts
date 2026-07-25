import { describe, it, expect } from 'vitest';
import {
  anyMonthRangeIncludes,
  describeMonthRange,
  describeMonthRanges,
  expandMonthRange,
  monthName,
  monthRangeIncludes,
  monthRangeLength,
  nextMonth,
  previousMonth,
  widenMonthRange,
} from './month-range';

/**
 * The wrap-around cases are the whole point of these helpers: `MonthRangeSchema`
 * lets `end < start` mean "spans the new year" (ADR 0004), and every one of
 * these functions has to survive that.
 */
describe('month-range helpers', () => {
  describe('monthRangeIncludes', () => {
    it('handles an ordinary range', () => {
      const march = { start: 3, end: 5 };
      expect(monthRangeIncludes(march, 3)).toBe(true);
      expect(monthRangeIncludes(march, 5)).toBe(true);
      expect(monthRangeIncludes(march, 2)).toBe(false);
      expect(monthRangeIncludes(march, 6)).toBe(false);
    });

    it('handles a range that wraps the new year', () => {
      const novToFeb = { start: 11, end: 2 };
      expect(monthRangeIncludes(novToFeb, 12)).toBe(true);
      expect(monthRangeIncludes(novToFeb, 1)).toBe(true);
      expect(monthRangeIncludes(novToFeb, 2)).toBe(true);
      expect(monthRangeIncludes(novToFeb, 3)).toBe(false);
      expect(monthRangeIncludes(novToFeb, 10)).toBe(false);
    });

    it('handles a single-month range', () => {
      expect(monthRangeIncludes({ start: 7, end: 7 }, 7)).toBe(true);
      expect(monthRangeIncludes({ start: 7, end: 7 }, 8)).toBe(false);
    });
  });

  it('anyMonthRangeIncludes checks every window', () => {
    const windows = [
      { start: 3, end: 4 },
      { start: 8, end: 9 },
    ];
    expect(anyMonthRangeIncludes(windows, 9)).toBe(true);
    expect(anyMonthRangeIncludes(windows, 6)).toBe(false);
    expect(anyMonthRangeIncludes([], 6)).toBe(false);
  });

  describe('expandMonthRange', () => {
    it('lists the months of an ordinary range', () => {
      expect(expandMonthRange({ start: 3, end: 6 })).toEqual([3, 4, 5, 6]);
    });

    it('lists the months of a wrapping range in calendar order', () => {
      expect(expandMonthRange({ start: 11, end: 2 })).toEqual([11, 12, 1, 2]);
    });

    it('lists a whole year without looping forever', () => {
      expect(expandMonthRange({ start: 4, end: 3 })).toHaveLength(12);
    });
  });

  it('monthRangeLength counts inclusively, wrapping included', () => {
    expect(monthRangeLength({ start: 3, end: 5 })).toBe(3);
    expect(monthRangeLength({ start: 5, end: 5 })).toBe(1);
    expect(monthRangeLength({ start: 11, end: 2 })).toBe(4);
  });

  it('nextMonth / previousMonth wrap at the year boundary', () => {
    expect(nextMonth(12)).toBe(1);
    expect(previousMonth(1)).toBe(12);
    expect(nextMonth(4)).toBe(5);
    expect(previousMonth(4)).toBe(3);
  });

  describe('widenMonthRange', () => {
    it('widens by a month at each end', () => {
      expect(widenMonthRange({ start: 4, end: 10 }, 1)).toEqual({ start: 3, end: 11 });
    });

    it('wraps rather than clamping at the year boundary', () => {
      expect(widenMonthRange({ start: 1, end: 6 }, 1)).toEqual({ start: 12, end: 7 });
    });

    it('saturates at a full year instead of overlapping itself', () => {
      // 11 months widened by one either side would be 13 months — nonsense as a
      // range, so it saturates.
      expect(widenMonthRange({ start: 2, end: 12 }, 1)).toEqual({ start: 1, end: 12 });
    });

    it('is a no-op for a zero or negative widening', () => {
      expect(widenMonthRange({ start: 4, end: 10 }, 0)).toEqual({ start: 4, end: 10 });
    });
  });

  it('describes months and ranges readably', () => {
    expect(monthName(3)).toBe('March');
    expect(describeMonthRange({ start: 3, end: 4 })).toBe('March–April');
    expect(describeMonthRange({ start: 3, end: 3 })).toBe('March');
    expect(
      describeMonthRanges([
        { start: 3, end: 4 },
        { start: 8, end: 8 },
      ]),
    ).toBe('March–April and August');
    expect(describeMonthRanges([])).toBe('');
  });
});
