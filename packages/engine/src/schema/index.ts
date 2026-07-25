/**
 * Public surface of the plant-record schema (Workplan Stage 0.2, amended in 0.3).
 *
 * Re-exports everything from `plant.ts` so consumers can `import { PlantSchema,
 * validatePlant, type Plant } from '@garden-planner/engine'` without reaching
 * into file paths. zod remains the single source of truth; the TypeScript types
 * here are all `z.infer`-derived (see `plant.ts`).
 */

export * from './plant.ts';

/**
 * The user-defined-crop input schema and its upcast to a full `Plant` (Stage 0.3;
 * see `docs/adr/0011-user-defined-crop-schema.md`). The *only* relaxation of the
 * plant shape lives there, at the input boundary — `PlantSchema` above is
 * unchanged and remains the strict gate shipped data must clear.
 */
export * from './user-plant.ts';
