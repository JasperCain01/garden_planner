import { describe, expect, it } from 'vitest';
import { OPENFARM_CATEGORY_OVERRIDES } from './categories.ts';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('OPENFARM_CATEGORY_OVERRIDES', () => {
  it('keys every entry with a valid slug', () => {
    for (const slug of Object.keys(OPENFARM_CATEGORY_OVERRIDES)) {
      expect(slug).toMatch(SLUG_PATTERN);
    }
  });
});
