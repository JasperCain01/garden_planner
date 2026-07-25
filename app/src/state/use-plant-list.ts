/**
 * The one runtime plant list every later Phase 3 stage consumes
 * (`docs/stage-3.1-brief.md`): the shipped dataset concatenated with the
 * session's user-defined crops.
 *
 * The engine is deliberately indifferent to where a plant came from — every
 * function in `@garden-planner/engine` takes a plain `Plant` (ADR 0011) — so
 * this hook does no more than concatenate. It does not tag, sort, or otherwise
 * distinguish the two halves; a consumer that needs to know origin (Stage
 * 3.6's "edit/remove" affordance) calls `isUserPlant` on an individual `Plant`
 * itself, not on anything this hook returns.
 */

import { useMemo } from 'react';
import type { Plant } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { useUserPlantsStore } from './user-plants-store.ts';

/** The shipped ∪ user plant list, recomputed only when the user overlay changes. */
export function usePlantList(): readonly Plant[] {
  const userPlants = useUserPlantsStore((state) => state.userPlants);

  return useMemo(() => [...SHIPPED_PLANTS, ...Object.values(userPlants)], [userPlants]);
}
