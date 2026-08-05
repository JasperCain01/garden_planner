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
 * has to hold that as UI state, not derive it from the polygon. **The tiles
 * below draw from that same state for the same reason**: fed from
 * `plot-store`'s committed region instead, a tile would start redrawing itself
 * the moment a corner was dragged on the canvas, showing a shape this picker
 * cannot rebuild (`shape-glyph.ts`).
 *
 * **Shape choice is a visual decision, so the control is visual (UI redesign
 * Phase 4, ADR 0033 §3).** Three radio buttons and a caption became three tiles
 * that draw the outline you would get, at the aspect your current dimensions
 * give it — `shape-glyph.ts` builds each one by calling the same engine factory
 * "Use this shape" applies, so a tile cannot illustrate a shape the button
 * wouldn't produce. Underneath they are still a native radio group in a
 * `<fieldset>`: one tab stop, arrow keys inside, selected state in the
 * accessibility tree with no `aria-*` at all (ADR 0032 §6's mechanic, now
 * shared via `ui/choice.module.css`).
 *
 * **The `<legend>` is visually hidden, and only this one is.** The panel above
 * says "Plot shape & size" and the tiles draw a rectangle, an L and a circle;
 * a second visible word "Shape" would restate both. The group still needs a
 * name in the accessibility tree, where there is no panel heading adjacent to
 * the radios — the same trade `palette/PlantPalette.tsx` makes for its category
 * chips. The conditions form's segmented controls keep their legends *visible*,
 * because "Acid / Neutral / Alkaline" genuinely does not say what it is of.
 *
 * The factories throw `RangeError` on a nonsensical dimension (zero, negative,
 * a notch as big as the plot); caught here and shown inline rather than
 * propagating, since a bad number in a form field is an ordinary user
 * mistake, not an exceptional one. Phase 4 moves that message **under the
 * field it concerns** rather than under the button, which is the review's ask
 * and is also where a screen reader announces it from: each dimension input
 * points at it with `aria-describedby`, so the error is part of the field's
 * announcement instead of a paragraph elsewhere on the page.
 */

import { useId, useState } from 'react';
import type { PlotRegion } from '@garden-planner/engine';
import { buildRegion, shapeGlyph, type Preset, type ShapeDimensions } from './shape-glyph.ts';
import styles from './ShapePicker.module.css';

export interface ShapePickerProps {
  /** Called with the built region once the user applies a preset. Never called if the dimensions don't build a valid shape. */
  readonly onApply: (region: PlotRegion) => void;
}

/** Reasonable starting dimensions (metres) for each preset — a modest allotment bed, not an empty form. */
const DEFAULT_DIMENSIONS: ShapeDimensions = {
  rectangle: { widthM: 3, heightM: 2 },
  lShape: { widthM: 4, heightM: 3, notchWidthM: 1.5, notchHeightM: 1 },
  circle: { diameterM: 2.5 },
};

const PRESET_LABELS: Readonly<Record<Preset, string>> = {
  rectangle: 'Rectangle',
  'l-shape': 'L-shape',
  circle: 'Circle',
};

const PRESETS: readonly Preset[] = ['rectangle', 'l-shape', 'circle'];

export function ShapePicker({ onApply }: ShapePickerProps) {
  const [preset, setPreset] = useState<Preset>('rectangle');
  const [dimensions, setDimensions] = useState<ShapeDimensions>(DEFAULT_DIMENSIONS);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  function handleApply(): void {
    // Built by the same function the tiles draw from, so "what the tile shows"
    // and "what the button applies" cannot drift apart. On failure the result
    // carries the factory's own sentence, which names the offending dimension.
    const built = buildRegion(preset, dimensions);
    if (!built.ok) {
      setError(built.message);
      return;
    }
    setError(null);
    onApply(built.region);
  }

  /** Update one preset's dimensions, leaving the other two presets' alone (each tile keeps drawing its own shape). */
  function setDimension<K extends keyof ShapeDimensions>(
    key: K,
    patch: Partial<ShapeDimensions[K]>,
  ): void {
    setDimensions((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  const fieldProps = {
    errorId,
    hasError: error !== null,
  };

  return (
    <div>
      <fieldset className={styles.presets}>
        <legend className="visually-hidden">Shape</legend>
        {PRESETS.map((option) => {
          const glyph = shapeGlyph(option, dimensions);
          return (
            <label key={option} className={styles.tile}>
              <input
                type="radio"
                name="plot-preset"
                className={styles.tileInput}
                value={option}
                checked={preset === option}
                onChange={() => setPreset(option)}
              />
              <span className={styles.tileBody}>
                <span className={styles.tileGlyph}>
                  {glyph === null ? (
                    // The dimensions don't currently build a shape — usually
                    // because a field is mid-edit. A dashed placeholder keeps
                    // the tile the same size, so the row doesn't jump while
                    // someone types (`shape-glyph.ts`).
                    <span className={styles.tileGlyphEmpty} aria-hidden="true" />
                  ) : (
                    <svg
                      viewBox={glyph.viewBox}
                      preserveAspectRatio="xMidYMid meet"
                      className={styles.tileSvg}
                      // Decorative: the tile's own label already names the
                      // shape, and the outline is the same information drawn.
                      aria-hidden="true"
                      focusable="false"
                    >
                      <polygon points={glyph.points} />
                    </svg>
                  )}
                </span>
                {PRESET_LABELS[option]}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className={styles.dimensions}>
        {preset === 'rectangle' && (
          <>
            <MetreField
              id="plot-rect-width"
              label="Width"
              value={dimensions.rectangle.widthM}
              onChange={(widthM) => setDimension('rectangle', { widthM })}
              {...fieldProps}
            />
            <MetreField
              id="plot-rect-height"
              label="Height"
              value={dimensions.rectangle.heightM}
              onChange={(heightM) => setDimension('rectangle', { heightM })}
              {...fieldProps}
            />
          </>
        )}

        {preset === 'l-shape' && (
          <>
            <MetreField
              id="plot-lshape-width"
              label="Width"
              value={dimensions.lShape.widthM}
              onChange={(widthM) => setDimension('lShape', { widthM })}
              {...fieldProps}
            />
            <MetreField
              id="plot-lshape-height"
              label="Height"
              value={dimensions.lShape.heightM}
              onChange={(heightM) => setDimension('lShape', { heightM })}
              {...fieldProps}
            />
            <MetreField
              id="plot-lshape-notch-width"
              label="Notch width"
              value={dimensions.lShape.notchWidthM}
              onChange={(notchWidthM) => setDimension('lShape', { notchWidthM })}
              {...fieldProps}
            />
            <MetreField
              id="plot-lshape-notch-height"
              label="Notch height"
              value={dimensions.lShape.notchHeightM}
              onChange={(notchHeightM) => setDimension('lShape', { notchHeightM })}
              {...fieldProps}
            />
          </>
        )}

        {preset === 'circle' && (
          <MetreField
            id="plot-circle-diameter"
            label="Diameter"
            value={dimensions.circle.diameterM}
            onChange={(diameterM) => setDimension('circle', { diameterM })}
            {...fieldProps}
          />
        )}
      </div>

      {/*
       * Inline under the fields it concerns, and referenced by every one of
       * them (`aria-describedby` above): the engine's message names the
       * offending dimension ("notch width (1000) must be less than the width
       * (400)"), so pointing each field at the one message says more than
       * splitting it per field and guessing which one the user meant.
       */}
      {error !== null && (
        <p role="alert" id={errorId} className={styles.error}>
          {error}
        </p>
      )}

      <button type="button" data-variant="primary" onClick={handleApply}>
        Use this shape
      </button>
    </div>
  );
}

interface MetreFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly errorId: string;
  readonly hasError: boolean;
}

/**
 * One dimension input, with its unit **inside** the field ("3 m") rather than
 * bracketed onto the label (UI redesign Phase 4).
 *
 * The unit still has to be *announced*, and a decorative "m" drawn over the
 * input is not: so the label's visible text is "Width" and its accessible name
 * is "Width (m)", with the unit in a `visually-hidden` span. That satisfies
 * WCAG 2.5.3 (the visible label is contained in the accessible name), keeps
 * every existing `getByLabelText(/width \(m\)/i)` working, and means a screen
 * reader hears the unit while the eye reads it in the field where the number
 * is. The alternative — `aria-describedby` pointing at the suffix — would
 * announce a bare "m" after the value, which is worse.
 */
function MetreField({ id, label, value, onChange, errorId, hasError }: MetreFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        <span className="visually-hidden"> (m)</span>
      </label>
      <div className={styles.measure}>
        <input
          id={id}
          type="number"
          className={styles.measureInput}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-describedby={hasError ? errorId : undefined}
          aria-invalid={hasError || undefined}
        />
        <span className={styles.unit} aria-hidden="true">
          m
        </span>
      </div>
    </div>
  );
}
