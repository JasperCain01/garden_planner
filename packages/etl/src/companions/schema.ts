/**
 * Schema and validators for the curated companion/antagonist relationship
 * dataset (Workplan Stage 1.4 — see
 * `docs/adr/0008-companion-planting-data.md`).
 *
 * This does **not** redefine `PlantLinkSchema`/`EvidenceLevelSchema` from
 * `@garden-planner/engine` — it reuses them (`relationships.ts#toPlantLinksById`
 * is the bridge that turns a validated relationship into a real `PlantLink`).
 * What this module adds on top is the *directed-edge* framing an
 * authoring-time dataset needs, which `PlantLink` itself can't express: a
 * `from`/`to` pair (a `PlantLink` only makes sense once attached to its
 * owning `Plant` — it has no `from`), a `kind` (companion vs antagonist —
 * the Stage 0.2 schema only distinguishes these by *which array* a link
 * lives in, so a flat edge list needs its own field), and a `symmetric` flag
 * (see below). Unlike `PlantLink.note` (optional), `note` here is
 * **required** — every curated relationship must record the reasoning behind
 * its evidence call, the same "reviewable fact, not an assertion" discipline
 * `docs/adr/0007` applied to spacing provenance.
 */

import { z } from 'zod';
import { EvidenceLevelSchema, SlugSchema, SourceRefSchema } from '@garden-planner/engine';

/** Whether a relationship helps (`companion`) or harms (`antagonist`) the pairing. */
export const RelationshipKindSchema = z.enum(['companion', 'antagonist']);
export type RelationshipKind = z.infer<typeof RelationshipKindSchema>;

/**
 * One curated, directed companion/antagonist edge between two plant ids.
 *
 * **Direction convention:** `from` is the plant the recommendation is *for*
 * — `relationships.ts#toPlantLinksById` attaches the resulting `PlantLink`
 * to `from`'s own `companions`/`antagonists` list, pointing at `to` (mirroring
 * how `Plant.companions` is read: "companions for this plant"). For a
 * `symmetric: false` edge, that means `from` must be the plant that actually
 * *benefits* (or is *harmed*) — e.g. a nitrogen-fixing legume enriching soil
 * for a neighbour that fixes none back is recorded `from: <the neighbour>,
 * to: <the legume>`, a companion recommendation *for* the neighbour, not the
 * reverse. Getting this backwards silently surfaces the recommendation under
 * the wrong plant, so double-check it for every non-symmetric entry.
 *
 * `symmetric` records whether the underlying horticultural claim genuinely
 * holds in both directions — most do ("plant onions and carrots together"
 * benefits both; "potato and tomato share blight risk" endangers both) — or
 * is inherently one-directional (see above). It is a statement about the
 * *claim*, not about whether the source data happened to be reciprocal: see
 * the ADR for why OpenFarm-derived edges are recorded `symmetric: false`
 * even when the raw data is reciprocated for some pairs — each edge records
 * only what that one page actually stated (`from` = the page's own plant,
 * which already matches the "recommendation for `from`" convention).
 */
export const CompanionRelationshipSchema = z
  .object({
    /** The plant id (slug) the recommendation is *for* — see the convention above. */
    from: SlugSchema,
    /** The related plant id (slug). */
    to: SlugSchema,
    kind: RelationshipKindSchema,
    /** Whether the relationship is well-supported or traditional/folklore. */
    evidence: EvidenceLevelSchema,
    /** Why this evidence tag was chosen, mandatory — see the module doc. */
    note: z.string().min(1),
    /** At least one citation backing the claim. */
    sources: z.array(SourceRefSchema).nonempty(),
    symmetric: z.boolean(),
  })
  .strict()
  .refine((rel) => rel.from !== rel.to, {
    message: 'a relationship cannot link a plant to itself',
    path: ['to'],
  });
export type CompanionRelationship = z.infer<typeof CompanionRelationshipSchema>;

/**
 * Parse and validate one unknown value as a {@link CompanionRelationship},
 * throwing on the first problem — mirrors `spacing/schema.ts#validateSpacingRecord`.
 */
export function validateCompanionRelationship(input: unknown): CompanionRelationship {
  return CompanionRelationshipSchema.parse(input);
}

/** Which end(s) of a relationship point outside the known plant-id universe. */
export interface DanglingRelationship {
  readonly relationship: CompanionRelationship;
  readonly missing: readonly ('from' | 'to')[];
}

/**
 * Referential integrity is formally Stage 1.5's job (a single relationship
 * can't see the whole eventual merged dataset — the same reasoning
 * `PlantLinkSchema`'s own doc comment gives), but this stage still shouldn't
 * author dangling links by construction. This checks every relationship's
 * `from`/`to` against a given id universe (see `plant-id-universe.ts`) and
 * reports any that don't resolve, so it can be asserted as a build-time
 * invariant here rather than only eyeballed.
 */
export function findDanglingRelationships(
  relationships: readonly CompanionRelationship[],
  idUniverse: ReadonlySet<string>,
): DanglingRelationship[] {
  const dangling: DanglingRelationship[] = [];
  for (const relationship of relationships) {
    const missing: ('from' | 'to')[] = [];
    if (!idUniverse.has(relationship.from)) missing.push('from');
    if (!idUniverse.has(relationship.to)) missing.push('to');
    if (missing.length > 0) {
      dangling.push({ relationship, missing });
    }
  }
  return dangling;
}

/**
 * Relationships that repeat the exact same `kind`/`from`/`to` triple more
 * than once. A `from`↔`to` pair recorded as *both* a companion and an
 * antagonist is not a duplicate by this check (that's a genuine, if unusual,
 * conflicting-evidence situation a curator should resolve by hand, not
 * something this function silently allows or rejects) — only an exact
 * repeat of `kind` too counts.
 */
export function findDuplicateRelationships(
  relationships: readonly CompanionRelationship[],
): CompanionRelationship[] {
  const seen = new Set<string>();
  const duplicates: CompanionRelationship[] = [];
  for (const relationship of relationships) {
    const key = `${relationship.kind}:${relationship.from}->${relationship.to}`;
    if (seen.has(key)) {
      duplicates.push(relationship);
    }
    seen.add(key);
  }
  return duplicates;
}
