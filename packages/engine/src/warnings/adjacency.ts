/**
 * What **"planted nearby"** means, in centimetres, on a polygon — the one
 * question Stage 2.2 deliberately left open (`docs/adr/0013` Consequences:
 * "what it does *not* yet have is a notion of distance between two *placed*
 * crops"). Full reasoning and the alternatives weighed:
 * `docs/adr/0014-warnings-and-companion-suggestions.md`.
 *
 * Two pieces, mirroring the split `spacing/geometry.ts` and `spacing/method.ts`
 * already make:
 *
 * - **How far apart are two beds?** {@link regionDistanceCm} — real polygon-to-
 *   polygon distance (0 if they touch or overlap), not a bounding-box
 *   approximation. Stage 2.2 already rejected bounding-box shortcuts for
 *   counting; approximating adjacency with one here would repeat exactly that
 *   mistake for a different question.
 * - **How close is too close?** {@link adjacencyThresholdCm} — a
 *   spacing-derived threshold, so it scales with the crops involved instead of
 *   being one arbitrary constant for every pairing.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { Spacing } from '../schema/plant.ts';
import {
  GEOMETRY_EPSILON,
  pointInPolygon,
  segmentsIntersect,
  type Point,
} from '../spacing/geometry.ts';
import { resolveLatticeSpacing } from '../spacing/method.ts';
import type { PlotRegion } from '../spacing/region.ts';

/**
 * Shortest distance from `point` to the segment `a → b`, centimetres.
 *
 * Standard projection-and-clamp: project `point` onto the *line* through `a`
 * and `b`, clamp the parameter to `[0, 1]` so the closest point stays on the
 * segment rather than its infinite extension, then measure straight-line
 * distance to whichever point that is.
 */
function distancePointToSegment(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  // `a` and `b` coincide (a degenerate segment): the segment is just point `a`.
  if (lengthSquared <= GEOMETRY_EPSILON) return Math.hypot(point.x - a.x, point.y - a.y);

  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared),
  );
  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

/**
 * Shortest distance between two segments, centimetres. `0` if they cross or
 * touch at all (reusing `spacing/geometry.ts#segmentsIntersect`, which already
 * treats mere touching as an intersection). Otherwise the answer is always the
 * distance from one segment's endpoint to the other segment — the closest
 * approach between two line segments that don't cross can never be a purely
 * interior point on both.
 */
function distanceSegmentToSegment(a1: Point, a2: Point, b1: Point, b2: Point): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(
    distancePointToSegment(a1, b1, b2),
    distancePointToSegment(a2, b1, b2),
    distancePointToSegment(b1, a1, a2),
    distancePointToSegment(b2, a1, a2),
  );
}

/**
 * How far apart two beds actually are, centimetres — `0` if they touch or
 * either one overlaps the other at all.
 *
 * Real polygon-to-polygon distance, not the two regions' bounding boxes: an
 * L-shaped bed's notch can bring its outline much closer to a neighbour than
 * its bounding box would suggest, and Stage 2.2 already established (ADR
 * 0013) that a bounding-box shortcut is the wrong answer for exactly this kind
 * of question.
 *
 * Two cheap containment checks catch overlap (one region's corner lying
 * inside the other) before falling back to the O(n·m) edge-pair scan, which
 * only runs for the common case of two beds that don't overlap at all. Plot
 * beds have at most a few dozen corners each (`MAX_REGION_VERTICES` caps a
 * single region at 1,000, but a hand-drawn bed has tens), so this is cheap in
 * practice.
 */
export function regionDistanceCm(a: PlotRegion, b: PlotRegion): number {
  if (a.vertices.some((vertex) => pointInPolygon(vertex, b.vertices))) return 0;
  if (b.vertices.some((vertex) => pointInPolygon(vertex, a.vertices))) return 0;

  let closest = Infinity;
  for (let i = 0; i < a.vertices.length; i += 1) {
    const a1 = a.vertices[i];
    const a2 = a.vertices[(i + 1) % a.vertices.length];
    for (let j = 0; j < b.vertices.length; j += 1) {
      const b1 = b.vertices[j];
      const b2 = b.vertices[(j + 1) % b.vertices.length];
      const distance = distanceSegmentToSegment(a1, a2, b1, b2);
      if (distance < closest) closest = distance;
      if (closest === 0) return 0;
    }
  }
  return closest;
}

/**
 * The distance below which two crops count as "planted nearby", centimetres.
 *
 * **Spacing-derived, not a fixed constant**: each crop's own between-row
 * clearance (via `resolveLatticeSpacing`'s `auto` rule — rows if the crop has
 * them, its derived-intensive figure otherwise, exactly as `fitPlant` would
 * resolve it) is the distance that crop already needs from its own kind; using
 * it as the "too close to a different, antagonistic crop" distance too reuses
 * data the record already carries rather than inventing a new figure, and it
 * scales sensibly — two sprawling crops get a wider berth than two crops
 * grown at 10 cm.
 *
 * **The larger of the two crops' figures wins**, not the mean. Antagonist
 * pairings are about shared disease and pest risk (blight, root-nodule
 * suppression — ADR 0008 §3), where the cost of an unwarranted warning (the
 * user sees an extra note) is far smaller than the cost of a missed one (a
 * genuine risk goes unflagged), so the more generous of the two distances is
 * the conservative — i.e. more often correct — choice.
 */
export function adjacencyThresholdCm(a: Spacing, b: Spacing): number {
  const latticeA = resolveLatticeSpacing(a, 'auto');
  const latticeB = resolveLatticeSpacing(b, 'auto');
  return Math.max(latticeA.betweenRowCm, latticeB.betweenRowCm);
}
