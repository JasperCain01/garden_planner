/**
 * User-defined crops: the permissive **input** schema and the upcast that turns
 * it into a fully-valid {@link Plant} (Workplan Stage 0.3, the keystone schema
 * amendment; design in `docs/adr/0011-user-defined-crop-schema.md`).
 *
 * ## The problem this module solves
 *
 * `PlantSchema` does two jobs at once. It is the shape everything downstream
 * consumes, *and* it is the ETL's hard-fail gate for **shipped** data — the thing
 * that guarantees every record we publish carries a botanical name and a source
 * attribution (the provenance promise of ADR 0009 — a traceability guarantee,
 * not a licence one, since ADR 0023 released the dataset as CC0). A user typing a
 * crop off a seed packet has neither: they have "Cherry Belle", not _Raphanus
 * sativus_, and no citation to offer.
 *
 * Relaxing `PlantSchema` itself would have silently relaxed the shipped gate too.
 * So instead, **the relaxation lives only at the input boundary**:
 *
 * ```text
 *   packet fields ──► UserPlantInputSchema ──► userPlantInputToPlant ──► Plant
 *   (no sci. name,     (permissive, strict      (synthesises the         (fully
 *    no provenance)     about what it does       missing fields)          valid)
 *                       accept)
 * ```
 *
 * `PlantSchema` / `validatePlant` are **unchanged** by this stage, and so are all
 * three of the ETL's shipped-data call sites. Everything downstream of the upcast
 * — the suitability engine, the palette, the canvas, the runtime `shipped ∪ user`
 * plant list (Stage 3.1) — sees nothing but valid `Plant`s and never needs to know
 * where a record came from. See {@link userPlantInputToPlant} for the synthesis
 * rules and the ADR for the alternatives weighed.
 *
 * This module is framework-free like the rest of the engine: no React, no DOM.
 * The add-crop *form* is Stage 3.6; this is only the schema it validates against.
 */

import { z } from 'zod';
import {
  EdibleCategorySchema,
  HardinessSchema,
  LightRequirementSchema,
  SeasonsSchema,
  SlugSchema,
  SoilSchema,
  SpacingSchema,
  validatePlant,
  type Plant,
} from './plant.ts';

// ---------------------------------------------------------------------------
// The `user-` id namespace
// ---------------------------------------------------------------------------

/**
 * The reserved id prefix for user-defined crops.
 *
 * **The convention:** every user crop's `id` starts with `user-`; no shipped
 * record's `id` ever does. That is what lets Stage 3.1 concatenate the shipped
 * dataset and the session's user crops into one runtime list without an id
 * collision renaming or shadowing someone's crop.
 *
 * Both halves of the guarantee are enforced, not merely documented:
 * - **User ids always carry it** — {@link UserPlantIdSchema} rejects an id that
 *   doesn't, and {@link userPlantInputToPlant} mints ids through it.
 * - **Shipped ids never carry it** — the ETL's dataset gate (`merge/validate.ts`,
 *   Stage 1.5) rejects a shipped record whose id is in this namespace, via
 *   {@link isUserPlantId}.
 */
export const USER_PLANT_ID_PREFIX = 'user-';

/**
 * A user crop's `id`: a {@link SlugSchema} slug that additionally lives in the
 * `user-` namespace, with at least one slug segment after the prefix (so a bare
 * `"user-"`, or `"user"` alone, is not a valid user id).
 */
export const UserPlantIdSchema = SlugSchema.refine(
  (id) => id.startsWith(USER_PLANT_ID_PREFIX) && id.length > USER_PLANT_ID_PREFIX.length,
  {
    message: `a user crop id must start with "${USER_PLANT_ID_PREFIX}" (e.g. "user-cherry-belle")`,
  },
);
export type UserPlantId = z.infer<typeof UserPlantIdSchema>;

/**
 * Whether an id belongs to the user-crop namespace. Deliberately a plain string
 * predicate rather than a `Plant` predicate: the ETL gate calls it on ids from
 * records it has not yet trusted, and the UI calls it on a `Plant.id` to decide
 * whether a crop is removable/editable (a shipped crop is not).
 */
export function isUserPlantId(id: string): boolean {
  return id.startsWith(USER_PLANT_ID_PREFIX) && id.length > USER_PLANT_ID_PREFIX.length;
}

/** Whether a validated record is a user-defined crop rather than a shipped one. */
export function isUserPlant(plant: Plant): boolean {
  return isUserPlantId(plant.id);
}

/**
 * Turn free text into the slug body of an id: lowercase, accents folded to ASCII,
 * every run of non-alphanumerics collapsed to a single hyphen, no leading or
 * trailing hyphen. `"Radish 'Cherry Belle'"` → `"radish-cherry-belle"`.
 *
 * Exported because Stage 3.6 needs it to *preview* the id it is about to mint (and
 * to de-duplicate when two packets slugify the same), and because a second,
 * subtly-different slugifier elsewhere in the codebase is exactly how id rules
 * drift apart.
 *
 * Returns `''` when the input contains nothing slug-able (e.g. `"!!!"`); callers
 * should treat that as "not a usable name" — {@link UserPlantInputSchema} does.
 */
export function slugifyName(name: string): string {
  return (
    name
      .normalize('NFD')
      // Strip combining marks left by NFD, so "Café" folds to "cafe" rather than
      // losing the "e" to the non-alphanumeric rule below.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Mint a namespaced user-crop id from a packet name:
 * `"Cherry Belle"` → `"user-cherry-belle"`.
 *
 * Throws if `name` contains no slug-able characters. That is unreachable through
 * the validated path — {@link UserPlantInputSchema} rejects such a name up front,
 * so by the time you hold a `UserPlantInput` the derivation cannot fail — but the
 * guard is kept so a direct caller gets a clear error rather than the bare
 * `"user-"` that would silently violate {@link UserPlantIdSchema}.
 */
export function userPlantIdFromName(name: string): UserPlantId {
  const body = slugifyName(name);
  if (body === '') {
    throw new Error(
      `cannot derive a user crop id from "${name}": it contains no letters or numbers`,
    );
  }
  return `${USER_PLANT_ID_PREFIX}${body}`;
}

// ---------------------------------------------------------------------------
// Provenance for a user crop
// ---------------------------------------------------------------------------

/**
 * The `source` string synthesised for a user-entered crop.
 *
 * A user crop still carries provenance — it is simply *honest* provenance: this
 * fact came from the person using the app, not from PFAF or a hand-verified
 * chart. That keeps `Plant.provenance` required (so nothing downstream has to
 * handle a missing block) while never dressing a typed-in figure up as a cited
 * one. It is also what makes user crops trivially distinguishable in any future
 * attribution roll-up.
 */
export const USER_ENTERED_SOURCE = 'user-entered';

// ---------------------------------------------------------------------------
// The user input schema
// ---------------------------------------------------------------------------

/**
 * A crop name as typed off a seed packet. Non-empty, and required to contain at
 * least one letter or digit — because the name is what the crop's id is derived
 * from, and a name of `"!!!"` has no derivable id. Enforcing it here means
 * {@link userPlantInputToPlant} can mint an id without a failure path.
 */
const PacketNameSchema = z
  .string()
  .min(1)
  .refine((name) => slugifyName(name) !== '', {
    message: 'name must contain at least one letter or number',
  });

/**
 * What a user can actually tell us from a seed packet — **the only place in the
 * codebase where the plant shape is relaxed.**
 *
 * Required: `commonName`, `category`, `light`, `spacing`. Those are exactly the
 * fields `DESIGN.md` §1 promises the add-crop form asks for, and they are the
 * minimum the suitability engine and the density calculator need in order to
 * treat the crop like any other (a crop with no spacing cannot be placed, which
 * is the app's whole point).
 *
 * Deliberately **absent** (not optional — absent, and rejected if supplied,
 * because the object is `.strict()`):
 * - `scientificName` — a packet says "Cherry Belle", not _Raphanus sativus_.
 * - `provenance` — a user has no citation to offer; it is synthesised as
 *   {@link USER_ENTERED_SOURCE} instead, which is more honest than an invented one.
 * - `gbifId` — nothing has resolved this crop against the GBIF backbone.
 * - `companions` / `antagonists` — a seed packet does not supply relationships,
 *   and the user has no way to know them. See {@link userPlantInputToPlant}.
 * - `cultivar`, `synonyms`, `edibleParts` — real packet data, but not asked for by
 *   the Stage 3.6 form; a user who cares can put the cultivar in the name
 *   ("Radish 'Cherry Belle'"). Adding an optional field here later is a
 *   non-breaking change; removing a required one is not, so we start narrow.
 *
 * The optional fields (`seasons`, `hardiness`, `soil`, `icon`, `id`) reuse the
 * canonical Stage 0.2 schemas unchanged — the bounds a user's input is held to
 * (months 1–12, positive spacing, closed enums) are the same bounds shipped data
 * is held to. This schema loosens *which fields are required*, never *what counts
 * as a valid value*.
 */
export const UserPlantInputSchema = z
  .object({
    /**
     * An explicit id, already `user-` namespaced. Optional: normally the id is
     * derived from `commonName`. Stage 3.6 supplies one when a derived id would
     * collide with a crop the user already added (two packets, one name), which is
     * the only case where the form knows better than the derivation.
     */
    id: UserPlantIdSchema.optional(),

    /** The name off the packet, e.g. "Cherry Belle" or "Radish 'Cherry Belle'". */
    commonName: PacketNameSchema,

    category: EdibleCategorySchema,
    light: LightRequirementSchema,
    spacing: SpacingSchema,

    seasons: SeasonsSchema.optional(),
    hardiness: HardinessSchema.optional(),
    soil: SoilSchema.optional(),

    /**
     * A key into the bundled SVG icon set (Stage 4.1), chosen in the form's icon
     * picker. Optional — the UI falls back to a generic icon. Constraining the
     * picker to the bundled set (no uploads) is a Stage 3.6 concern; the schema
     * only guarantees the shape.
     */
    icon: SlugSchema.optional(),
  })
  .strict();

/** What the add-crop form collects, `z.infer`-derived from {@link UserPlantInputSchema}. */
export type UserPlantInput = z.infer<typeof UserPlantInputSchema>;

/**
 * Parse and validate an unknown value as a {@link UserPlantInput}, **throwing** a
 * `ZodError` if it doesn't fit. The safe-parse form below is usually what a form
 * wants (field-level errors without a try/catch).
 */
export function validateUserPlantInput(input: unknown): UserPlantInput {
  return UserPlantInputSchema.parse(input);
}

/**
 * Non-throwing counterpart to {@link validateUserPlantInput}. Returns zod's
 * `{ success, data | error }` result, which is what the Stage 3.6 form should use:
 * it can map `error.issues[].path` straight onto the field that needs the message.
 */
export function safeValidateUserPlantInput(
  input: unknown,
): z.SafeParseReturnType<unknown, UserPlantInput> {
  return UserPlantInputSchema.safeParse(input);
}

// ---------------------------------------------------------------------------
// The upcast: user input → a full, valid Plant
// ---------------------------------------------------------------------------

/**
 * Upcast a validated {@link UserPlantInput} into a full, `validatePlant`-clean
 * {@link Plant}. **This is the boundary** the whole design turns on: past this
 * function nothing is "a user crop with fields missing" — it is just a `Plant`.
 *
 * The synthesis rules, each chosen to be honest rather than convenient:
 *
 * - **`id`** — the input's explicit id, else `user-` + slugified `commonName`
 *   ({@link userPlantIdFromName}). Namespaced so it can never collide with a
 *   shipped id (see {@link USER_PLANT_ID_PREFIX}).
 * - **`scientificName`** — defaults to the `commonName`. The schema requires a
 *   non-empty string, not a real binomial, so this is valid; but it means
 *   **nothing downstream may assume `scientificName` is a botanical name**. It is
 *   a display/identity field, never a join key — the join key is `gbifId`, and a
 *   user crop's is `null` (ADR 0009's join policy already refuses to merge full
 *   records by name, so this creates no new risk in the pipeline).
 * - **`gbifId`** — `null`. Nothing has resolved this crop, and the schema's
 *   nullable `gbifId` exists for exactly this "not resolved" state.
 * - **`provenance`** — `{ sources: [{ source: 'user-entered' }] }`. Truthful
 *   attribution rather than a missing block or a borrowed citation.
 * - **`companions` / `antagonists`** — omitted entirely. A packet supplies no
 *   relationships, so a user crop has none. This is why user crops raise **no
 *   referential-integrity concern** in Stage 3.1's runtime `shipped ∪ user` list:
 *   a plant with no links cannot dangle, and no *shipped* record can point at a
 *   `user-` id (those ids don't exist at build time, and the ETL gate forbids
 *   them). Stage 3.6 does not need to re-litigate this.
 *
 * The result is passed through `validatePlant` — the same hard-fail validator the
 * ETL uses — so the upcast can never emit a `Plant` the rest of the app would
 * reject. That is also what Stage 3.6's brief means by "validated on submit with
 * the same `validatePlant`".
 */
export function userPlantInputToPlant(input: UserPlantInput): Plant {
  return validatePlant({
    id: input.id ?? userPlantIdFromName(input.commonName),
    commonName: input.commonName,
    // Not a binomial — see the doc comment above before relying on this field.
    scientificName: input.commonName,
    gbifId: null,
    category: input.category,
    light: input.light,
    spacing: input.spacing,
    // Spread the optionals rather than assigning `undefined`: the record schema is
    // `.strict()` about unknown keys but happy for an optional key to be absent,
    // and absent reads better than `"seasons": undefined` in any JSON round-trip.
    ...(input.seasons ? { seasons: input.seasons } : {}),
    ...(input.hardiness ? { hardiness: input.hardiness } : {}),
    ...(input.soil ? { soil: input.soil } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    provenance: { sources: [{ source: USER_ENTERED_SOURCE }] },
  });
}

/**
 * Validate raw form values and upcast them in one step — the single call the
 * Stage 3.6 add-crop form's submit handler needs. Throws a `ZodError` if the
 * input doesn't fit {@link UserPlantInputSchema}.
 *
 * @param input - untrusted form values.
 * @returns a fully-valid `Plant` ready to drop into the session's plant list.
 */
export function createUserPlant(input: unknown): Plant {
  return userPlantInputToPlant(validateUserPlantInput(input));
}
