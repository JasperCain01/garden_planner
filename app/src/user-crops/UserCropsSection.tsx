/**
 * "Add your own crop" page section (Workplan Stage 3.6) — `DESIGN.md`'s
 * "beyond the core loop" capability, not one of the four numbered core-loop
 * steps (`plot/PlotDefinitionPage.tsx`'s "1."–"4." headings), so this section
 * is deliberately unnumbered and sits between the palette (step 2) and the
 * canvas (step 3): once a crop is added here it shows up ranked in the
 * palette above, ready to drag into the canvas below — see
 * `docs/architecture.md`'s Stage 3.6 note for why no changes were needed to
 * either.
 *
 * Store-wiring wrapper around `AddCropForm.tsx`, mirroring
 * `warnings/WarningsSection.tsx`'s split between store-wiring and
 * presentation: reads `useUserPlantsStore` directly (existing ids for the
 * form's collision check, `addUserPlant`/`removeUserPlant`), and owns the
 * one bit of local UI state this capability needs — which crop, if any, is
 * currently being edited.
 *
 * **Edit/remove, gated on `isUserPlant`.** Every entry rendered here comes
 * from `useUserPlantsStore().userPlants`, which by construction holds only
 * user crops — but the gate is still applied explicitly (rather than assumed
 * from "it's in this list"), per the Stage 3.6 brief: `isUserPlant` is the
 * one place origin-awareness belongs, and calling it here rather than
 * trusting the store's shape is what keeps that true even if this list is
 * ever combined with shipped crops later.
 *
 * **Styling (UI redesign Phase 0).** The section is a card and the added-crops
 * list is a proper row list (`UserCropsSection.module.css`). Moving this whole
 * capability out of the page flow and into a modal off the palette is Phase
 * 1's job (`docs/ui-aesthetic-review.md`) — it takes ~800px of prime mid-page
 * space today for something used rarely.
 */

import { useState } from 'react';
import { isUserPlant, type UserPlantInput } from '@garden-planner/engine';
import { useUserPlantsStore } from '../state/user-plants-store.ts';
import { AddCropForm } from './AddCropForm.tsx';
import { plantToUserPlantInput } from './plant-to-input.ts';
import styles from './UserCropsSection.module.css';

export function UserCropsSection() {
  const userPlants = useUserPlantsStore((state) => state.userPlants);
  const addUserPlant = useUserPlantsStore((state) => state.addUserPlant);
  const removeUserPlant = useUserPlantsStore((state) => state.removeUserPlant);
  const [editingId, setEditingId] = useState<string | null>(null);

  const crops = Object.values(userPlants);
  const editingPlant = editingId !== null ? userPlants[editingId] : undefined;

  function handleSubmit(input: UserPlantInput): void {
    addUserPlant(input);
    setEditingId(null);
  }

  return (
    <section className="card">
      <h2>Add your own crop</h2>
      <p>
        The shipped dataset can&rsquo;t cover every variety on every seed rack — add one by hand
        from the packet and it behaves like any other crop for this session: scored, ranked, placed,
        and counted. It appears in the &ldquo;Discover suitable plants&rdquo; palette above as soon
        as it&rsquo;s added.
      </p>

      <AddCropForm
        key={editingId ?? 'new'}
        existingIds={Object.keys(userPlants)}
        onSubmit={handleSubmit}
        initialInput={editingPlant ? plantToUserPlantInput(editingPlant) : undefined}
        onCancel={editingId !== null ? () => setEditingId(null) : undefined}
      />

      {crops.length > 0 && (
        <div className={styles.added}>
          <h3>Your added crops</h3>
          <ul className={styles.list}>
            {crops.map((plant) => (
              <li key={plant.id} className={styles.crop}>
                <span className={styles.cropName}>{plant.commonName}</span>
                {isUserPlant(plant) && (
                  <span className={styles.actions}>
                    <button type="button" onClick={() => setEditingId(plant.id)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => removeUserPlant(plant.id)}>
                      Remove
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
