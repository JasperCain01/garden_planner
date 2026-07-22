/**
 * Companion relationships mechanically derived from OpenFarm's own scraped
 * `companions` field (Workplan Stage 1.4 — see
 * `docs/adr/0008-companion-planting-data.md`).
 *
 * This is the *ingestion* half of Stage 1.4, deliberately separated from
 * `curated.ts`'s hand-authored relationships (the *curation* half) — see the
 * ADR's "SourceAdapter or curation?" section for why this file is a plain
 * pure-function transform over the already-committed OpenFarm cache rather
 * than a `SourceAdapter` (`../pipeline/source.ts`): that interface resolves
 * *plant names* for GBIF, not *relationships between two plants*, so a
 * companion dataset doesn't fit its shape.
 *
 * Every relationship this file produces is `evidence: 'traditional'` — not
 * as a blanket default (`docs/adr/0006`'s rejected alternative), but because
 * OpenFarm's `companions` field genuinely has no citation of its own: it is
 * a scraped wiki field, so "traditional" is the honest ceiling for anything
 * built on it alone, exactly as `docs/adr/0006` §2 anticipated when it left
 * this field unmapped for this stage to judge.
 */

import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';
import { OPENFARM_CACHE_RETRIEVED_AT } from '../sources/openfarm/cache.ts';
import { OPENFARM_CACHE_RECORDS, PLANT_ID_UNIVERSE } from './plant-id-universe.ts';
import type { CompanionRelationship } from './schema.ts';

/**
 * Derive companion relationships from a set of raw OpenFarm records, keeping
 * only edges where **both** ends are in the given plant-id universe — so the
 * derived data can't introduce a dangling link even though OpenFarm's
 * `companions` field freely references ornamentals, forage crops, and other
 * slugs this project never maps to a `Plant` (see `docs/adr/0006` §2).
 *
 * Each edge is recorded exactly as its source page stated it: `symmetric:
 * false`. OpenFarm's companions field is directional scrape data (one page
 * lists another as a companion; the reverse page may or may not say the same
 * — in this dump, only ~48% of pairs are mutually listed), so asserting
 * `symmetric: true` here would invent a claim the source never made for the
 * un-reciprocated half. Where a pair *is* independently listed both ways in
 * the raw data, that naturally produces two separate (still directed)
 * relationships — nothing here special-cases it.
 *
 * Pure and synchronous — no network, no filesystem — so tests exercise it
 * against small fixtures instead of the real 340-record dump.
 */
export function deriveOpenFarmCompanionRelationships(
  records: readonly OpenFarmCropRaw[],
  idUniverse: ReadonlySet<string>,
  retrievedAt: string,
): CompanionRelationship[] {
  const relationships: CompanionRelationship[] = [];

  for (const record of records) {
    // Only derive edges *from* a record this project actually maps to a
    // `Plant` (i.e. its own slug is in the id universe) — otherwise `from`
    // itself would dangle, defeating the whole point of checking `to`.
    if (!idUniverse.has(record.slug) || !record.companions) continue;

    for (const companionSlug of record.companions) {
      if (companionSlug === record.slug) continue; // no self-loops
      if (!idUniverse.has(companionSlug)) continue; // e.g. an ornamental this project never maps

      relationships.push({
        from: record.slug,
        to: companionSlug,
        kind: 'companion',
        evidence: 'traditional',
        note:
          `OpenFarm's "${record.name}" page lists "${companionSlug}" as a companion. ` +
          'This is a scraped wiki field with no citation of its own, so it informs a ' +
          '"traditional" tag at best, never "well-supported" — see docs/adr/0006 §2 and ' +
          'docs/adr/0008.',
        sources: [
          {
            source: 'OpenFarm crops rescue (community Wayback Machine recovery)',
            sourceId: record.slug,
            url: record.source.waybackUrl,
            license: record.source.license,
            retrievedAt,
          },
        ],
        symmetric: false,
      });
    }
  }

  return relationships;
}

/**
 * The real OpenFarm-derived relationships, computed from the committed cache
 * and the real id universe — what `relationships.ts` combines with the
 * hand-curated set. Reuses `plant-id-universe.ts`'s already-loaded
 * `OPENFARM_CACHE_RECORDS` rather than reading and re-validating the cache
 * file a second time.
 */
export const OPENFARM_DERIVED_COMPANION_RELATIONSHIPS: readonly CompanionRelationship[] =
  deriveOpenFarmCompanionRelationships(
    OPENFARM_CACHE_RECORDS,
    PLANT_ID_UNIVERSE,
    OPENFARM_CACHE_RETRIEVED_AT,
  );
