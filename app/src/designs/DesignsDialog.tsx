/**
 * The named-designs switcher (UI redesign Phase 5) — "play with different
 * garden ideas", which the review notes "is cheap once serialisation exists".
 *
 * **A dialog off one header button, not a control cluster in the header.** The
 * review sketches save/load/duplicate/delete in the header itself. The header
 * is the app's **first tab stop** and the one piece of chrome shared with
 * `NotFound`, so every control put there is a stop every keyboard user pays on
 * every page load, before the skip links (`plot/SkipLinks.tsx`). Four controls
 * would have cost four; one button that opens this costs one, and the switcher
 * gets a whole dialog's worth of room to say which design is open, how many
 * plants are on it and when it was last edited — none of which fits on a chip
 * in a 56px band. ADR 0034 §6 records the tab-stop arithmetic.
 *
 * **There is no "Save".** The open design autosaves on every edit
 * (`state/designs-store.ts`), so a save command would be a button that does
 * nothing to a state that cannot exist. What is here is everything that
 * genuinely branches.
 *
 * **Delete confirms; "Clear all" no longer does.** That is the same rule
 * applied twice, not an inconsistency: confirmation follows *reversibility*,
 * not destructiveness. Clearing the plot is one Ctrl+Z away (ADR 0034 §5);
 * deleting a design is not, because the undo history is per-design and a
 * deleted design takes its own history with it. The confirmation is inline —
 * the row becomes its own question — rather than a second `<dialog>`, because a
 * modal inside a modal is a focus-trap inside a focus-trap and the browser owns
 * both.
 */

import { useState } from 'react';
import { ModalDialog } from '../ui/ModalDialog.tsx';
import { useDesignsStore } from '../state/designs-store.ts';
import styles from './DesignsDialog.module.css';

export interface DesignsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function DesignsDialog({ open, onClose }: DesignsDialogProps) {
  const designs = useDesignsStore((state) => state.designs);
  const activeId = useDesignsStore((state) => state.activeId);
  const newDesign = useDesignsStore((state) => state.newDesign);
  const loadDesign = useDesignsStore((state) => state.loadDesign);
  const duplicateDesign = useDesignsStore((state) => state.duplicateDesign);
  const deleteDesign = useDesignsStore((state) => state.deleteDesign);
  const renameDesign = useDesignsStore((state) => state.renameDesign);
  const restoreNotice = useDesignsStore((state) => state.restoreNotice);
  const dismissRestoreNotice = useDesignsStore((state) => state.dismissRestoreNotice);

  /** Which row is asking "are you sure?", if any. Reset on close, so a half-asked question never survives to the next open. */
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const active = designs.find((design) => design.id === activeId) ?? null;

  return (
    <ModalDialog
      open={open}
      onClose={() => {
        setConfirmingDeleteId(null);
        onClose();
      }}
      title="Your designs"
    >
      {restoreNotice !== null && (
        // `role="status"` rather than `alert`: this is the outcome of a load
        // that already happened, not something the user must act on now. It
        // says which crops a saved design lost and why — see
        // `state/design-codec.ts` on why a placement can go missing at all.
        <p role="status" className={styles.notice}>
          {restoreNotice}{' '}
          <button type="button" className={styles.dismiss} onClick={dismissRestoreNotice}>
            Dismiss
          </button>
        </p>
      )}

      <ul className={styles.list}>
        {designs.map((design) => {
          const isActive = design.id === activeId;
          return (
            <li key={design.id} className={styles.row} data-active={isActive}>
              <div className={styles.rowMain}>
                <p className={styles.name}>
                  {design.name}
                  {isActive && <span className={styles.openTag}> — open</span>}
                </p>
                <p className={styles.meta}>
                  {design.placementCount} {design.placementCount === 1 ? 'plant' : 'plants'} ·
                  edited {formatEdited(design.updatedAt)}
                </p>
              </div>

              {confirmingDeleteId === design.id ? (
                <div className={styles.rowActions}>
                  <span className={styles.confirmQuestion}>Delete for good?</span>
                  <button
                    type="button"
                    data-variant="primary"
                    onClick={() => {
                      deleteDesign(design.id);
                      setConfirmingDeleteId(null);
                    }}
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                    Keep
                  </button>
                </div>
              ) : (
                <div className={styles.rowActions}>
                  {/* The open design has no "Open": a button that does nothing
                      is worse than an absent one, and the row already says so. */}
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        loadDesign(design.id);
                        onClose();
                      }}
                      aria-label={`Open ${design.name}`}
                    >
                      Open
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => duplicateDesign(design.id)}
                    aria-label={`Duplicate ${design.name}`}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(design.id)}
                    aria-label={`Delete ${design.name}`}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {active !== null && (
        <div className={styles.rename}>
          <label htmlFor="design-name">Name of the open design</label>
          <input
            id="design-name"
            type="text"
            value={active.name}
            onChange={(event) => renameDesign(active.id, event.target.value)}
          />
        </div>
      )}

      <div className={styles.footer}>
        <button
          type="button"
          data-variant="primary"
          onClick={() => {
            newDesign();
            onClose();
          }}
        >
          New design
        </button>
      </div>
    </ModalDialog>
  );
}

/**
 * A date a gardener would recognise, not an ISO string.
 *
 * `toLocaleDateString` with no locale argument follows the browser's, which is
 * the right default for a date whose only job is to tell two saved designs
 * apart. An unparseable value (a hand-edited storage entry that got through the
 * codec's `typeof` check) degrades to a dash rather than "Invalid Date".
 */
function formatEdited(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
