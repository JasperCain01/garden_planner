/**
 * The app shell (Workplan Stage 3.1): the persistent chrome — title and nav —
 * that wraps every route. `<Outlet />` renders whichever child route matched;
 * later stages add nav links here as their routes land (Stage 3.2's plot page,
 * etc.), the shell itself doesn't otherwise change shape.
 *
 * **Horizontal padding (Workplan Stage 6.2 responsive pass).** The column's
 * `max-width` caps content at a comfortable reading width on desktop; on a
 * phone-width viewport (narrower than that max), without the gutter the
 * content would sit flush against both screen edges. `global.css`'s
 * border-box default keeps that padding from pushing the container past 100%
 * width and forcing a horizontal scrollbar of its own.
 *
 * **Styling (UI redesign Phase 0).** What used to be an inline `style` prop is
 * now `AppShell.module.css`, spending design tokens (`styles/tokens.css`)
 * rather than hard-coded values. The *layout* is deliberately unchanged —
 * still one centred column — because replacing it with a full-viewport
 * workspace is Phase 1's whole job (`docs/ui-aesthetic-review.md`). The header
 * becomes a real band across the top so the page reads as an app rather than a
 * document, and the wordmark link picks up the display face.
 */

import { Link, Outlet } from 'react-router-dom';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.column}>
          <h1 className={styles.wordmark}>
            <Link to="/">Garden Planner 🌱</Link>
          </h1>
        </div>
      </header>
      <main className={`${styles.column} ${styles.main}`}>
        <Outlet />
      </main>
    </div>
  );
}
