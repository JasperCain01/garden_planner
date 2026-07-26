/**
 * Thin hook wiring `evaluate-canvas.ts`'s pure `evaluateCanvasWarnings` to the
 * shared stores — the same "read `usePlotStore`/`usePlacementsStore` directly,
 * no prop threading" convention `PlantPalette.tsx` and `PlotCanvasSection.tsx`
 * already follow, plus the same defensive `resolvePlotConditions` try/catch
 * `PlantPalette.tsx` uses (a mid-edit growing-conditions form can briefly be
 * invalid; this hook returns `null` rather than throwing through a render).
 *
 * No logic of its own beyond that wiring, so — matching
 * `canvas/useCanvasDropHandler.ts`'s own precedent (ADR 0017) — this file has
 * no dedicated test; `evaluate-canvas.ts` is what's actually under test.
 */

import { useMemo } from 'react';
import { resolvePlotConditions, type PlotRegion } from '@garden-planner/engine';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { evaluateCanvasWarnings, type CanvasWarnings } from './evaluate-canvas.ts';

/**
 * `null` when the plot's growing-conditions input doesn't currently resolve
 * (mirrors `PlantPalette`'s own `conditions === null` case) — the caller
 * should treat that the same way the palette does, e.g. by showing nothing
 * rather than a stale or fabricated evaluation.
 */
export function useCanvasWarnings(region: PlotRegion): CanvasWarnings | null {
  const placements = usePlacementsStore((state) => state.placements);
  const conditionsInput = usePlotStore((state) => state.conditionsInput);

  const conditions = useMemo(() => {
    try {
      return resolvePlotConditions(conditionsInput);
    } catch {
      return null;
    }
  }, [conditionsInput]);

  return useMemo(
    () => (conditions === null ? null : evaluateCanvasWarnings(placements, region, conditions)),
    [placements, region, conditions],
  );
}
