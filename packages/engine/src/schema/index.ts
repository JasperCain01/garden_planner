/**
 * Public surface of the plant-record schema (Workplan Stage 0.2).
 *
 * Re-exports everything from `plant.ts` so consumers can `import { PlantSchema,
 * validatePlant, type Plant } from '@garden-planner/engine'` without reaching
 * into file paths. zod remains the single source of truth; the TypeScript types
 * here are all `z.infer`-derived (see `plant.ts`).
 */

export * from './plant';
