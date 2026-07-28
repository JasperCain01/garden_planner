/**
 * A modal dialog (UI redesign Phase 1) — the app's first shared UI primitive,
 * and so far its only one.
 *
 * It exists because Phase 1 moves "Add your own crop" out of the page flow
 * (`docs/ui-aesthetic-review.md`: ~800px of prime mid-page real estate for a
 * rarely-used capability, sitting between the palette and the canvas and
 * pushing the canvas further out of reach) and into a dialog opened from the
 * bottom of the palette sidebar. The review asks for it focus-trapped and
 * Esc-closable.
 *
 * **It is a real `<dialog>`, not a `<div role="dialog">`.** The browser then
 * owns the three things a hand-rolled modal gets wrong: the focus trap (Tab
 * cannot leave an element in the top layer), Esc-to-close, and returning focus
 * to whatever opened it. Stage 6.2's accessibility posture was to hand-build
 * only what nothing else supplies — and here the platform supplies it, tested
 * by browser vendors rather than by us. The `::backdrop` pseudo-element comes
 * with it, so the scrim needs no extra element either.
 *
 * **Children render only while open.** A closed `<dialog>` is `display: none`
 * in a browser, so this is invisible there — but it matters under jsdom, whose
 * `<dialog>` has no UA stylesheet, and it means the add-crop form's ~20 labels
 * aren't in the accessibility tree (or in a test's `getByLabelText`) while the
 * dialog is shut. It also resets the form to a blank draft on each open, which
 * is what "add another crop" should do.
 *
 * **The `showModal` guard is for jsdom, and only for jsdom.** jsdom 25 doesn't
 * implement `HTMLDialogElement` at all — no `showModal`, no `close`. Rather
 * than mock the element in every component test that opens a dialog, the two
 * calls fall back to toggling the `open` attribute by hand, which is exactly
 * what those tests need to see (the content rendered and queryable). Nothing
 * about the fallback runs in a browser, where both methods exist; the real
 * modal behaviour is covered by `e2e/add-custom-crop.spec.ts` and the axe run.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './ModalDialog.module.css';

export interface ModalDialogProps {
  /** Whether the dialog is showing. The caller owns this state — the dialog reports closes via `onClose` rather than closing itself behind the caller's back. */
  readonly open: boolean;
  /** Called whenever the dialog closes: the close button, Esc, or the backdrop-dismiss the browser may offer. Should set `open` to `false`. */
  readonly onClose: () => void;
  /** The dialog's title, rendered as its heading and used as its accessible name. */
  readonly title: string;
  readonly children: ReactNode;
}

export function ModalDialog({ open, onClose, title, children }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialogRef.current;
    if (element === null) {
      return;
    }
    if (open) {
      // See the module doc: `showModal` is missing under jsdom, present in
      // every browser this app supports.
      if (typeof element.showModal === 'function') {
        element.showModal();
      } else {
        element.setAttribute('open', '');
      }
    } else if (typeof element.close === 'function') {
      element.close();
    } else {
      element.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      // The native `close` event covers every way out — the close button's
      // `close()` call, Esc, and the browser's own dismiss gesture — so the
      // caller's state can't drift out of sync with the element's.
      onClose={onClose}
    >
      {open && (
        <>
          <div className={styles.titlebar}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()}`}
              className={styles.close}
            >
              ✕
            </button>
          </div>
          <div className={styles.content}>{children}</div>
        </>
      )}
    </dialog>
  );
}
