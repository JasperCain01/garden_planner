/**
 * Public surface of the GBIF name resolver (Stage 1.1). See
 * `gbif-resolver.ts` for the resolver itself, `gbif-cache.ts` for the
 * offline cache, and `gbif-transport.ts` for the injectable network boundary.
 */

export * from './gbif-resolver.ts';
export * from './gbif-cache.ts';
export * from './gbif-transport.ts';
export * from './apply-resolution.ts';
