/**
 * Metre <-> centimetre conversion at the UI boundary (Workplan Stage 3.2).
 *
 * The engine speaks only centimetres (`packages/engine/src/spacing/region.ts`
 * — matches `Plant.spacing`), but a gardener thinks in metres. Converting here,
 * at the one place form values cross into engine calls, keeps that unit
 * decision out of the engine and out of every component that needs it.
 */

export const CM_PER_METRE = 100;

/** A form value in metres to the centimetres the engine's factory functions take. */
export function metresToCm(metres: number): number {
  return metres * CM_PER_METRE;
}

/** The inverse of {@link metresToCm}, for showing a stored/engine value back in metres. */
export function cmToMetres(cm: number): number {
  return cm / CM_PER_METRE;
}
