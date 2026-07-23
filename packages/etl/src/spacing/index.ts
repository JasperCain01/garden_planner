/**
 * Public surface of the hand-verified spacing table (Workplan Stage 1.3 ⭐).
 *
 * See `docs/adr/0007-hand-verified-spacing.md` for the design, and
 * `packages/etl/README.md`'s "Hand-verified spacing table" section for how to
 * read and extend it. This is original curation, **not** a `SourceAdapter`
 * (`src/pipeline/source.ts`) — it isn't wired into the pipeline run; Stage 1.5
 * imports {@link HAND_VERIFIED_SPACING} directly to merge spacing onto records.
 */

export {
  MIN_SOURCES_PER_METHOD,
  SPACING_SANITY_BOUNDS,
  SpacingMethodProvenanceSchema,
  SpacingRecordSchema,
  spacingRecordSources,
  spacingSanityIssues,
  validateSpacingRecord,
  validateSpacingTable,
  type SpacingMethodProvenance,
  type SpacingRecord,
} from './schema.ts';

export { HAND_VERIFIED_SPACING } from './table.ts';
