import { describe, expect, it } from 'vitest';
import { rectangleRegion } from '@garden-planner/engine';
import { validateOutlineEdit } from './outline-edit.ts';

/**
 * The validation rule the deleted `PlotOutlineEditor` enforced, kept exactly
 * and moved somewhere pure (UI redesign Phase 2). Its own component test
 * covered the same three cases by driving pointer events; these drive the
 * arithmetic directly, which is what makes the rule testable now that the
 * editor draws on a Konva `<canvas>` jsdom cannot query (ADR 0017).
 */
describe('validateOutlineEdit', () => {
  // What makes an outline valid is the engine's rule (region.test.ts). This
  // checks the adaptation: a valid edit hands back the engine's region, and an
  // invalid one is refused with the engine's message rather than silently.
  it('returns the validated region for a good edit, and the engine’s message for a bad one', () => {
    const good = validateOutlineEdit(rectangleRegion(300, 200).vertices);
    expect(good.error).toBeNull();
    expect(good.region?.vertices).toHaveLength(4);

    // A bow-tie: the two diagonals cross.
    const bad = validateOutlineEdit([
      { x: 0, y: 0 },
      { x: 300, y: 200 },
      { x: 300, y: 0 },
      { x: 0, y: 200 },
    ]);
    expect(bad.region).toBeNull();
    expect(bad.error).toMatch(/crosses itself/);
  });
});
