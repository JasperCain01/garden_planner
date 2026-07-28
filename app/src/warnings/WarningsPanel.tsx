/**
 * "4. Check for problems" — `DESIGN.md` §1 step 4, "validate continuously",
 * turned into UI. Ordinary DOM/JSX (no Konva), so — like
 * `canvas/PlacementFeedbackPanel.tsx` and unlike `canvas/PlotCanvas.tsx` — this
 * is component-tested directly with `@testing-library/react`
 * (`WarningsPanel.test.tsx`), per ADR 0017's test-strategy precedent.
 *
 * Takes already-computed engine output as props rather than reading stores
 * itself (`warnings/evaluate-canvas.ts`'s `CanvasWarnings`, plus the runtime
 * plant list to resolve a companion suggestion's bare `suggestedPlantId` into
 * a display name — the same resolve-at-the-point-of-display pattern
 * `PlantPalette.tsx` follows) — this keeps the component testable with plain
 * fixtures, with `WarningsSection.tsx` owning the store wiring.
 *
 * Every warning's own `reason` and every suggestion's own `reason` are shown
 * verbatim: the engine's docs are explicit that these are deliverable
 * sentences, not debug aids, so this component never re-derives or
 * paraphrases one.
 *
 * **Styling (UI redesign Phase 0).** Each row is a card with a
 * severity-coloured edge, styled from `WarningsPanel.module.css`; the severity
 * colour now comes from the `--severity-*` tokens rather than an inline
 * `style` fed by `severityColor` (which stays the source of truth for the
 * Konva-drawn canvas badge — see `styles/tokens.css`). Docking this list
 * beside the canvas is Phase 4's job (`docs/ui-aesthetic-review.md`).
 */

import type { CompanionSuggestion, Plant, Warning } from '@garden-planner/engine';
import styles from './WarningsPanel.module.css';

export interface WarningsPanelProps {
  readonly warnings: readonly Warning[];
  readonly suggestions: readonly CompanionSuggestion[];
  /** The current runtime plant list (`usePlantList()`), used only to resolve a suggestion's bare `suggestedPlantId` to a display name. */
  readonly plants: readonly Plant[];
  /** Called with a placement id when the user asks to be shown which marker a warning or suggestion concerns (e.g. selects it on the canvas). */
  readonly onFocusPlacement: (placementId: string) => void;
}

/** A stable-enough key for one warning across renders: its kind plus every placement it names. */
function warningKey(warning: Warning): string {
  return `${warning.kind}:${warning.subjects.map((subject) => subject.placementId).join(',')}`;
}

export function WarningsPanel({
  warnings,
  suggestions,
  plants,
  onFocusPlacement,
}: WarningsPanelProps) {
  return (
    <div>
      <h3>Warnings</h3>
      {warnings.length === 0 ? (
        <p className={styles.empty}>No problems detected with what&rsquo;s currently placed.</p>
      ) : (
        <ul className={styles.list}>
          {warnings.map((warning) => (
            <li key={warningKey(warning)} className={styles.item} data-severity={warning.severity}>
              <strong className={styles.severity}>{warning.severity.toUpperCase()}</strong>
              <span className={styles.reason}>{warning.reason}</span>
              <button
                type="button"
                onClick={() => onFocusPlacement(warning.subjects[0].placementId)}
              >
                Show me
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>Companion suggestions</h3>
      {suggestions.length === 0 ? (
        <p className={styles.empty}>No companion suggestions for what&rsquo;s currently placed.</p>
      ) : (
        <ul className={styles.list}>
          {suggestions.map((suggestion) => {
            const suggested = plants.find((plant) => plant.id === suggestion.suggestedPlantId);
            return (
              <li
                key={`${suggestion.forPlacementId}:${suggestion.suggestedPlantId}`}
                className={styles.item}
              >
                <strong>{suggested?.commonName ?? suggestion.suggestedPlantId}</strong>
                <span className={styles.evidence}>
                  {suggestion.evidence === 'well-supported' ? 'Well-supported' : 'Traditional'}
                </span>
                <span className={styles.reason}>{suggestion.reason}</span>
                <button type="button" onClick={() => onFocusPlacement(suggestion.forPlacementId)}>
                  Show me
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
