/**
 * A short closed vocabulary as a **segmented control**: every option visible at
 * once, one press to change the answer (UI redesign Phase 4,
 * `docs/ui-aesthetic-review.md` §"Phase 4" — "selects become segmented controls
 * where options ≤4").
 *
 * Underneath it is a native radio group in a `<fieldset>`, for the reasons
 * ADR 0032 §6 already recorded for the palette's filter chips and ADR 0033 §2
 * restates: one tab stop with arrow keys inside it, the selected state in the
 * accessibility tree without an `aria-*` attribute, and `:checked` /
 * `:focus-visible` doing the styling so React never has to. The invisible half
 * of the mechanic is shared with those chips and with the shape tiles —
 * `ui/choice.module.css`.
 *
 * **The `<legend>` is the field's label, and it is visible.** A `<select>`
 * carries its name in a `<label>`; a radio group carries it in a `<legend>`,
 * and dropping it would leave three buttons reading "Acid / Neutral /
 * Alkaline" with nothing saying what is acid. That is also why this is a real
 * `<fieldset>` rather than a `<div role="radiogroup">`: the grouping is the
 * thing being announced, and the element that means it is the one that has it.
 *
 * **Only for genuinely short vocabularies, and four is where it folds.** In a
 * 300px column three options sit comfortably across; four do not — measured, a
 * soil facet's segments get ~63px each and "Alkaline" needs 67 — so four are
 * laid out as a 2 × 2 block instead of being shrunk, abbreviated, or clipped.
 * Past four a `<select>` is both smaller and easier to read, which is why soil
 * *texture* (five options) stays one; the caller decides that, because the
 * caller knows the width.
 */

import { useId } from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  /** What the user reads. The engine's vocabularies are hyphenated slugs (`partial-shade`), which are values, not words. */
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** The field's name — rendered as the group's `<legend>`, which is what a screen reader announces before each option. */
  readonly legend: string;
  /** The radio group's shared `name`. Must be unique on the page: it is what makes these radios one group rather than several. */
  readonly name: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  // The legend is associated with the group by the `<fieldset>` itself, but the
  // id gives each option's own `<label>` a stable, collision-free suffix even
  // when two instances of this control share a page.
  const groupId = useId();

  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>{legend}</legend>
      {/* Two columns from four options, one row otherwise — see the doc above
          for why four is the fold, and the stylesheet for what it draws. */}
      <div className={styles.segments} data-columns={options.length > 3 ? 2 : undefined}>
        {options.map((option) => (
          <label key={option.value} className={styles.segment}>
            <input
              type="radio"
              className={styles.input}
              name={`${name}-${groupId}`}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.body}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
