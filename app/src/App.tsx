/**
 * App root (Workplan Stage 3.1). Wires the real browser router in; the shell
 * layout and routes themselves live in `routes/`. Kept as a separate component
 * from `main.tsx` so `main.tsx` stays a pure mount step (`createRoot(...).render`).
 * `App.test.tsx` renders `routes/router.tsx`'s route tree through
 * `createMemoryRouter` instead of mounting this component directly — that
 * avoids depending on the browser History API and `import.meta.env.BASE_URL`
 * under jsdom (see that file's comment).
 */
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './routes/router.tsx';

const router = createAppRouter();

export default function App() {
  return <RouterProvider router={router} />;
}
