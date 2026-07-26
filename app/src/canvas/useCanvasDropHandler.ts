/**
 * Wires a dnd-kit `DragEndEvent` to the placements store: a plant dropped on
 * the canvas gets added at the resolved drop position. Pass the returned
 * callback to `<DndContext onDragEnd={...}>` (`PlotDefinitionPage.tsx`,
 * Workplan Stage 3.4) — this is the one piece of the palette→canvas handoff
 * that has to run inside a React component (it calls the placements store's
 * action), so it's kept to a thin hook over the pure `resolveDrop` (`drop.ts`).
 */

import { useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { PlotRegion } from '@garden-planner/engine';
import { usePlacementsStore } from '../state/placements-store.ts';
import { resolveDrop } from './drop.ts';

/** Returns a `DragEndEvent` handler that places the dropped plant against `region`, or does nothing for a drag that didn't land a plant on the canvas (see `resolveDrop`). */
export function useCanvasDropHandler(region: PlotRegion): (event: DragEndEvent) => void {
  const addPlacement = usePlacementsStore((state) => state.addPlacement);

  return useCallback(
    (event: DragEndEvent) => {
      const drop = resolveDrop(event, region);
      if (drop !== null) {
        addPlacement(drop.plant, drop.position);
      }
    },
    [region, addPlacement],
  );
}
