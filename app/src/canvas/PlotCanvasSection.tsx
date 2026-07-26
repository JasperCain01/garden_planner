/**
 * "3. Arrange your plants" — the page section wrapping `PlotCanvas.tsx`
 * (Workplan Stage 3.4). Composes the Konva scene with the plain-DOM pieces
 * around it: a pointer-accessible remove affordance for whatever's selected
 * (the canvas itself already supports Delete/Backspace and double-click —
 * see `PlotCanvas.tsx`) and the live density/count feedback panel.
 *
 * Reads `usePlotStore`'s `region` and `usePlacementsStore` directly, mirroring
 * `PlantPalette.tsx`'s convention of reading shared Zustand stores rather than
 * having props threaded down from `PlotDefinitionPage.tsx`.
 */

import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { PlacementFeedbackPanel } from './PlacementFeedbackPanel.tsx';
import { PlotCanvas } from './PlotCanvas.tsx';

export function PlotCanvasSection() {
  const region = usePlotStore((state) => state.region);
  const placements = usePlacementsStore((state) => state.placements);
  const selectedId = usePlacementsStore((state) => state.selectedId);
  const removePlacement = usePlacementsStore((state) => state.removePlacement);

  const selected = placements.find((placement) => placement.id === selectedId) ?? null;

  return (
    <section>
      <h2>3. Arrange your plants</h2>
      <p>
        Drag a plant from the palette above onto the plot below. Click a placed plant to select it,
        drag it to move it, and double-click, press Delete/Backspace, or use the button below to
        remove it.
      </p>
      <PlotCanvas region={region} />
      {selected !== null && (
        <p>
          Selected: {selected.plant.commonName}{' '}
          <button type="button" onClick={() => removePlacement(selected.id)}>
            Remove
          </button>
        </p>
      )}
      <PlacementFeedbackPanel
        placements={placements}
        region={region}
        activePlant={selected?.plant ?? null}
      />
    </section>
  );
}
