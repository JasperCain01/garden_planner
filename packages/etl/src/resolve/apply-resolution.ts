/**
 * Bridges a GBIF resolution back into the Stage 0.2 `Plant` schema — the
 * concrete "fills the nullable `gbifId`" step the brief calls for. Imports
 * `Plant`/`validatePlant` from `@garden-planner/engine` rather than
 * redeclaring any part of the schema (Stage 0.2 is the single source of
 * truth for the record shape).
 */

import { validatePlant, type Plant } from '@garden-planner/engine';
import type { ResolvedOutcome } from './gbif-resolver.ts';

/**
 * Apply a confident GBIF resolution to a plant record, filling `gbifId`. This
 * is the join key later stages need: once a record carries a `gbifId`, the
 * merge step (Stage 1.5) can reconcile it against records for the same
 * species from other sources. Deliberately does **not** touch
 * `scientificName` — reconciling a source's own asserted name against GBIF's
 * canonical one is a data-merge policy decision for Stage 1.5, not this
 * resolver's job.
 *
 * Re-validates via `validatePlant` so the result is a *proven*-valid `Plant`,
 * not just a plausible one — the same hard-fail discipline the ETL uses
 * everywhere else.
 */
export function applyGbifResolution(plant: Plant, outcome: ResolvedOutcome): Plant {
  return validatePlant({ ...plant, gbifId: outcome.gbifId });
}
