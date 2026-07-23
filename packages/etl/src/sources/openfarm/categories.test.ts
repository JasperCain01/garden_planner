import { describe, expect, it } from 'vitest';
import { OPENFARM_CATEGORY_OVERRIDES } from './categories.ts';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_CATEGORIES = new Set(['vegetable', 'herb', 'fruit']);

describe('OPENFARM_CATEGORY_OVERRIDES', () => {
  it('keys every entry with a valid slug', () => {
    for (const slug of Object.keys(OPENFARM_CATEGORY_OVERRIDES)) {
      expect(slug).toMatch(SLUG_PATTERN);
    }
  });

  it('only ever assigns a real EdibleCategory', () => {
    for (const category of Object.values(OPENFARM_CATEGORY_OVERRIDES)) {
      expect(VALID_CATEGORIES.has(category)).toBe(true);
    }
  });

  it('is a non-trivial, bounded curated list (not empty, not attempting full coverage)', () => {
    const size = Object.keys(OPENFARM_CATEGORY_OVERRIDES).length;
    expect(size).toBeGreaterThan(50);
    expect(size).toBeLessThan(340); // the full rescue dump — see the module doc for why
  });
});
