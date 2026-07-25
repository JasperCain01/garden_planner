import { describe, expect, it } from 'vitest';
import { insertMidpoint, moveVertex, removeVertexAt } from './outline-ops.ts';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('moveVertex', () => {
  it('replaces only the vertex at the given index', () => {
    expect(moveVertex(square, 1, { x: 50, y: 50 })).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
  });

  it('leaves the original array untouched', () => {
    moveVertex(square, 0, { x: 9, y: 9 });
    expect(square[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('insertMidpoint', () => {
  it('inserts the midpoint between an edge and its successor', () => {
    expect(insertMidpoint(square, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
  });

  it('wraps from the last vertex back to the first, matching the implied closing edge', () => {
    expect(insertMidpoint(square, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 50 },
    ]);
  });
});

describe('removeVertexAt', () => {
  it('drops the vertex at the given index', () => {
    expect(removeVertexAt(square, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]);
  });

  it('does not enforce a minimum — that is the schema validator’s job', () => {
    expect(removeVertexAt(removeVertexAt(square, 0), 0)).toHaveLength(2);
  });
});
