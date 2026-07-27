/**
 * The app shell (Workplan Stage 3.1): the persistent chrome — title and nav —
 * that wraps every route. `<Outlet />` renders whichever child route matched;
 * later stages add nav links here as their routes land (Stage 3.2's plot page,
 * etc.), the shell itself doesn't otherwise change shape.
 *
 * **Horizontal padding (Workplan Stage 6.2 responsive pass).** `maxWidth`
 * already caps the content at a comfortable reading width on desktop; on a
 * phone-width viewport (narrower than that max), without padding the content
 * would sit flush against both screen edges. `boxSizing: 'border-box'` keeps
 * that padding from pushing the container past 100% width and forcing a
 * horizontal scrollbar of its own.
 */

import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '40rem',
        margin: '2rem auto',
        padding: '0 1rem',
        boxSizing: 'border-box',
      }}
    >
      <header>
        <h1>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Garden Planner 🌱
          </Link>
        </h1>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
