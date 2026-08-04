/**
 * The session-scoped overlay of user-defined crops (Workplan Stage 3.1; the
 * "place they land" the brief describes — Stage 3.6 builds the form that
 * calls in).
 *
 * ADR [0015](../../../docs/adr/0015-app-state-management.md) records why this
 * is a Zustand store and why the overlay is keyed by id (`Record<PlantId,
 * Plant>`) rather than an array: it makes "a session can't hold two crops with
 * the same id" a property of the data structure instead of a rule callers have
 * to remember to enforce, and removal is a single key delete rather than a
 * `findIndex`/`filter` pair.
 *
 * This store holds **only** the overlay. The shipped dataset
 * (`dataset/shipped-plants.ts`) is loaded once and never changes, so it isn't
 * store state — `use-plant-list.ts` combines the two for reading.
 *
 * In-memory and unpersisted **by design** (`docs/stage-3.1-brief.md`): a user
 * crop lives for the tab's lifetime and no longer. Nothing here writes to
 * storage, and there is deliberately no rehydration step.
 *
 * **That survived UI redesign Phase 5, which is worth saying explicitly**, since
 * that phase gave the app persistence and this is the store it most obviously
 * did *not* give it to. A saved design carries the user crops **its own
 * placements reference** (`state/design-codec.ts`), as the `UserPlantInput` the
 * add-crop form produced, and opening that design calls {@link addUserPlant}
 * with each — the same validating path a form submission takes. So a crop
 * outlives the tab only for as long as a design that uses it does, and a crop
 * nothing was ever planted with is still gone when the tab closes. ADR 0034 §2
 * weighs that against persisting this store outright, which would have been the
 * obvious answer and would have accumulated crops in a browser forever.
 */

import { create } from 'zustand';
import { createUserPlant, type Plant } from '@garden-planner/engine';

interface UserPlantsState {
  /** The session's user-defined crops, keyed by `Plant.id` (always `user-`-namespaced). */
  readonly userPlants: Readonly<Record<string, Plant>>;

  /**
   * Validate and upcast raw form input (Stage 3.6) into a `Plant` via the
   * engine's `createUserPlant`, then add it to the overlay. Throws the same
   * `ZodError` `createUserPlant` throws if `input` doesn't fit
   * `UserPlantInputSchema` — Stage 3.6's form is expected to have already
   * called `safeValidateUserPlantInput` for field-level errors before ever
   * reaching this, so this call should not normally fail.
   *
   * Adding a crop whose id matches one already in the overlay (e.g. editing by
   * re-submitting) replaces it, since the overlay is keyed by id.
   *
   * @returns the `Plant` that was added, so a caller (e.g. the add-crop form)
   * can navigate to it or confirm the id it landed on.
   */
  readonly addUserPlant: (input: unknown) => Plant;

  /** Remove a user-defined crop from the overlay by id. A no-op if absent. */
  readonly removeUserPlant: (id: string) => void;
}

export const useUserPlantsStore = create<UserPlantsState>((set) => ({
  userPlants: {},

  addUserPlant: (input) => {
    const plant = createUserPlant(input);
    set((state) => ({ userPlants: { ...state.userPlants, [plant.id]: plant } }));
    return plant;
  },

  removeUserPlant: (id) => {
    set((state) => {
      if (!(id in state.userPlants)) {
        return state;
      }
      const remaining = { ...state.userPlants };
      delete remaining[id];
      return { userPlants: remaining };
    });
  },
}));
