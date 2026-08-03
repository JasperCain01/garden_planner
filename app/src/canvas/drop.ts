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
 * palette plant, or there was no way to work out where it ended.
 *
 * **Where the drop point comes from, and why that changed in UI redesign
 * Phase 2.** Until this phase it was always the *dragged card's* rect centre
 * after dnd-kit's translate (`active.rect.current.translated`), on the
 * reasoning that the card follows the pointer so the two coincide. They don't
 * quite: the card is translated by the pointer's *delta*, so its centre stays
 * wherever it was relative to the grab point — and a palette row is ~320px
 * wide and can be hundreds of pixels tall, so "wherever it was" is a
 * substantial offset. That was invisible while the stage was drawn at
 * 0.6 px/cm, because the offset converted to a distance larger than the whole
 * plot and got flattened by {@link clampToBounds} anyway. Fitted to the
 * region, the same offset is a real number of centimetres and the plant lands
 * somewhere the user didn't drop it — visibly, next to a grid that now shows
 * them exactly how far off it was.
 *
 * So the pointer's own position wins when there is one — and it is passed in
 * as `pointerClient` rather than reconstructed from the event, because **the
 * event cannot supply it**. `activatorEvent`'s client point plus dnd-kit's
 * `delta` looks like the answer and isn't: `delta` is dnd-kit's *transform*,
 * which includes a scroll adjustment so the dragged card stays under the
 * pointer when its scroll container moves — and the palette's crop list
 * auto-scrolls under the pointer during exactly this drag. Measured against a
 * real browser, that put a drop aimed at the plot's centre 12 cm high, with
 * the horizontal axis (which doesn't scroll) exact. `useCanvasDropHandler`
 * tracks the real pointer instead.
 *
 * The card-rect fallback is kept, unchanged, for the case it was always
 * *right* for — a **keyboard** drag (dnd-kit's `KeyboardSensor`, ADR 0026),
 * where there is no pointer at all and the thing the user has been moving with
 * the arrow keys really is the card. Which case applies is decided by the
 * activator event's own shape, not by whether a pointer position happens to be
 * available, so a stale pointer from before a keyboard drag can never be
 * mistaken for the drop point.
 *
 * The resolved position is clamped to the region's bounding box
 * ({@link clampToBounds}) — a sanity clamp, not a containment check; whether
 * a drop actually lands *inside* the outline is a validation question left
 * to Stage 3.5.
 *
 * @param pxPerCm - the scale the canvas is **currently drawn at**
 * (`useCanvasScale`), not a constant. This parameter is the reason
 * `geometry.ts` stopped defaulting its scale in UI redesign Phase 2: before
 * that, this function converted with the fixed `PX_PER_CM` while the stage was
 * drawn at whatever it liked, and the only symptom was a plant landing
 * somewhere the user hadn't dropped it — silently, with every test still
 * green. A required parameter makes that a compile error instead.
 * @param pointerClient - where the pointer was when the drag ended, in client
 * (viewport) coordinates, or `null` if none was observed. Ignored for a
 * keyboard drag. See above for why this can't be recovered from `event`.
 */
export function resolveDrop(
  event: DragEndEvent,
  region: PlotRegion,
  pxPerCm: number,
  pointerClient: { x: number; y: number } | null,
): ResolvedDrop | null {
  if (event.over === null || event.over.id !== CANVAS_DROPPABLE_ID) {
    return null;
  }

  const data = event.active.data.current as PaletteDragData | undefined;
  if (!data) {
    return null;
  }

  const clientPoint = endClientPoint(event, pointerClient);
  if (clientPoint === null) {
    return null;
  }

  const pxPoint = {
    x: clientPoint.x - event.over.rect.left,
    y: clientPoint.y - event.over.rect.top,
  };

  return { plant: data.plant, position: clampToBounds(pxToCm(pxPoint, region, pxPerCm), region) };
}

/**
 * Where the drag finished, in client (viewport) coordinates: the observed
 * pointer for a pointer drag, else the dragged card's centre, else `null` —
 * see {@link resolveDrop} for why in that order.
 *
 * `null` means dnd-kit never measured the dragged element and there is no
 * pointer position to fall back on, which in practice needs a keyboard drag
 * that ended before any measurement occurred.
 */
function endClientPoint(
  event: DragEndEvent,
  pointerClient: { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (pointerClient !== null && isPointerDrag(event.activatorEvent)) {
    return pointerClient;
  }
  const translated = event.active.rect.current.translated;
  if (translated === null) {
    return null;
  }
  return {
    x: translated.left + translated.width / 2,
    y: translated.top + translated.height / 2,
  };
}

/**
 * Whether a drag was started by a pointer at all, read off the activator
 * event's own shape: a `PointerEvent`/`MouseEvent` carries
 * `clientX`/`clientY`, a `TouchEvent` carries them on its first touch, and a
 * `KeyboardEvent` has neither — which is the case this exists to identify.
 */
function isPointerDrag(activator: Event): boolean {
  const { clientX, clientY } = activator as Partial<MouseEvent>;
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    return true;
  }
  return (activator as Partial<TouchEvent>).touches?.[0] !== undefined;
}
