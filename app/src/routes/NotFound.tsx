/** Catch-all route for any path that doesn't match — demonstrates the router actually routes. */

import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <>
      <h2>Page not found</h2>
      <p>
        <Link to="/">Back to the plot</Link>
      </p>
    </>
  );
}
