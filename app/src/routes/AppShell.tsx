/**
 * The app shell (Workplan Stage 3.1): the persistent chrome — title and nav —
 * that wraps every route. `<Outlet />` renders whichever child route matched;
 * later stages add nav links here as their routes land (Stage 3.2's plot page,
 * etc.), the shell itself doesn't otherwise change shape.
 */

import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '40rem', margin: '2rem auto' }}>
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
