/**
 * Catch-all route for any path that doesn't match — demonstrates the router
 * actually routes.
 *
 * It carries its own centred reading column (UI redesign Phase 1): the shell
 * used to give every route one, and now gives routes a full-viewport frame to
 * fill instead — which two sentences should not.
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
