/**
 * Curated slug aliases for the Stage 1.5 merge (see
 * `docs/adr/0009-dataset-merge-and-licensing.md`).
 *
 * ── Why this file exists ──
 * The join-key policy (ADR 0009) reconciles the three inputs by **GBIF id when
 * present, normalized scientific name as the fallback, and the shared slug id in
 * practice** (the spacing table and companion data were authored to share
 * OpenFarm's slug namespace, so 9 of the 12 spacing crops line up by id alone).
 *
 * Three spacing/companion slugs deliberately use their **British common name**
 * where OpenFarm's rescue dump uses a different slug for the *same species*:
 *
 *   - `beetroot`     (spacing)  ↔ `beet`       (OpenFarm) — both *Beta vulgaris*
 *   - `french-bean`  (spacing)  ↔ `green-bean` (OpenFarm) — both *Phaseolus vulgaris*
 *
 * The scientific-name fallback can't resolve these automatically because in the
 * OpenFarm data a single binomial maps to **several distinct crops** (e.g.
 * *Beta vulgaris* is `beet`, `golden-beet`, `rainbow-chard` and `swiss-chard-3`;
 * *Phaseolus vulgaris* is `green-bean` and `wax-bean`). Auto-joining by binomial
 * would wrongly staple beetroot's spacing onto chard, or french-bean's onto a
 * wax bean. So the ambiguous cases are pinned **explicitly** here, one line each,
 * and the merge *verifies* each alias by checking the two records really do share
 * a scientific name before it trusts the alias (a mistyped target fails loudly
 * rather than silently mis-attaching). This is scientific name used as a
 * **safety check on a curated decision**, which is the honest role for a key
 * that isn't unique in this dataset.
 *
 * ── Why `broad-bean` is NOT here ──
 * The spacing table's `broad-bean` (*Vicia faba*) has **no** mappable OpenFarm
 * counterpart: OpenFarm's `fava-bean` record is unmappable (no curated edible
 * category and no in-row spread — see `sources/openfarm/map.ts`), so there is no
 * `Plant` to attach broad-bean's spacing or companion links to. It is therefore
 * left out of the shipped artifact this round, with a stated reason in the merge
 * report, rather than aliased to a plant that doesn't exist. See ADR 0009's
 * Consequences for the known-gap note.
 *
 * ── Direction ──
 * Keys are the *pre-merge* slug that appears in the spacing table / companion
 * data; values are the *OpenFarm plant id* that survives into the final dataset.
 * The merge applies this map uniformly to **both** the spacing attach step and
 * the companion-link remap step, so a unified id can never dangle: a companion
 * link authored against `french-bean` is rewritten to `green-bean` exactly as
 * the spacing slice is.
 */

/**
 * Pre-merge slug → final OpenFarm plant id, for the crops whose British spacing
 * slug differs from OpenFarm's slug for the same species. Kept tiny and explicit
 * on purpose; every entry is verified against scientific name at merge time.
 */
export const SLUG_ALIASES: Readonly<Record<string, string>> = {
  beetroot: 'beet',
  'french-bean': 'green-bean',
};
