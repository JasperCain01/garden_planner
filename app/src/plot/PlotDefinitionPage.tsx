/**
 * The plot-definition page (Workplan Stage 3.2) — `DESIGN.md` §1 step 1 of
 * the core loop. Composes the three pieces of this stage against the plot
 * store (`state/plot-store.ts`): pick a preset shape, adjust its outline
 * free-form, and describe the growing conditions. This is what `routes/Home`
 * now renders as the app's index route (Stage 3.1 left `Home` as a
 * placeholder specifically for this stage to replace — see that route's
 * history in `docs/stage-3.1-brief.md`).
 *
 * Nothing here calls into the plant list or the suitability engine — scoring
 * and the palette are Stage 3.3's job. This page's whole output is the two
 * values the store already holds: a `PlotRegion` and a `PlotConditionsInput`.
 */

import { usePlotStore } from '../state/plot-store.ts';
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
    </section>
  );
}
