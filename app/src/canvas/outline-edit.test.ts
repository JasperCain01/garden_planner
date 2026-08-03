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
  it('accepts a valid outline and hands back the engine’s own validated region', () => {
    const result = validateOutlineEdit(rectangleRegion(300, 200).vertices);
    expect(result.error).toBeNull();
    expect(result.region?.vertices).toHaveLength(4);
  });

  it('rejects a self-intersecting outline with the engine’s own message', () => {
    // A bow-tie: the two diagonals cross.
    const result = validateOutlineEdit([
      { x: 0, y: 0 },
      { x: 300, y: 200 },
      { x: 300, y: 0 },
      { x: 0, y: 200 },
    ]);
    expect(result.region).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('rejects an outline with too few corners rather than silently refusing the edit', () => {
    const result = validateOutlineEdit([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
    expect(result.region).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
