/**
 * The **growing conditions** a plot offers — the other half of every suitability
 * question (the plant record is the first half).
 *
 * This is what Stage 3.2's plot form produces and what `scorePlant` consumes.
 * **zod is the single source of truth** and every type is `z.infer`-derived,
 * exactly as `schema/plant.ts` and `climate/schema.ts` are; and like the climate
 * module, this one **reuses the Stage 0.2 vocabulary rather than restating it**:
 *
 * - {@link LightRequirementSchema} — a plot's light level and a plant's light
 *   requirement are the *same enum on purpose*, so `lightRequirementRank` can
 *   measure the distance between them (ADR 0004 §4).
 * - {@link SoilTextureSchema} / {@link SoilPhSchema} / {@link SoilMoistureSchema}
 *   — the same closed soil vocabulary a plant's `soil` block speaks.
 * - {@link ClimateProfileSchema} — a resolved climate profile, verbatim from the
 *   Stage 1.6 module (ADR 0010), so hardiness comparisons need no conversion.
 * - {@link MonthSchema} — the same 1–12 bound everything else uses.
 *
 * ### Why the plot's soil is singular where a plant's is plural
 *
 * A `Plant.soil` carries *arrays* — a crop tolerates loam **or** clay. A plot
 * has exactly one texture, one pH band and one moisture level. The asymmetry is
 * real, not an oversight, and it is what makes soil scoring a simple membership
 * test ("is the plot's value among the ones this crop accepts?").
 */

import { z } from 'zod';
import {
  LightRequirementSchema,
  MonthSchema,
  SoilMoistureSchema,
  SoilPhSchema,
  SoilTextureSchema,
} from '../schema/plant.ts';
import { ClimateProfileSchema, LocationInputSchema } from '../climate/schema.ts';
import { resolveClimate } from '../climate/resolve.ts';

/**
 * What the user knows about their soil. Every facet is optional — `DESIGN.md`
 * §1 asks for "soil type **if known**" — but an entirely empty block carries no
 * information, so at least one facet must be present if the block exists (the
 * same rule `HardinessSchema` applies for the same reason).
 *
 * Omit the whole block when nothing is known: the soil dimension then reports
 * `unknown-plot` and drops out of the score, rather than being guessed at.
 */
export const PlotSoilSchema = z
  .object({
    /** The plot's soil texture, e.g. heavy clay or free-draining sand. */
    texture: SoilTextureSchema.optional(),
    /** The plot's pH band. */
    ph: SoilPhSchema.optional(),
    /** How wet the plot stays — a boggy corner vs. a dry bank. */
    moisture: SoilMoistureSchema.optional(),
  })
  .strict()
  .refine(
    (soil) => soil.texture !== undefined || soil.ph !== undefined || soil.moisture !== undefined,
    { message: 'soil needs at least one of texture, ph or moisture (omit it entirely if unknown)' },
  );
export type PlotSoil = z.infer<typeof PlotSoilSchema>;

/**
 * A plot's growing conditions, with its location already **resolved** to a
 * {@link ClimateProfile}. This is the scorers' input.
 *
 * `light` is required: it is the one condition every plot has, the user always
 * supplies it (`DESIGN.md` §1 step 1), and it is the only dimension with real
 * coverage in today's dataset — so requiring it guarantees every result has at
 * least one assessed dimension, and `confidence` is never 0.
 */
export const PlotConditionsSchema = z
  .object({
    /** The plot's overall light level, in the plant vocabulary (see the module doc). */
    light: LightRequirementSchema,
    /** The plot's soil, if the user knows it. Omitted = unknown, not "average". */
    soil: PlotSoilSchema.optional(),
    /** The resolved climate profile for the plot's location (Stage 1.6). */
    climate: ClimateProfileSchema,
    /**
     * The month the user is planning to plant, 1–12. Optional: with it, the
     * season dimension asks "can I sow this now?"; without it, it asks the
     * broader "does this crop's sowing window fit this region's season at all?".
     * Deliberately *not* defaulted to the current month — the engine is pure and
     * must not read a clock, and a planner is often used out of season.
     */
    plantingMonth: MonthSchema.optional(),
  })
  .strict();
export type PlotConditions = z.infer<typeof PlotConditionsSchema>;

/**
 * What Stage 3.2's form actually collects: the same conditions, but with the
 * location still *unresolved*. Kept as a separate schema (rather than making
 * `climate` optional above) so the scorers can rely on a climate profile always
 * being present, while the UI keeps a shape that round-trips cleanly through
 * URL/`localStorage` state — the same argument ADR 0010 §6 made for
 * `LocationInputSchema` being zod rather than a hand-written union.
 */
export const PlotConditionsInputSchema = z
  .object({
    light: LightRequirementSchema,
    soil: PlotSoilSchema.optional(),
    /** Where the plot is. Omitted → the UK national default profile. */
    location: LocationInputSchema.optional(),
    plantingMonth: MonthSchema.optional(),
  })
  .strict();
export type PlotConditionsInput = z.infer<typeof PlotConditionsInputSchema>;

/**
 * Validate a plot description and resolve its location into full
 * {@link PlotConditions}. This is the boundary function: everything downstream
 * of it takes a validated, fully-resolved value, so no scorer has to defend
 * against malformed input.
 *
 * Resolution is entirely offline (ADR 0010) and never fails for a default or
 * coordinate location; an unknown `regionId` throws, which is a caller bug to
 * fix rather than a runtime case to design UX around.
 *
 * @param input - an unvalidated plot description (e.g. straight from a form).
 * @returns the same conditions with `location` replaced by a `ClimateProfile`.
 * @throws {z.ZodError} if the input isn't a valid {@link PlotConditionsInput}.
 */
export function resolvePlotConditions(input: unknown): PlotConditions {
  const { location, ...rest } = PlotConditionsInputSchema.parse(input);
  return { ...rest, climate: resolveClimate(location) };
}

/**
 * Parse an already-resolved value as {@link PlotConditions}, throwing on
 * invalid input. Mirrors `validatePlant` — useful when conditions are rehydrated
 * from storage rather than built by {@link resolvePlotConditions}.
 */
export function validatePlotConditions(input: unknown): PlotConditions {
  return PlotConditionsSchema.parse(input);
}

/**
 * Non-throwing counterpart to {@link validatePlotConditions}, returning zod's
 * `{ success, data | error }` result so a form can show field-addressable
 * errors. Mirrors `safeValidatePlant` / `safeValidateUserPlantInput`.
 */
export function safeValidatePlotConditions(
  input: unknown,
): z.SafeParseReturnType<unknown, PlotConditions> {
  return PlotConditionsSchema.safeParse(input);
}
