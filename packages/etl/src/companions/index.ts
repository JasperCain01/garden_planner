/**
 * Public surface of the evidence-tagged companion/antagonist relationship
 * dataset (Workplan Stage 1.4 ⭐). See
 * `docs/adr/0008-companion-planting-data.md` for the design, and
 * `packages/etl/README.md`'s "Companion-planting data" section for how to
 * read and extend it. Not wired into the pipeline run (this data has no
 * `SourceAdapter` — see the ADR); Stage 1.5 imports {@link toPlantLinksById}
 * directly to attach companions/antagonists onto merged `Plant` records.
 */

export {
  CompanionRelationshipSchema,
  RelationshipKindSchema,
  findDanglingRelationships,
  findDuplicateRelationships,
  validateCompanionRelationship,
  type CompanionRelationship,
  type DanglingRelationship,
  type RelationshipKind,
} from './schema.ts';

export { buildPlantIdUniverse, PLANT_ID_UNIVERSE } from './plant-id-universe.ts';

export { CURATED_COMPANION_RELATIONSHIPS } from './curated.ts';

export {
  deriveOpenFarmCompanionRelationships,
  OPENFARM_DERIVED_COMPANION_RELATIONSHIPS,
} from './openfarm-derived.ts';

export {
  ALL_COMPANION_RELATIONSHIPS,
  findDuplicatePlantLinks,
  toPlantLinksById,
  type DuplicatePlantLink,
  type PlantLinksByKind,
} from './relationships.ts';
