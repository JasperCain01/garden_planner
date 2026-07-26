/**
 * Turn an already-added user crop back into the {@link UserPlantInput} shape
 * the add-crop form edits (Workplan Stage 3.6).
 *
 * `useUserPlantsStore` only stores full `Plant`s (the upcast's output, see
 * `packages/engine/src/schema/user-plant.ts`), but "edit" re-opens the same
 * form the crop was first created with — so editing needs the inverse
 * projection: pick back out exactly the fields `UserPlantInputSchema` accepts
 * (plus the existing `id`, so re-submitting replaces the same overlay entry
 * rather than minting a second one) and drop everything the upcast
 * synthesised (`scientificName`, `gbifId`, `provenance`). This is a plain
 * projection, not a validator — the `Plant` came from `createUserPlant`
 * already, so it is guaranteed to fit `UserPlantInputSchema` once the
 * synthesised fields are stripped.
 */

import type { Plant, UserPlantInput } from '@garden-planner/engine';

export function plantToUserPlantInput(plant: Plant): UserPlantInput {
  return {
    id: plant.id,
    commonName: plant.commonName,
    category: plant.category,
    light: plant.light,
    spacing: plant.spacing,
    ...(plant.seasons ? { seasons: plant.seasons } : {}),
    ...(plant.hardiness ? { hardiness: plant.hardiness } : {}),
    ...(plant.soil ? { soil: plant.soil } : {}),
    ...(plant.icon ? { icon: plant.icon } : {}),
  };
}
