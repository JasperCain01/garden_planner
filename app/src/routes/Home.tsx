/**
 * Placeholder home route (Workplan Stage 3.1). Stage 3.2 replaces this with
 * the real plot-definition page; until then it exists to prove the three
 * things this stage is responsible for actually work together: the app shell
 * renders, the engine package is wired in, and the bundled dataset loads.
 */

import { engineStatus } from '@garden-planner/engine';
import { usePlantList } from '../state/use-plant-list.ts';

export function Home() {
  const plants = usePlantList();

  return (
    <>
      <p>
        Project skeleton. Features arrive in later stages — see <code>WORKPLAN.md</code>.
      </p>
      <p>
        Engine status: <strong>{engineStatus()}</strong>
      </p>
      <p>
        Plant list loaded: <strong>{plants.length} crops</strong> (shipped + any added this
        session).
      </p>
    </>
  );
}
