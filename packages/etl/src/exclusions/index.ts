/**
 * Public surface of the UK-outdoor exclusion list (Workplan Stage 6.0).
 *
 * A curation slice in the same mould as the hand-verified spacing table and the
 * curated moisture table: original judgement keyed to a crop id, folded into
 * the Stage 1.5 merge, deliberately **not** a `SourceAdapter` — nothing is
 * fetched. Unlike those two it *removes* rather than enriches; see `./schema.ts`
 * for why, and `docs/adr/0025-uk-outdoor-crop-exclusions.md` for the
 * delete-versus-flag decision behind it.
 */

export {
  EXCLUSION_BASES,
  ExcludedCropSchema,
  ExclusionBasisSchema,
  validateExclusionTable,
  type ExcludedCrop,
  type ExclusionBasis,
} from './schema.ts';

export { EXCLUDED_CROPS } from './table.ts';
