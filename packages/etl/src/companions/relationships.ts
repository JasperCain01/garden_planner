/**
 * The combined companion/antagonist relationship dataset (Workplan Stage 1.4
 * — see `docs/adr/0008-companion-planting-data.md`) and the bridge that
 * turns it into `@garden-planner/engine`'s own `PlantLink` shape.
 */

import { PlantLinkSchema, type PlantLink } from '@garden-planner/engine';
import { CURATED_COMPANION_RELATIONSHIPS } from './curated.ts';
import { OPENFARM_DERIVED_COMPANION_RELATIONSHIPS } from './openfarm-derived.ts';
import type { CompanionRelationship, RelationshipKind } from './schema.ts';

/** Every curated (`curated.ts`) plus every OpenFarm-derived (`openfarm-derived.ts`) relationship. */
export const ALL_COMPANION_RELATIONSHIPS: readonly CompanionRelationship[] = [
  ...CURATED_COMPANION_RELATIONSHIPS,
  ...OPENFARM_DERIVED_COMPANION_RELATIONSHIPS,
];

/** The `PlantLink[]` a plant should carry for each relationship kind. */
export interface PlantLinksByKind {
  readonly companions: PlantLink[];
  readonly antagonists: PlantLink[];
}

/**
 * Expand the directed-edge dataset into per-plant `PlantLink[]` arrays, keyed
 * by plant id — the shape Stage 1.5 attaches directly onto
 * `Plant.companions`/`Plant.antagonists` by looking up a plant's id in the
 * returned map. Every link is built through `@garden-planner/engine`'s own
 * `PlantLinkSchema.parse`, so this stage never restates that shape — it only
 * ever produces genuine, schema-valid `PlantLink`s.
 *
 * A `symmetric: true` edge produces a link on *both* ends (`from` gets a
 * link to `to`, and `to` gets a matching link back to `from`); `symmetric:
 * false` only on `from`, since the claim is one-directional (see
 * `schema.ts`'s doc comment on `symmetric`).
 */
export function toPlantLinksById(
  relationships: readonly CompanionRelationship[] = ALL_COMPANION_RELATIONSHIPS,
): ReadonlyMap<string, PlantLinksByKind> {
  const byId = new Map<string, PlantLinksByKind>();

  const ensure = (id: string): PlantLinksByKind => {
    let entry = byId.get(id);
    if (!entry) {
      entry = { companions: [], antagonists: [] };
      byId.set(id, entry);
    }
    return entry;
  };

  const addLink = (
    ownerId: string,
    targetId: string,
    kind: RelationshipKind,
    evidence: CompanionRelationship['evidence'],
    note: string,
  ): void => {
    const link = PlantLinkSchema.parse({ plantId: targetId, evidence, note });
    const entry = ensure(ownerId);
    (kind === 'companion' ? entry.companions : entry.antagonists).push(link);
  };

  for (const relationship of relationships) {
    addLink(
      relationship.from,
      relationship.to,
      relationship.kind,
      relationship.evidence,
      relationship.note,
    );
    if (relationship.symmetric) {
      addLink(
        relationship.to,
        relationship.from,
        relationship.kind,
        relationship.evidence,
        relationship.note,
      );
    }
  }

  return byId;
}

/**
 * A plant id that ended up with the same companion/antagonist `plantId`
 * listed more than once after expansion — e.g. because a `symmetric: true`
 * `A→B` edge and an independently-authored `B→A` edge both exist for the
 * same pair. `findDuplicateRelationships` (`schema.ts`) deliberately does
 * *not* catch this — it operates on the pre-expansion directed-edge list,
 * where `A→B` and `B→A` are legitimately distinct entries (see that
 * function's own doc comment) — so this checks the actual *output*
 * `toPlantLinksById` produces instead.
 */
export interface DuplicatePlantLink {
  readonly plantId: string;
  readonly kind: RelationshipKind;
  readonly duplicatedPlantId: string;
}

/**
 * Find every plant whose expanded `companions`/`antagonists` list repeats
 * the same `plantId` more than once. Pure and synchronous, so it can run
 * both in tests (as a committed invariant) and in a future Stage 1.5 build
 * step before the result is attached to a merged `Plant`.
 */
export function findDuplicatePlantLinks(
  byId: ReadonlyMap<string, PlantLinksByKind>,
): DuplicatePlantLink[] {
  const duplicates: DuplicatePlantLink[] = [];
  for (const [plantId, entry] of byId) {
    for (const [kind, links] of [
      ['companion', entry.companions],
      ['antagonist', entry.antagonists],
    ] as const) {
      const seen = new Set<string>();
      for (const link of links) {
        if (seen.has(link.plantId)) {
          duplicates.push({ plantId, kind, duplicatedPlantId: link.plantId });
        }
        seen.add(link.plantId);
      }
    }
  }
  return duplicates;
}
