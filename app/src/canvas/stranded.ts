/**
 * Which placements a reshape has left outside the plot outline (post-review
 * fix B3 — `docs/post-review-fixes-workplan.md`).
 *
 * Applying a smaller preset, or dragging corners inward in "Edit shape"
 * mode, doesn't move placements: their stored `(x, y)` is untouched, so a
 * plant that used to sit comfortably inside the outline can end up on the
 * soil surround with nothing on screen saying so — the original aesthetic
 * review's "smaller but real", open since the redesign's first phase. This
 * module answers exactly one question, *is a placement's position still
 * inside the current outline?*, so `PlotCanvas.tsx` can draw the honest
 * answer on the marker and the warnings dock can summarise it.
 *
 * **No new containment maths.** `pointInPolygon` already exists for the
 * engine's own packing routine (`packages/engine/src/spacing/geometry.ts`)
 * and is exported from the package root — reused here rather than
 * reimplemented, per this fix's own instruction to check the engine's
 * exports first before adding a second ray-cast. This module is a thin,
 * app-side wrapper plus the placements-shaped loop around it; no engine code
 * changes.
 */

import { pointInPolygon, type PlotRegion } from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';

/** Whether `point` (in the region's own centimetre frame) lies inside `region`'s outline. */
export function isInsideRegion(point: { x: number; y: number }, region: PlotRegion): boolean {
  return pointInPolygon(point, region.vertices);
}

/**
 * Every placement id whose stored position currently sits outside `region`'s
 * outline — deterministic and cheap enough to recompute on every render
 * (a straight-line loop, no caching), the same way `PlotCanvas.tsx` already
 * recomputes `visibleLabels` every time.
 */
export function strandedPlacementIds(
  placements: readonly PlacedPlant[],
  region: PlotRegion,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const placement of placements) {
    if (!isInsideRegion(placement, region)) {
      ids.add(placement.id);
    }
  }
  return ids;
}
