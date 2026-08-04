/**
 * "Check for problems" — `DESIGN.md` §1 step 4, "validate continuously",
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
 * ## The dock (UI redesign Phase 4, ADR 0033 §1 and §5)
 *
 * This list is the highest-value live feedback the app produces, and until this
 * phase it was the *last* thing in a column that overflowed by 590px — with two
 * crops placed, its top edge sat 263px below the bottom of the screen. Phase 1
 * moved it beside the canvas and that was not enough; Phase 4 **pins** it. The
 * settings column's two form panels scroll above it and this stays put, which
 * is what makes "change the thing, see the warning change" a single glance
 * rather than a scroll (`PlotDefinitionPage.module.css`).
 *
 * Three consequences visible in the markup here:
 *
 * - **A count badge per severity, most urgent first** (`severity.ts`'s
 *   `severityCounts`). A pinned dock is capped, so a plot with a dozen problems
 *   scrolls inside it; "2 ×, 1 !" on the heading's own line is the summary that
 *   survives being scrolled, and one a heading alone wasn't giving.
 * - **The severity word became `SeverityIcon`** — same glyph the canvas badges
 *   a marker with, same word in its accessible name. See that component.
 * - **The two `<h3>`s stayed**, deliberately, and now carry their sections'
 *   counts. Phase 3 retired 144 per-item headings and recorded why (ADR 0032
 *   §3); neither of its two reasons applies here. These are not inside a
 *   `role="button"` subtree that ARIA makes presentational, and two headings
 *   are not 144 — they are the only way to jump between the two lists inside a
 *   dock that scrolls, which is exactly what document structure is for.
 */

import type { CompanionSuggestion, Plant, Warning } from '@garden-planner/engine';
import { SeverityIcon } from './SeverityIcon.tsx';
import { severityCounts } from './severity.ts';
import styles from './WarningsPanel.module.css';

export interface WarningsPanelProps {
  readonly warnings: readonly Warning[];
  readonly suggestions: readonly CompanionSuggestion[];
  /** The current runtime plant list (`usePlantList()`), used only to resolve a suggestion's bare `suggestedPlantId` to a display name. */
  readonly plants: readonly Plant[];
  /** Called with a placement id when the user asks to be shown which marker a warning or suggestion concerns — selects it *and* scrolls it into view (`WarningsSection.tsx`). */
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
  const counts = severityCounts(warnings);

  return (
    <div className={styles.dock}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Warnings</h3>
        {counts.length > 0 && (
          <p className={styles.badges}>
            {counts.map(({ severity, count }) => (
              // One badge per severity present. The count and the icon are one
              // labelled unit ("2 severe") rather than a number next to an
              // unlabelled mark, so it reads the same aloud as on screen.
              <span
                key={severity}
                className={styles.badge}
                data-severity={severity}
                aria-label={`${count} ${severity}`}
              >
                <span aria-hidden="true">{count}</span>
                <SeverityIcon severity={severity} />
              </span>
            ))}
          </p>
        )}
      </div>

      {warnings.length === 0 ? (
        <p className={styles.empty}>No problems &mdash; looking good 🌿</p>
      ) : (
        <ul className={styles.list}>
          {warnings.map((warning) => (
            <li
              key={warningKey(warning)}
              className={`${styles.item} ${styles.warningItem}`}
              data-severity={warning.severity}
            >
              <SeverityIcon severity={warning.severity} />
              <span className={styles.reason}>{warning.reason}</span>
              <button
                type="button"
                className={styles.showMe}
                onClick={() => onFocusPlacement(warning.subjects[0].placementId)}
              >
                Show me
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Companion suggestions</h3>
        {suggestions.length > 0 && (
          <p className={styles.badges}>
            <span className={styles.countBadge}>{suggestions.length}</span>
          </p>
        )}
      </div>

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
                <strong className={styles.suggested}>
                  {suggested?.commonName ?? suggestion.suggestedPlantId}
                </strong>
                <span className={styles.evidence}>
                  {suggestion.evidence === 'well-supported' ? 'Well-supported' : 'Traditional'}
                </span>
                <span className={styles.reason}>{suggestion.reason}</span>
                <button
                  type="button"
                  className={styles.showMe}
                  onClick={() => onFocusPlacement(suggestion.forPlacementId)}
                >
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
