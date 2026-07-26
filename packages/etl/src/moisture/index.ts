/**
 * Public surface of the curated soil-moisture table.
 *
 * A thin enrichment slice keyed to crop id, folded into the Stage 1.5 merge
 * exactly as the hand-verified spacing table is — original curation, **not** a
 * `SourceAdapter` (`src/pipeline/source.ts`), and not wired into the pipeline
 * run. See `./schema.ts` for why it exists and why its evidence bar differs
 * from the spacing table's.
 */

export {
  MOISTURE_PROVENANCE,
  MoistureRecordSchema,
  validateMoistureRecord,
  validateMoistureTable,
  type MoistureRecord,
} from './schema.ts';

export { CURATED_MOISTURE } from './table.ts';
