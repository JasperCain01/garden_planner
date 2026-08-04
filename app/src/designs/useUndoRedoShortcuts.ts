/**
 * Ctrl+Z / Ctrl+Shift+Z (and ⌘Z / ⌘⇧Z, and Ctrl+Y) for the design history — the
 * review's "header buttons + Ctrl+Z/Ctrl+Shift+Z" (UI redesign Phase 5).
 *
 * **The shortcut is an alias for the button, never the only way in.** ADR 0026
 * makes every interaction's keyboard path contractual, and a chord is not a
 * keyboard path in that sense — it is invisible, undiscoverable and unavailable
 * to anyone driving the app by switch or voice. `designs/DesignChrome.tsx`'s two
 * real `<button>`s are the path; this is the accelerator, exactly as ADR 0031 §7
 * made every canvas gesture an extra over a button.
 *
 * **It stands down inside a text field.** The palette's search box, the plot's
 * dimension inputs and the design-name field all have their own undo — the
 * browser's, which is what Ctrl+Z means while a caret is in a field, and which
 * a user would be astonished to find replaced by "put that plant back". So a
 * keystroke whose target is an editable element is left alone entirely rather
 * than being handled and re-dispatched.
 *
 * Bound on `window` in the capture phase, so it is seen before anything that
 * might stop propagation, and once for the whole app rather than per component.
 */

import { useEffect } from 'react';
import { useDesignHistory } from '../state/design-history.ts';

/** Whether a keystroke belongs to something that edits text, and so is none of this hook's business. */
function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useUndoRedoShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // `metaKey` for macOS, `ctrlKey` everywhere else. Both are checked rather
      // than sniffing the platform: a Mac with an external PC keyboard sends
      // Ctrl, and a browser on Linux will happily deliver Meta.
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      if (isEditingText(event.target)) return;

      // `event.key` rather than `code`, so a Dvorak or AZERTY layout gets the
      // key the user's keycaps say — and lower-cased because Shift+Z arrives as
      // "Z".
      const key = event.key.toLowerCase();
      const { undo, redo } = useDesignHistory.getState();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        // Ctrl+Y is Windows' other redo, and costs one clause to honour.
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);
}
