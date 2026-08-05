/**
 * Catch-all route for any path that doesn't match — demonstrates the router
 * actually routes.
 *
 * It carries its own centred reading column (UI redesign Phase 1): the shell
 * used to give every route one, and now gives routes a full-viewport frame to
 * fill instead — which two sentences should not.
 *
 * **The header this route shares is deliberately the bare one (UI redesign
 * Phase 5).** `designs/DesignChrome.tsx` adds undo, redo and the designs
 * switcher to the shell's header on the workspace route and renders nothing
 * here: undo/redo for a plot you cannot see is a control with no observable
 * effect, and loading a design from this page would leave you on the not-found
 * page looking at nothing. So this page's header is exactly what it always was —
 * a wordmark and a link back.
 */

import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';

export function NotFound() {
  return (
    <div className={styles.page}>
      <h2>Page not found</h2>
      <p>
        <Link to="/">Back to the plot</Link>
      </p>
    </div>
  );
}
