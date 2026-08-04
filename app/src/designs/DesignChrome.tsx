/**
 * The header's design controls (UI redesign Phase 5): Undo, Redo, and the
 * button that opens the designs switcher.
 *
 * **Three stops, not six, and they are the app's first three.** Before this
 * phase the header was an `<h1>` wrapping a `<Link>` and nothing else — one tab
 * stop, and the app's first, immediately followed by the two skip links that
 * bypass the palette (`plot/SkipLinks.tsx`). Anything added here lands *between*
 * them, which is a cost every keyboard user pays on every page load, so the
 * count was the constraint this component was designed against rather than an
 * afterthought: undo and redo are the two the review asks for by name, and
 * everything else the switcher does lives behind the third. ADR 0034 §6 records
 * what was measured either side, and why the skip links were not moved above
 * the header to compensate.
 *
 * **The buttons say what they will undo.** `aria-label` is "Undo planting
 * Tomato", not "Undo" — derived from the history's own labels
 * (`state/design.ts`'s `describeEdit`). That is the affordance the "Clear all"
 * confirmation dialog was replaced *by*: a user who has just emptied their plot
 * needs to know the way back exists, and a button that names the thing it will
 * bring back is that, where a bare "Undo" is a guess.
 *
 * **Only on the workspace.** `NotFound` renders through the same shell, and
 * undo/redo for a plot you cannot see is a control with no observable effect;
 * the switcher is worse, since loading a design would leave you on the
 * not-found page looking at nothing. The route match is the condition, so the
 * header on that page is exactly what it always was — a wordmark and a link
 * back.
 */

import { useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useDesignHistory } from '../state/design-history.ts';
import { useDesignsStore } from '../state/designs-store.ts';
import { useUndoRedoShortcuts } from './useUndoRedoShortcuts.ts';
import { DesignsDialog } from './DesignsDialog.tsx';
import styles from './DesignChrome.module.css';

export function DesignChrome() {
  const onWorkspace = useMatch('/') !== null;
  const undo = useDesignHistory((state) => state.undo);
  const redo = useDesignHistory((state) => state.redo);
  const undoLabel = useDesignHistory((state) => state.undoLabel);
  const redoLabel = useDesignHistory((state) => state.redoLabel);
  const designs = useDesignsStore((state) => state.designs);
  const activeId = useDesignsStore((state) => state.activeId);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // The keyboard shortcuts are bound whether or not the controls are drawn, so
  // that Ctrl+Z is not a thing that stops working when the route changes and
  // then silently means "undo my browser's idea of a text edit" instead.
  useUndoRedoShortcuts();

  if (!onWorkspace) {
    return null;
  }

  const activeName = designs.find((design) => design.id === activeId)?.name ?? 'Untitled design';

  return (
    <div className={styles.chrome}>
      <div className={styles.history} role="group" aria-label="Undo and redo">
        <button
          type="button"
          className={styles.iconButton}
          onClick={undo}
          disabled={undoLabel === null}
          aria-label={undoLabel === null ? 'Undo (nothing to undo)' : `Undo ${undoLabel}`}
          title={undoLabel === null ? 'Nothing to undo' : `Undo ${undoLabel} (Ctrl+Z)`}
        >
          <span aria-hidden="true">↶</span>
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={redo}
          disabled={redoLabel === null}
          aria-label={redoLabel === null ? 'Redo (nothing to redo)' : `Redo ${redoLabel}`}
          title={redoLabel === null ? 'Nothing to redo' : `Redo ${redoLabel} (Ctrl+Shift+Z)`}
        >
          <span aria-hidden="true">↷</span>
        </button>
      </div>

      {/*
       * The visible text is the whole accessible name, on purpose: WCAG 2.5.3
       * wants the visible label contained in the name, and a design called
       * "Untitled design 2" is only distinguishable from "Untitled design" if
       * the name is spoken in full. It truncates with an ellipsis at narrow
       * widths rather than being hidden, because `display: none` would take the
       * name out of the accessibility tree along with the pixels.
       */}
      <button type="button" className={styles.designsButton} onClick={() => setSwitcherOpen(true)}>
        <span aria-hidden="true">🗂</span> Designs:{' '}
        <span className={styles.designName}>{activeName}</span>
      </button>

      <DesignsDialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
