/**
 * The plot-definition page (Workplan Stage 3.2, extended in 3.3) —
 * `DESIGN.md` §1 steps 1–2 of the core loop. Composes the plot-definition
 * pieces against the plot store (`state/plot-store.ts`): pick a preset
 * shape, adjust its outline free-form, describe the growing conditions —
 * and, as of Stage 3.3, the ranked plant palette right below it. This is
 * what `routes/Home` renders as the app's index route (Stage 3.1 left `Home`
 * as a placeholder specifically for this to replace — see that route's
 * history in `docs/stage-3.1-brief.md`).
 *
 * **Why the palette lives on this page rather than a separate route:** see
 * `docs/architecture.md`'s Stage 3.3 note. Short version — `DESIGN.md`'s
 * "describe → discover → arrange → validate" loop reads as one continuous
 * flow, not four separate pages, and Stage 3.4's canvas will want the
 * palette visible *alongside* placement (drag a plant from the palette onto
 * the canvas) rather than navigated away from.
 */

import { usePlotStore } from '../state/plot-store.ts';
import { PlantPalette } from '../palette/PlantPalette.tsx';
import { PlotConditionsForm } from './PlotConditionsForm.tsx';
import { PlotOutlineEditor } from './PlotOutlineEditor.tsx';
import { ShapePicker } from './ShapePicker.tsx';

export function PlotDefinitionPage() {
  const region = usePlotStore((state) => state.region);
  const setRegion = usePlotStore((state) => state.setRegion);
  const conditionsInput = usePlotStore((state) => state.conditionsInput);
  const setConditionsInput = usePlotStore((state) => state.setConditionsInput);

  return (
    <section>
      <h2>1. Define your plot</h2>
      <p>
        Start from a preset shape, then drag, add or remove corners until the outline matches your
        real plot.
      </p>
      <ShapePicker onApply={setRegion} />
      <PlotOutlineEditor region={region} onChange={setRegion} />
      <PlotConditionsForm value={conditionsInput} onChange={setConditionsInput} />
      <PlantPalette />
    </section>
  );
}
