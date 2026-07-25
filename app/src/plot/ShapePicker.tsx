/**
 * The preset shape picker (Workplan Stage 3.2): rectangle / L-shape / circle,
 * sized by dimensions the user enters in metres, built into a `PlotRegion` via
 * the engine's factory functions
 * (`rectangleRegion`/`lShapeRegion`/`circleRegion`,
 * `packages/engine/src/spacing/region.ts`).
 *
 * Deliberately keeps its own metre-valued dimension state rather than reading
 * anything back off the produced `PlotRegion` — the region module's own doc
 * comment is explicit that "nothing remembers it was a preset", so a form
 * that wants to keep showing "width: 3m, height: 2m" after a preset is chosen
 * has to hold that as UI state, not derive it from the polygon.
 *
 * The factories throw `RangeError` on a nonsensical dimension (zero, negative,
 * a notch as big as the plot); caught here and shown inline rather than
 * propagating, since a bad number in a form field is an ordinary user
 * mistake, not an exceptional one.
 */

import { useState } from 'react';
import type { PlotRegion } from '@garden-planner/engine';
import { circleRegion, lShapeRegion, rectangleRegion } from '@garden-planner/engine';
import { metresToCm } from './units.ts';

type Preset = 'rectangle' | 'l-shape' | 'circle';

export interface ShapePickerProps {
  /** Called with the built region once the user applies a preset. Never called if the dimensions don't build a valid shape. */
  readonly onApply: (region: PlotRegion) => void;
}

/** Reasonable starting dimensions (metres) for each preset — a modest allotment bed, not an empty form. */
const DEFAULT_RECTANGLE = { widthM: 3, heightM: 2 };
const DEFAULT_L_SHAPE = { widthM: 4, heightM: 3, notchWidthM: 1.5, notchHeightM: 1 };
const DEFAULT_CIRCLE = { diameterM: 2.5 };

export function ShapePicker({ onApply }: ShapePickerProps) {
  const [preset, setPreset] = useState<Preset>('rectangle');
  const [rectangle, setRectangle] = useState(DEFAULT_RECTANGLE);
  const [lShape, setLShape] = useState(DEFAULT_L_SHAPE);
  const [circle, setCircle] = useState(DEFAULT_CIRCLE);
  const [error, setError] = useState<string | null>(null);

  function handleApply(): void {
    try {
      let region: PlotRegion;
      if (preset === 'rectangle') {
        region = rectangleRegion(metresToCm(rectangle.widthM), metresToCm(rectangle.heightM));
      } else if (preset === 'l-shape') {
        region = lShapeRegion({
          widthCm: metresToCm(lShape.widthM),
          heightCm: metresToCm(lShape.heightM),
          notchWidthCm: metresToCm(lShape.notchWidthM),
          notchHeightCm: metresToCm(lShape.notchHeightM),
        });
      } else {
        region = circleRegion(metresToCm(circle.diameterM));
      }
      setError(null);
      onApply(region);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'could not build that shape');
    }
  }

  return (
    <fieldset>
      <legend>Shape</legend>

      <label>
        <input
          type="radio"
          name="plot-preset"
          value="rectangle"
          checked={preset === 'rectangle'}
          onChange={() => setPreset('rectangle')}
        />
        Rectangle
      </label>
      <label>
        <input
          type="radio"
          name="plot-preset"
          value="l-shape"
          checked={preset === 'l-shape'}
          onChange={() => setPreset('l-shape')}
        />
        L-shape
      </label>
      <label>
        <input
          type="radio"
          name="plot-preset"
          value="circle"
          checked={preset === 'circle'}
          onChange={() => setPreset('circle')}
        />
        Circle
      </label>

      {preset === 'rectangle' && (
        <div>
          <label htmlFor="plot-rect-width">Width (m)</label>
          <input
            id="plot-rect-width"
            type="number"
            value={rectangle.widthM}
            onChange={(event) =>
              setRectangle((r) => ({ ...r, widthM: Number(event.target.value) }))
            }
          />
          <label htmlFor="plot-rect-height">Height (m)</label>
          <input
            id="plot-rect-height"
            type="number"
            value={rectangle.heightM}
            onChange={(event) =>
              setRectangle((r) => ({ ...r, heightM: Number(event.target.value) }))
            }
          />
        </div>
      )}

      {preset === 'l-shape' && (
        <div>
          <label htmlFor="plot-lshape-width">Width (m)</label>
          <input
            id="plot-lshape-width"
            type="number"
            value={lShape.widthM}
            onChange={(event) => setLShape((s) => ({ ...s, widthM: Number(event.target.value) }))}
          />
          <label htmlFor="plot-lshape-height">Height (m)</label>
          <input
            id="plot-lshape-height"
            type="number"
            value={lShape.heightM}
            onChange={(event) => setLShape((s) => ({ ...s, heightM: Number(event.target.value) }))}
          />
          <label htmlFor="plot-lshape-notch-width">Notch width (m)</label>
          <input
            id="plot-lshape-notch-width"
            type="number"
            value={lShape.notchWidthM}
            onChange={(event) =>
              setLShape((s) => ({ ...s, notchWidthM: Number(event.target.value) }))
            }
          />
          <label htmlFor="plot-lshape-notch-height">Notch height (m)</label>
          <input
            id="plot-lshape-notch-height"
            type="number"
            value={lShape.notchHeightM}
            onChange={(event) =>
              setLShape((s) => ({ ...s, notchHeightM: Number(event.target.value) }))
            }
          />
        </div>
      )}

      {preset === 'circle' && (
        <div>
          <label htmlFor="plot-circle-diameter">Diameter (m)</label>
          <input
            id="plot-circle-diameter"
            type="number"
            value={circle.diameterM}
            onChange={(event) =>
              setCircle((c) => ({ ...c, diameterM: Number(event.target.value) }))
            }
          />
        </div>
      )}

      <button type="button" onClick={handleApply}>
        Use this shape
      </button>

      {error !== null && <p role="alert">{error}</p>}
    </fieldset>
  );
}
