/**
 * Pure logic for turning a dnd-kit `DragEndEvent` — a plant dropped from the
 * palette — into a plot-centimetre position. This is the palette→canvas
 * *handoff* half of Stage 3.4's drag-and-drop; everything after the plant
 * has landed (drawing it, selecting it, dragging it around, removing it) is
 * react-konva's job inside `PlotCanvas.tsx`. See that file's module doc, and
 * `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md`, for why the two libraries
 * split the interaction this way.
 *
 * Kept separate from any component so the drop-point arithmetic is testable
 * with a plain object shaped like a `DragEndEvent`, no `DndContext`, no
 * pointer events, no DOM at all.
 */

import type { DragEndEvent } from '@dnd-kit/core';
import type { Plant, PlotRegion } from '@garden-planner/engine';
import { clampToBounds, pxToCm, type CmPoint } from './geometry.ts';

/** The id `PlotCanvas.tsx`'s droppable container registers under dnd-kit — the id a drag must land `over` for {@link resolveDrop} to accept it. */
export const CANVAS_DROPPABLE_ID = 'plot-canvas';

/** The drag data a palette entry's `useDraggable` attaches (`palette/PlantPalette.tsx`). */
export interface PaletteDragData {
  readonly plant: Plant;
}

/** What a successful drop resolves to: the plant that was dropped, and where, in the region's own centimetre frame. */
export interface ResolvedDrop {
  readonly plant: Plant;
  readonly position: CmPoint;
}

/**
 * Resolve a `DragEndEvent` to a drop, or `null` if it isn't one the canvas
 * should act on — the drag didn't end over the canvas, didn't carry a
 * palette plant, or dnd-kit never measured the dragged element's rect (rare:
 * only possible if a drag ends before any measurement occurs).
 *
 * The drop point used is the *dragged card's* rect centre after dnd-kit's
 * own translate (`active.rect.current.translated`), not a hand-recovered
 * pointer position — the palette entry's own element visually follows the
 * pointer via that same translate (`PlantPalette.tsx` applies it as a CSS
 * transform), so the two coincide by construction. That sidesteps having to
 * branch on `activatorEvent`'s several possible shapes (pointer, touch,
 * keyboard) to recover a client point by hand, and keeps this function
 * ignorant of *how* the drag started.
 *
 * The resolved position is clamped to the region's bounding box
 * ({@link clampToBounds}) — a sanity clamp, not a containment check; whether
 * a drop actually lands *inside* the outline is a validation question left
 * to Stage 3.5.
 */
export function resolveDrop(event: DragEndEvent, region: PlotRegion): ResolvedDrop | null {
  if (event.over === null || event.over.id !== CANVAS_DROPPABLE_ID) {
    return null;
  }

  const data = event.active.data.current as PaletteDragData | undefined;
  if (!data) {
    return null;
  }

  const translated = event.active.rect.current.translated;
  if (translated === null) {
    return null;
  }

  const pxPoint = {
    x: translated.left + translated.width / 2 - event.over.rect.left,
    y: translated.top + translated.height / 2 - event.over.rect.top,
  };

  return { plant: data.plant, position: clampToBounds(pxToCm(pxPoint, region), region) };
}
