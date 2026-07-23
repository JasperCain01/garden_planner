/**
 * The join-key primitives for the Stage 1.5 merge (policy in
 * `docs/adr/0009-dataset-merge-and-licensing.md`).
 *
 * The keystone decision this stage exists to make is **how records that describe
 * the same crop find each other** across the three inputs. The policy, in
 * priority order, is:
 *
 *   1. **GBIF id** when both sides carry one — the canonical, exact join key the
 *      whole pipeline was designed around (`DESIGN.md` §2, ADR 0005).
 *   2. **Normalized scientific name**, but *only when it is unambiguous* — i.e.
 *      exactly one record on each side bears that binomial. This guard is not
 *      optional politeness: in the real OpenFarm data one binomial routinely
 *      covers several distinct crops (*Cucurbita pepo* = courgette, acorn squash,
 *      spaghetti squash…), so an unguarded name join would silently merge crops
 *      the app must keep separate. When a name is ambiguous we **do not guess** —
 *      we keep the records separate and let a curated alias decide (step 3).
 *   3. **Shared slug id**, the key that actually does the work today: the spacing
 *      table and companion data were authored to share OpenFarm's slug namespace,
 *      with a tiny curated {@link SLUG_ALIASES} table for the few British-name
 *      divergences (`beetroot`↔`beet`), each verified by scientific name.
 *
 * Why gbifId is currently inert but still first: GBIF has been unreachable in
 * this sandbox class every session (confirmed again this session — `api.gbif.org`
 * returns a 403 policy denial at the egress proxy) and the committed name cache
 * is empty, so every OpenFarm `Plant` currently carries `gbifId: null`. The join
 * therefore *degrades gracefully* to steps 2–3 today and *upgrades automatically*
 * to step 1 the moment a contributor runs the ETL with GBIF reachable. Keeping
 * gbifId first means that upgrade needs no code change — only a repopulated cache.
 */

import type { Plant } from '@garden-planner/engine';
import type { SpacingRecord } from '../spacing/schema.ts';

/**
 * Normalize a scientific name for equality comparison: trim, collapse internal
 * whitespace, lowercase. Mirrors the normalization the spacing table's own
 * duplicate check uses (`spacing/schema.ts#validateSpacingTable`) so the two can
 * never disagree about whether two binomials are "the same".
 */
export function normalizeScientificName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Indices over a set of `Plant`s, built once so the per-record joins below stay
 * O(1) rather than rescanning the whole dataset for each of the 12 spacing rows
 * and ~80 companion ids.
 *
 * `byNormScientificName` maps to an **array** on purpose: a binomial is not
 * unique in this data (see the module doc), and the ambiguity guard needs to see
 * "how many candidates share this name", not just the first.
 */
export interface PlantIndex {
  readonly bySlug: ReadonlyMap<string, Plant>;
  readonly byGbifId: ReadonlyMap<number, Plant>;
  readonly byNormScientificName: ReadonlyMap<string, readonly Plant[]>;
}

/** Build the {@link PlantIndex} for a set of plants. Pure; no I/O. */
export function buildPlantIndex(plants: readonly Plant[]): PlantIndex {
  const bySlug = new Map<string, Plant>();
  const byGbifId = new Map<number, Plant>();
  const byNormScientificName = new Map<string, Plant[]>();

  for (const plant of plants) {
    bySlug.set(plant.id, plant);
    if (plant.gbifId !== null) byGbifId.set(plant.gbifId, plant);
    const key = normalizeScientificName(plant.scientificName);
    const bucket = byNormScientificName.get(key);
    if (bucket) bucket.push(plant);
    else byNormScientificName.set(key, [plant]);
  }

  return { bySlug, byGbifId, byNormScientificName };
}

/** How a spacing row found its target plant, for the merge report. */
export type SpacingJoinVia = 'slug' | 'scientificName' | 'alias';

/** The result of trying to locate the plant a spacing slice belongs to. */
export type SpacingJoin =
  | { readonly matched: true; readonly plant: Plant; readonly via: SpacingJoinVia }
  | { readonly matched: false; readonly reason: string };

/**
 * Locate the `Plant` a hand-verified spacing row should attach to, applying the
 * join policy (steps 2–3 above; a spacing row is a thin slice with no `gbifId`
 * of its own, so step 1 never applies to it — gbifId reconciliation is between
 * two *full* `Plant` sources, see {@link unifyPlantsByIdentity}).
 *
 * Order matters and encodes the policy:
 *   1. **Exact slug** — the record's id equals a plant's id. Trusted outright:
 *      the id universe was constructed so a shared slug means the same crop. This
 *      is what lets `leek` attach even though OpenFarm calls it *Allium porrum*
 *      while the spacing table calls it *Allium ampeloprasum* (synonyms) — a case
 *      a scientific-name join would *miss*.
 *   2. **Unambiguous scientific name** — one and only one plant bears the row's
 *      binomial. Trusted. (Currently dormant for the shipped 12 rows, since the
 *      slug-mismatched ones are all ambiguous-by-name; kept because it is the
 *      correct general rule and will fire for a future uniquely-named crop.)
 *   3. **Curated alias**, verified by scientific name — resolves the ambiguous
 *      slug-mismatch cases ({@link SLUG_ALIASES}). A present alias whose target's
 *      binomial disagrees with the row's is a configuration error and returns a
 *      loud unmatched reason rather than mis-attaching.
 *   4. Otherwise **unmatched**, with a reason (e.g. `broad-bean`).
 */
export function findSpacingTarget(
  record: SpacingRecord,
  index: PlantIndex,
  aliases: Readonly<Record<string, string>>,
): SpacingJoin {
  // 1. Exact slug.
  const bySlug = index.bySlug.get(record.id);
  if (bySlug) return { matched: true, plant: bySlug, via: 'slug' };

  // 2. Unambiguous scientific name.
  const byName = index.byNormScientificName.get(normalizeScientificName(record.scientificName));
  if (byName && byName.length === 1) {
    return { matched: true, plant: byName[0], via: 'scientificName' };
  }

  // 3. Curated alias, verified by scientific name.
  const aliasTarget = aliases[record.id];
  if (aliasTarget !== undefined) {
    const plant = index.bySlug.get(aliasTarget);
    if (!plant) {
      return {
        matched: false,
        reason: `alias "${record.id}" → "${aliasTarget}" points at no known plant`,
      };
    }
    if (
      normalizeScientificName(plant.scientificName) !==
      normalizeScientificName(record.scientificName)
    ) {
      return {
        matched: false,
        reason:
          `alias "${record.id}" → "${aliasTarget}" rejected: scientific names disagree ` +
          `("${record.scientificName}" vs "${plant.scientificName}")`,
      };
    }
    return { matched: true, plant, via: 'alias' };
  }

  // 4. No home.
  const ambiguous = byName && byName.length > 1;
  return {
    matched: false,
    reason: ambiguous
      ? `scientific name "${record.scientificName}" is ambiguous (${byName.length} candidate plants) ` +
        `and no slug/alias resolves "${record.id}"`
      : `no plant matches slug "${record.id}" or scientific name "${record.scientificName}"`,
  };
}

/**
 * Resolve a *pre-merge* slug (as used in the companion/antagonist data, whose id
 * universe is the union of spacing ids and OpenFarm-mapped ids) to the id of the
 * plant that actually survives into the final dataset, or `null` if none does.
 *
 * This is the companion-side half of the same unification the spacing attach
 * uses, so a link authored against `french-bean` is rewritten to `green-bean`
 * exactly as french-bean's spacing is — keeping referential integrity by
 * construction rather than hoping the ids happened to line up.
 */
export function canonicalPlantId(
  preId: string,
  plantIds: ReadonlySet<string>,
  aliases: Readonly<Record<string, string>>,
): string | null {
  if (plantIds.has(preId)) return preId;
  const aliasTarget = aliases[preId];
  if (aliasTarget !== undefined && plantIds.has(aliasTarget)) return aliasTarget;
  return null;
}

/** One group of `Plant`s judged to be the same crop across sources. */
export interface IdentityGroup {
  /** The join key that grouped them, for logging/audit. */
  readonly via: 'gbifId' | 'standalone';
  readonly key: string;
  readonly plants: readonly Plant[];
}

/**
 * Group `Plant`s from one or more sources by taxonomic identity so the same crop
 * from different sources becomes one record. This is the cross-source
 * reconciliation the merge uses once a **second** full `Plant` source (PFAF,
 * Permapeople) exists alongside OpenFarm.
 *
 * **Only `gbifId` unifies two full records** — deliberately. `gbifId` is exact,
 * so two records sharing one are unambiguously the same species. Scientific name
 * is *not* used here, even as a fallback, because in this domain one binomial
 * routinely covers **several distinct crops the app must keep apart** (*Cucurbita
 * pepo* = courgette, acorn squash, spaghetti squash…). Auto-merging two full
 * records by name would silently collapse crops a user needs to place separately —
 * a far worse failure than leaving a genuine cross-source duplicate un-merged
 * until GBIF can join them exactly. Scientific name's safe role is the
 * *uniqueness-guarded attach* in {@link findSpacingTarget}, where there is a single
 * spacing slice per species, not the merging of two full crop records.
 *
 * So with only OpenFarm today (every `gbifId` currently `null` — GBIF unreachable)
 * this is a pass-through: every plant is its own singleton group. It is
 * implemented and tested now (see `join.test.ts`) so the gbifId reconciliation is
 * a real, proven capability the moment a second gbif-bearing source arrives.
 */
export function unifyPlantsByIdentity(plants: readonly Plant[]): IdentityGroup[] {
  const byGbif = new Map<number, Plant[]>();
  const groups: IdentityGroup[] = [];

  for (const plant of plants) {
    if (plant.gbifId === null) {
      // No exact key — stands alone (never guessed-merged by name; see the doc).
      groups.push({ via: 'standalone', key: plant.id, plants: [plant] });
      continue;
    }
    const bucket = byGbif.get(plant.gbifId);
    if (bucket) {
      bucket.push(plant);
    } else {
      const fresh = [plant];
      byGbif.set(plant.gbifId, fresh);
      groups.push({ via: 'gbifId', key: String(plant.gbifId), plants: fresh });
    }
  }

  return groups;
}
