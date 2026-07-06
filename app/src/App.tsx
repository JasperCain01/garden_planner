import { engineStatus } from '@garden-planner/engine';

/**
 * App shell placeholder.
 *
 * This is deliberately minimal — Stage 0.1 only establishes a runnable skeleton.
 * The real app shell, routing, and state land in Stage 3.1, and the features
 * (plot definition, plant palette, drag-and-drop canvas, warnings) follow.
 *
 * We render the engine's status string here for one reason: it proves the
 * cross-workspace wiring (app → `@garden-planner/engine`) compiles and runs.
 */
export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '40rem', margin: '2rem auto' }}>
      <h1>Garden Planner 🌱</h1>
      <p>
        Project skeleton. Features arrive in later stages — see <code>WORKPLAN.md</code>.
      </p>
      <p>
        Engine status: <strong>{engineStatus()}</strong>
      </p>
    </main>
  );
}
