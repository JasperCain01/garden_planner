/**
 * Wires a dnd-kit `DragEndEvent` to the placements store: a plant dropped on
 * the canvas gets added at the resolved drop position. Pass the returned
 * callback to `<DndContext onDragEnd={...}>` (`PlotDefinitionPage.tsx`,
 * Workplan Stage 3.4) — this is the one piece of the palette→canvas handoff
 * that has to run inside a React component (it calls the placements store's
 * action), so it's kept to a thin hook over the pure `resolveDrop` (`drop.ts`).
 *
 * **The scale comes from the store, not from the caller** (UI redesign Phase
 * 2). `PlotDefinitionPage` owns the `DndContext` because it composes both ends
 * of the drag, but it sits above the canvas region and has no way to know what
 * scale that region measured itself into. `useCanvasPxPerCm` reads it from
 * `state/canvas-view-store.ts` instead — see that store's doc for why this
 * particular consumer is the reason the scale lives in a store at all.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { PlotRegion } from '@garden-planner/engine';
import { usePlacementsStore } from '../state/placements-store.ts';
import { resolveDrop } from './drop.ts';
import { useCanvasPxPerCm } from './useCanvasScale.ts';

/** Returns a `DragEndEvent` handler that places the dropped plant against `region`, or does nothing for a drag that didn't land a plant on the canvas (see `resolveDrop`). */
export function useCanvasDropHandler(region: PlotRegion): (event: DragEndEvent) => void {
  const addPlacement = usePlacementsStore((state) => state.addPlacement);
  const pxPerCm = useCanvasPxPerCm();

  /*
   * The pointer's last known client position.
   *
   * `resolveDrop` needs where the pointer *finished*, and — see its doc
   * comment — a `DragEndEvent` cannot supply it: dnd-kit's `delta` is a
   * transform that includes a scroll adjustment, and the palette's crop list
   * auto-scrolls under the pointer during precisely this drag. Measured in a
   * real browser, trusting `delta` put a drop aimed at the plot's centre 12 cm
   * high on a 2m-deep bed.
   *
   * A ref rather than state, and a window listener rather than a React one:
   * nothing renders from this value, it changes at pointer-move frequency, and
   * the events have to be seen wherever they happen — including over the
   * palette card the user is actually dragging. `pointerup` is listened for
   * too because a drag can end without a final `pointermove`.
   */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function record(event: PointerEvent): void {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    }
    window.addEventListener('pointermove', record, { passive: true });
    window.addEventListener('pointerup', record, { passive: true });
    return () => {
      window.removeEventListener('pointermove', record);
      window.removeEventListener('pointerup', record);
    };
  }, []);

  return useCallback(
    (event: DragEndEvent) => {
      const drop = resolveDrop(event, region, pxPerCm, pointerRef.current);
      if (drop !== null) {
        addPlacement(drop.plant, drop.position);
      }
    },
    [region, pxPerCm, addPlacement],
  );
}
