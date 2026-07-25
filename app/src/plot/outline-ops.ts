/**
 * Pure vertex-array edits behind the free-form outline editor
 * (`PlotOutlineEditor.tsx`, Workplan Stage 3.2).
 *
 * Kept separate from the component so "move/add/remove a corner" is testable
 * without any pointer-event or DOM plumbing. None of these functions validate
 * their result — that is `safeValidatePlotRegion`'s job
 * (`@garden-planner/engine`), which the component calls after every edit so
 * an invalid outline (self-intersecting, too few corners, a collapsed edge)
 * never reaches the engine.
 */

import type { Vertex } from '@garden-planner/engine';

/** Replace the vertex at `index` with `position`, leaving every other corner untouched. */
export function moveVertex(vertices: readonly Vertex[], index: number, position: Vertex): Vertex[] {
  return vertices.map((vertex, i) => (i === index ? position : vertex));
}

/**
 * Insert a new corner at the midpoint of the edge from vertex `edgeIndex` to
 * its successor — wrapping from the last vertex back to the first, since the
 * outline's closing edge is implied (`region.ts`'s "implicitly closed" rule).
 * This is the "add a corner here" gesture on an edge.
 */
export function insertMidpoint(vertices: readonly Vertex[], edgeIndex: number): Vertex[] {
  const from = vertices[edgeIndex];
  const to = vertices[(edgeIndex + 1) % vertices.length];
  const midpoint: Vertex = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const next = [...vertices];
  next.splice(edgeIndex + 1, 0, midpoint);
  return next;
}

/**
 * Remove the vertex at `index`. Whether the result is still a valid outline
 * (at least three corners, no self-intersection) is left entirely to
 * `safeValidatePlotRegion` — this function doesn't guess at a floor so the
 * schema stays the single source of truth for what's disallowed.
 */
export function removeVertexAt(vertices: readonly Vertex[], index: number): Vertex[] {
  return vertices.filter((_vertex, i) => i !== index);
}
