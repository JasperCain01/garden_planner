/**
 * The app shell (Workplan Stage 3.1): the persistent chrome — the header band
 * — that wraps every route. `<Outlet />` renders whichever child route
 * matched.
 *
 * **Full-viewport frame (UI redesign Phase 1).** Phase 0 left this a centred
 * 40rem reading column, which is `docs/ui-aesthetic-review.md`'s first and
 * largest finding: at 1920×1080 that used a third of the screen and stacked
 * every region of the app into one ~3,000px-tall document. The shell is now a
 * two-row grid pinned to the viewport — a header band, and a content row that
 * gets *exactly* the space left over (`minmax(0, 1fr)`, so the row is allowed
 * to be shorter than its contents rather than growing past the viewport).
 * Routes fill that row and scroll internally; the page itself doesn't scroll.
 *
 * **Why the three-column workspace isn't in this file.** The review's sketch
 * draws the whole thing as one grid with the header spanning all columns. In
 * this app those columns *are* route content — palette, canvas and controls
 * all belong to the plot-definition page — and `NotFound` renders through the
 * same shell. So the shell owns the frame (a header, and a content row of
 * known height) and `plot/PlotDefinitionPage.tsx` owns the columns inside it.
 * The rendered result is the review's layout; the seam is where the router
 * already put one.
 *
 * **Below the narrow breakpoint the frame lets go.** A viewport-height grid is
 * a desktop affordance: on a phone, pinning three regions to a short viewport
 * gives three cramped scroll areas instead of one readable page. The media
 * query in `AppShell.module.css` returns the shell to ordinary document flow,
 * which is what the stacked layout the page falls back to at that width wants.
 *
 * **The header holds more than a wordmark now (UI redesign Phase 5).**
 * `designs/DesignChrome.tsx` adds undo, redo and the designs switcher — the
 * first controls this band has ever carried, and therefore the first change to
 * what the app's *first* tab stops are. Two things about that are decisions
 * rather than side effects, both recorded in ADR 0034 §6: the switcher is one
 * button opening a dialog rather than four controls in the band, because every
 * control here is a stop before the skip links; and the band still has to fit
 * on one row at 390px, because a second row is height taken out of the canvas
 * that `e2e/workspace-layout.spec.ts` measures.
 *
 * The chrome renders itself away on `NotFound`, which shares this shell — see
 * its own doc for why undo/redo on a page with no design open is worse than no
 * buttons at all.
 */

import { Link, Outlet } from 'react-router-dom';
import { DesignChrome } from '../designs/DesignChrome.tsx';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.wordmark}>
          <Link to="/">Garden Planner 🌱</Link>
        </h1>
        <DesignChrome />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
