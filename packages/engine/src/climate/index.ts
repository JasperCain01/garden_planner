/**
 * Public surface of the location/climate module (Workplan Stage 1.6). Re-exports
 * everything from its sibling files so consumers can `import { resolveClimate,
 * ClimateProfileSchema, type ClimateProfile } from '@garden-planner/engine'`
 * without reaching into file paths — mirrors `schema/index.ts`'s pattern.
 */

export * from './schema.ts';
export * from './season.ts';
export * from './regions.ts';
export * from './resolve.ts';
export * from './geocode.ts';
