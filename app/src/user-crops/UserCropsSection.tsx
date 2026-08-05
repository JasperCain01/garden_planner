/**
 * "Add your own crop" (Workplan Stage 3.6) — `DESIGN.md`'s "beyond the core
 * loop" capability: once a crop is added here it shows up ranked in the
 * palette like any shipped crop, ready to drag onto the canvas — see
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
 * **This is dialog content now (UI redesign Phase 1).** It used to be a page
 * section — a card with its own `<h2>`, sitting in the flow between the
 * palette and the canvas and pushing them ~800px further apart for a
 * capability used rarely. `AddCropDialog.tsx` opens it from the foot of the
 * plants sidebar instead, and supplies the title, so this component renders
 * only the content: the form, and the list of what's been added.
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
    <div>
      <p>
        The shipped dataset can&rsquo;t cover every variety on every seed rack — add one by hand
        from the packet and it behaves like any other crop for this session: scored, ranked, placed,
        and counted. It appears in the plants list as soon as it&rsquo;s added.
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
    </div>
  );
}
