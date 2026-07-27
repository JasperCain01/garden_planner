# `@garden-planner/etl`

The build-time data pipeline. Runs only on a contributor's machine — **the
deployed app never runs this code** (see `docs/adr/0003`). Its job is to pull
plant data from external sources, normalize it into the Stage 0.2 `Plant`
schema (`@garden-planner/engine`), reconcile duplicates, validate everything,
and write the static dataset committed to `/data`. This package is
framework-free (no React/DOM), like `@garden-planner/engine`.

Full design reasoning: [`docs/adr/0005-gbif-name-resolver.md`](../../docs/adr/0005-gbif-name-resolver.md)
(pipeline shell + GBIF resolver) and
[`docs/adr/0006-openfarm-source-adapter.md`](../../docs/adr/0006-openfarm-source-adapter.md)
(the first source adapter).

## Status (Stage 6.0)

What exists today:

- **A runnable pipeline shell** (`src/pipeline/run.ts`) that sequences
  "gather names to resolve → resolve them against GBIF → log progress".
- **A GBIF scientific-name resolver** (`src/resolve/`) that fills the schema's
  nullable `gbifId` — the join key later sources are reconciled by.
- **The "add a source" extension point** (`src/pipeline/source.ts`) — the
  `SourceAdapter` interface every source implements.
- **The first real source adapter: OpenFarm** (`src/sources/openfarm/`), a
  community-rescued dump (see the ADR for why — OpenFarm's own dump never
  existed) mapped into the Stage 0.2 `Plant` schema, GBIF-resolved via the
  resolver above. `src/index.ts` registers it in place of Stage 1.1's demo
  `starterNamesSource` (`src/pipeline/starter-source.ts`, kept as a reference
  implementation of the interface but no longer the default).

- **The hand-verified spacing table: Stage 1.3** (`src/spacing/`), a curated,
  method-aware spacing table for 12 common British edibles, each figure
  cross-checked against ≥2 authoritative sources with the citations recorded
  per growing method. This is **original curation, not a source adapter** — see
  the section below and
  [`docs/adr/0007`](../../docs/adr/0007-hand-verified-spacing.md).
- **Companion-planting data: Stage 1.4** (`src/companions/`), evidence-tagged
  (`well-supported`/`traditional`) companion and antagonist relationships: 8
  hand-curated, cited relationships plus 78 mechanically derived from
  OpenFarm's own `companions` field. Also **not a source adapter** — see the
  section below and
  [`docs/adr/0008`](../../docs/adr/0008-companion-planting-data.md).

- **Maintainer-curated plants: Stage 1.7** (`src/curated/`), a hand-authored
  `Plant[]` for a maintainer to add a crop to the shipped dataset permanently
  — the same unrelaxed `validatePlant` bar as every OpenFarm-sourced record
  (distinct from Stage 3.6's session-only, relaxed-schema user crops). Also
  **not a source adapter** — see the section below and
  [`docs/adr/0021`](../../docs/adr/0021-curated-plant-input.md).

- **The merge, validation gate, and artifact emitter: Stage 1.5** (`src/merge/`),
  the ⭐ keystone that reconciles the four inputs above into the committed
  `data/plants.json` — folding in curated plants (curated wins on a collision),
  joining spacing and companion slices onto the resulting plants, applying the
  conflict rules (hand-verified spacing wins), remapping companion-link ids for
  referential integrity, and enforcing the **hard-fail validation gate**. Run
  with `npm run build:data`. See the section below and
  [`docs/adr/0009`](../../docs/adr/0009-dataset-merge-and-licensing.md) /
  [`docs/adr/0021`](../../docs/adr/0021-curated-plant-input.md).

**PFAF and Permapeople adapters (the rest of 1.2) are blocked, not skipped.**
PFAF's bulk database is paywalled ($30–150, no free bulk download exists);
Permapeople's API needs a signed-up account's API key. A substitute source
(USDA PLANTS) turned out to be unreachable from this sandbox, and the one
freely-licensed alternative found (`bripatch/plant-variety-database`) has
provenance red flags serious enough not to trust without independent
verification. Full detail, including exactly what would unblock each one, is
in [`docs/adr/0006`](../../docs/adr/0006-openfarm-source-adapter.md)'s
addendum — read that before re-researching this from scratch.

## Running it

```bash
npm run start -w @garden-planner/etl
```

This loads the committed GBIF cache (`cache/gbif-name-cache.json`), resolves
every name it doesn't already have a cached answer for (the OpenFarm
adapter's ~160 mappable crops — see `src/sources/openfarm/categories.ts` —
via the committed `cache/openfarm-crops.json`, no network needed to read the
source data itself), logs each outcome, and writes any newly-learned
resolutions back to the GBIF cache file — but only if something new was
actually learned, so a run where every name was already cached leaves the
file untouched. Commit the file if it changed.

`npm run typecheck -w @garden-planner/etl` and `npm run test -w
@garden-planner/etl` work the same as any other workspace; `npm run build -w
@garden-planner/etl` type-checks (this package ships no compiled output — the
`start` script runs the TypeScript source directly).

## Building the dataset (`src/merge/`, Stage 1.5)

```bash
npm run build:data -w @garden-planner/etl
```

This is the step that writes the app's shipped data. It:

1. **Probes GBIF reachability** once. If reachable, it resolves names live and
   fills each plant's `gbifId`; if not (the current reality — `api.gbif.org` is
   blocked), it builds with `gbifId: null` fast, without waiting on ~160 doomed
   network calls.
2. **Gathers** the mappable OpenFarm plants (keeping a record even when GBIF
   can't place it — the join key falls back to scientific name / slug), skipping
   any with absurd spacing with a stated reason.
3. **Folds in the curated plants** (`src/curated/plants.ts`, Stage 1.7). A
   curated plant whose id collides with an OpenFarm plant's (directly, or via
   `SLUG_ALIASES`) **replaces it outright** — curated wins, mirroring
   "hand-verified spacing wins" one level up (ADR 0009 §2 / ADR 0021). A
   non-colliding curated plant is simply added as a new plant. From here on a
   curated plant is an ordinary `Plant` — no special-casing in the steps below.
4. **Drops the excluded crops** (`src/exclusions/table.ts`, Stage 6.0): 24 crops
   that cannot be grown outdoors in Britain leave the dataset here, before
   anything joins onto them, so a spacing row or companion link aimed at one is
   reported as unattached/dropped by the ordinary machinery rather than
   dangling (ADR 0025).
5. **Merges** the hand-verified spacing (which _wins_ over OpenFarm's scraped row
   spacing) and the companion/antagonist links onto the right plants, joining by
   GBIF id → unambiguous scientific name → shared slug / a small curated alias
   table (`beetroot`→`beet`, `french-bean`→`green-bean`), and remapping
   companion-link ids through the same unification so nothing dangles.
6. Runs the **hard-fail validation gate** (schema + referential integrity +
   sanity bounds) over the whole set — the build fails loudly, listing every
   problem, if any record is malformed, dangling-referenced, or absurd.
7. Writes `data/plants.json` and reports what it attached, remapped, and dropped.

The reconciliation policy and the licensing decision are documented in
[`docs/adr/0009`](../../docs/adr/0009-dataset-merge-and-licensing.md); the
curated input's shape, its join-order placement, and the "curated wins"
conflict rule are in
[`docs/adr/0021`](../../docs/adr/0021-curated-plant-input.md) (which also
records that Stage 1.7 closed the `broad-bean` gap ADR 0009 had left open).
The merge logic is pure and injectable, so `src/merge/*.test.ts` exercises it
(including the gate failing on an intentionally-broken record) without any
network access.

## Maintainer-curated plants (`src/curated/`)

A channel for the **maintainer** to add a crop to the shipped dataset
permanently, by hand (Stage 1.7 — full design in
[`docs/adr/0021`](../../docs/adr/0021-curated-plant-input.md)). Distinct from
the in-app add-crop form (Stage 3.6, `docs/adr/0011`): that path is
session-only and deliberately relaxed-schema (no scientific name, no
citation required); this one ships in `data/plants.json` and is held to the
**same unrelaxed `validatePlant` bar** as every OpenFarm-sourced record — full
identity, full provenance, no shortcut. Also deliberately **not** a
`SourceAdapter`: there is no external source to fetch, only hand-verified
facts, exactly like the spacing table and companion data.

- **The data** lives in `src/curated/plants.ts` as `CURATED_PLANTS`, a plain
  `Plant[]` — not wrapped in `validatePlant()` at authoring time, matching
  `spacing/table.ts`'s convention of a plain array plus a schema-validating
  test file (`plants.test.ts`) rather than `companions/curated.ts`'s "the type
  covers it" style, since a full `Plant` is a much bigger record to typo.
- **Eight crops ship today.** Stage 1.7 added two to prove the channel:
  `broad-bean` (closes the gap ADR 0009 documented — OpenFarm has no mappable
  _Vicia faba_, so the Stage 1.3 spacing row and the `leek` antagonist link had
  nothing to attach to until then) and `jerusalem-artichoke` (a plain new
  addition, proving the no-collision path). Stage 6.0 then used it for real,
  adding the six British staples the OpenFarm-derived catalogue never had:
  `apple`, `pear`, `raspberry`, `brussels-sprouts`, `swede` and `pumpkin`, each
  with RHS-cited spacing, hardiness, soil and season data. All eight are
  **link-free** by design — see the ADR for why that's sufficient for
  referential integrity without weakening the existing gate.
- **These eight are the whole of the dataset's hardiness and season coverage**
  (8/144). Adding a curated crop with those fields filled is currently the only
  way the suitability engine gets to score on more than light and soil.
- **Conflict rule**: a curated plant's `id` colliding with an OpenFarm plant's
  (directly or via `SLUG_ALIASES`) makes the curated record replace it
  wholesale, keeping the surviving canonical id (`merge.ts`'s step 0). See
  the ADR for why the id, not necessarily the curated author's own choice,
  is what survives.

### Adding a curated crop

1. Add a `Plant` object literal to `CURATED_PLANTS` in `src/curated/plants.ts`.
   Give it full identity (`id`, `commonName`, `scientificName`, `gbifId: null`),
   `category`, `light`, a `spacing` block, and `provenance.sources` with at
   least one real, honestly-cited source — the same bar `validatePlant`
   enforces for every other shipped record.
2. Keep it link-free (no `companions`/`antagonists` of your own) unless you
   also add the relationship to `companions/curated.ts` (Stage 1.4's channel,
   already checked against the plant-id universe) — don't invent a second
   path for the same fact.
3. If this crop should replace an existing OpenFarm-sourced record, give it
   that record's exact `id` (or an entry in `merge/aliases.ts#SLUG_ALIASES`
   if the natural curated id differs) — see the ADR for what "wins" means.
4. `npm run test -w @garden-planner/etl` re-runs `plants.test.ts` (schema
   validity, unique ids, no `user-` namespace, link-free) and the merge/
   build-dataset suites (fold-in behaviour, override reconciliation, the
   gate failing on a broken curated record).
5. `npm run build:data -w @garden-planner/etl` regenerates `data/plants.json`
   with the new crop, then give it an icon: add its id to `CROP_ARCHETYPES` in
   `tools/icons/classification.ts` and re-run
   `node --experimental-strip-types tools/icons/generate.ts` (Stage 4.1; see
   `docs/icon-style-guide.md`). This is not optional — `app/src/icons/
resolveIcon.test.ts` fails if a shipped id has no icon, and the generator
   fails if a classified id no longer ships.

## Offline-first: the cache

`cache/gbif-name-cache.json` is a **committed file**, not a build artifact you
regenerate from nothing each time. It's keyed by a normalized query name; each
entry is either a confident GBIF match or a confident "no match" — see the ADR
for why transport failures are deliberately never cached. Once a name is in
the cache, resolving it again never touches the network, which is what makes
CI, a fresh clone, and an offline contributor all work without GBIF access.

The committed cache currently ships **empty**: this development environment's
network egress policy blocks `api.gbif.org` (confirmed via the environment's
proxy status endpoint), so the resolver's live network path couldn't be
exercised in this session — only its offline/cached path (which is what the
unit tests cover). A contributor with GBIF access can run `npm run start -w
@garden-planner/etl` to populate it for real.

## Offline-first: the OpenFarm source cache

`cache/openfarm-crops.json` is a different kind of cache: a **committed
snapshot of the whole source** (340 records, community-rescued — see
[`docs/adr/0006`](../../docs/adr/0006-openfarm-source-adapter.md)), not a
per-query index like the GBIF cache above. `src/sources/openfarm/cache.ts#loadOpenFarmCache`
reads it directly; nothing in the normal pipeline run re-fetches it. A
maintainer can refresh it from the network with
`cache.ts#refreshOpenFarmCache`, backed by the injectable transport in
`src/sources/openfarm/transport.ts` (unit tests inject a stub, exactly like
`resolve/gbif-transport.ts`).

## Hand-verified spacing table (`src/spacing/`)

The one part of the pipeline that is **original curation, not ingestion**
(Stage 1.3 ⭐ — full design in
[`docs/adr/0007`](../../docs/adr/0007-hand-verified-spacing.md)). It is
deliberately **not** a `SourceAdapter`: there is no external source to fetch:
these are spacing figures hand-verified against authoritative charts.

- **The data** lives in `src/spacing/table.ts` as `HAND_VERIFIED_SPACING`, a
  typed `SpacingRecord[]`. A `.ts` module (not JSON) so every figure can carry
  an inline comment explaining the value and its sources. It covers 12 common
  British edibles (the Stage 1.1 demo five plus overlap with the OpenFarm crop
  list, to maximise Stage 1.5 merge overlap).
- **The shape** (`src/spacing/schema.ts`) reuses the engine's `SpacingSchema`
  verbatim (row and/or intensive) and adds **per-method provenance**:
  `provenance.row` / `provenance.intensive`, each requiring **≥2 source
  citations**, and each coupled to its figure so an intensive density can never
  be back-filled from row-only citations. Sanity bounds
  (`spacingSanityIssues`, `SPACING_SANITY_BOUNDS`) reject implausible values on
  top of the schema's positivity floor.
- **Sourcing.** Each figure is cross-checked against ≥2 sources (RHS + Old
  Farmer's Almanac for row figures; two square-foot-gardening charts for
  intensive figures), recorded per row. Genuine source disagreements (e.g.
  onion 9-vs-16 per square) are recorded in each row's `note`, not smoothed
  over. See the ADR for the retrieval-honesty caveat (the source sites were
  network-blocked in the authoring sandbox; figures came from search snippets
  of the real pages and are reviewer-re-verifiable).

### Adding a crop to the spacing table

1. Add a `SpacingRecord` to `HAND_VERIFIED_SPACING` in `src/spacing/table.ts`.
2. Give it `id`/`commonName`/`scientificName`/`category`, and a `spacing` block
   with `row` and/or `intensive` — **only the methods you can actually cite**.
3. For each method present, add **≥2 `provenance` citations** that state _that
   method's_ figure. Don't derive an intensive density from a row figure — leave
   the block absent if you can't cite it (the schema allows row-only or
   intensive-only).
4. `npm run test -w @garden-planner/etl` re-runs `table.test.ts`, which
   validates every row, enforces the ≥2-source and unique-id rules, and checks
   each intensive figure has a real SFG citation.

## Curated soil-moisture table (`src/moisture/`)

A thin enrichment slice, added because the shipped dataset had soil data on 2
of its then-162 records — so the suitability engine's `soil` dimension was
inert and the plot form's "Soil moisture" dropdown asked a question nothing
could use. With almost every crop `full-sun`, that left spacing as the app's
only working axis. It takes soil coverage to 80 of the 144 crops shipped today.

It follows the spacing table's pattern exactly: original curation keyed to a
crop id, folded into the Stage 1.5 merge, **not** a `SourceAdapter`.

Three rules worth knowing before you edit it:

- **It enriches, never overwrites.** A plant that already states its own
  moisture (a Stage 1.7 curated record, say) keeps it; the row is recorded in
  the merge report as skipped, not silently dropped.
- **It joins on the exact plant id and nothing else** — no scientific-name or
  alias fallback, unlike a spacing row. `moisture/table.test.ts` asserts every
  id resolves against `data/plants.json`, so a typo fails a test rather than
  quietly enriching nothing.
- **It carries no per-figure citations, on purpose.** The spacing table
  requires ≥2 sources per figure because a spacing figure is genuinely
  contested. A moisture preference is not: "peas suffer in dry soil" is
  universal, the vocabulary is a three-value enum, and there is no decimal to
  misplace. What each row carries instead is a **required `note`** giving the
  reason — that is the reviewable artifact here. `MOISTURE_PROVENANCE` records
  in the shipped artifact that these were hand-authored rather than retrieved,
  so nothing downstream overstates them.

### Adding a moisture row

Append to `CURATED_MOISTURE` in `src/moisture/table.ts`:

```ts
{
  id: 'parsnip',                 // must be an exact Plant.id that ships
  moisture: ['dry', 'moist'],    // what it is happy in, not what it survives
  note: 'Deep tap root reaches its own water and dislikes waterlogged ground.',
},
```

Then `npm run build:data` from this package and commit the regenerated
`data/plants.json`. If you'd rather say nothing about a crop, **omit the row** —
absent scores as `unknown-plant`, which is the honest answer.

## UK-outdoor exclusion list (`src/exclusions/`)

The one curation slice that **removes** rather than enriches (Stage 6.0, full
reasoning in [`docs/adr/0025`](../../docs/adr/0025-uk-outdoor-crop-exclusions.md)).
The dataset's OpenFarm ancestry is North-American-leaning, so it arrived
carrying tropical fruit, citrus and heat-demanding annuals that no British
gardener can grow outdoors. `EXCLUDED_CROPS` names 24 of them and the merge
drops each one before anything joins onto it.

The test every row had to pass: **in an average British summer, can this crop
give a usable harvest outdoors, with no greenhouse or polytunnel?** Twenty-four
fail it, on one of two grounds — `too-tender` (a British winter kills it, and it
can't be grown to a harvest as a summer annual either) or `wont-ripen` (it lives
here quite happily and never gives you anything).

Two things it deliberately is not:

- **Not a de-duplication pass.** Cultivar padding (four onions, seven squashes,
  six peppers) all grows here perfectly well and stays.
- **Not a flag.** An excluded crop is absent from `data/plants.json`, not
  marked. What the list keeps is the _reasoning_ — the ADR explains why that
  trade is the right one, and Stage 3.6's in-app add-crop form is the escape
  hatch that makes it safe.

### Adding an exclusion

Append to `EXCLUDED_CROPS` in `src/exclusions/table.ts`:

```ts
{
  id: 'papaya',                  // must be an id the merge would otherwise ship
  commonName: 'Papaya',          // legible once the record is gone from the artifact
  basis: 'too-tender',           // or 'wont-ripen'
  note: 'Killed outright at around 0°C, and needs a year of continuous warmth to fruit.',
},
```

Then `npm run build:data` from this package, remove the crop's line from
`tools/icons/classification.ts`, re-run the icon generator, and commit both the
regenerated `data/plants.json` and the icon change. `exclusions/table.test.ts`
checks the id would really have shipped (a typo excludes nothing), and the
engine's `suitability/dataset.test.ts` and `spacing/dataset.test.ts` will need
their pinned counts updating — that failure is the signal the change reached
the engine.

## Companion-planting data (`src/companions/`)

Evidence-tagged companion/antagonist relationships (Stage 1.4 — full design
in [`docs/adr/0008`](../../docs/adr/0008-companion-planting-data.md)). Also
deliberately **not** a `SourceAdapter`: it produces relationships _between_
two plants, not a name to resolve, which is not what that interface is for.

- **The data** is split across two files by how it was produced:
  - `src/companions/curated.ts` — `CURATED_COMPANION_RELATIONSHIPS`, 8
    hand-picked relationships among the Stage 1.3 spacing crops, each backed
    by a real citation (a study, an extension plant-pathology page, an
    agronomy review) and individually evidence-tagged by weighing that
    citation's actual strength.
  - `src/companions/openfarm-derived.ts` — `OPENFARM_DERIVED_COMPANION_RELATIONSHIPS`,
    mechanically extracted from OpenFarm's own scraped `companions` field
    (already cached, `cache/openfarm-crops.json`, no new fetch). Always
    tagged `traditional`: a scraped wiki field has no citation of its own to
    elevate it. 78 relationships as of this stage.
  - `src/companions/relationships.ts` combines both into
    `ALL_COMPANION_RELATIONSHIPS`, and exposes `toPlantLinksById` — the
    bridge Stage 1.5 uses to attach real, `PlantLinkSchema`-validated
    `PlantLink`s onto merged `Plant` records by id.
- **The shape** (`src/companions/schema.ts`) reuses the engine's
  `EvidenceLevelSchema`/`SlugSchema`/`SourceRefSchema` verbatim and adds the
  directed-edge framing curation needs: `from`/`to`, `kind`
  (`companion`/`antagonist`), and a `symmetric` flag recording whether the
  claim holds in both directions.
- **The plant-id universe** (`src/companions/plant-id-universe.ts`) — every
  relationship's `from`/`to` is checked against the union of the Stage 1.3
  spacing ids and every OpenFarm crop Stage 1.2's mapper actually produces a
  `Plant` for (164 ids total). Full referential integrity against the final
  merged dataset is Stage 1.5's job, but this stops a dangling link from
  being authored in the first place.
- **Sourcing and evidence calls.** See the ADR for the full per-relationship
  reasoning and the retrieval-honesty caveat (several cited sites are
  network-blocked in the authoring sandbox; citations came from search
  snippets of the real pages and are reviewer-re-verifiable, the same
  discipline `docs/adr/0007` used for spacing). It also records why the named
  Wikipedia companion-planting dataset (`GenevieveMilliken/companion_plants`)
  was investigated but not used: the host is reachable but its data file's
  path is undiscoverable without GitHub API/git access, which this sandbox
  blocks.

### Adding a companion/antagonist relationship

1. **Hand-curated, cited relationship:** add a `CompanionRelationship` to
   `CURATED_COMPANION_RELATIONSHIPS` in `src/companions/curated.ts`. Give it
   `from`/`to` (plant ids), `kind`, an honestly-chosen `evidence` tag, a
   `note` explaining _why_ that tag, `symmetric`, and **at least one real
   citation** in `sources` (two, if you want it held to the `well-supported`
   bar `curated.test.ts` checks). Both `from` and `to` must resolve in
   `PLANT_ID_UNIVERSE` — a test will fail otherwise. **For a `symmetric:
false` entry, `from` must be the plant that benefits/is harmed, not the
   plant that causes the effect** — see `schema.ts`'s doc comment on
   `CompanionRelationshipSchema` for the direction convention (getting this
   backwards passes every existing check silently, since both directions are
   valid slugs).
2. **OpenFarm-derived relationships** need no manual addition — extending
   `sources/openfarm/categories.ts`'s allow-list automatically grows
   `OPENFARM_DERIVED_COMPANION_RELATIONSHIPS` on the next run.
3. `npm run test -w @garden-planner/etl` re-runs the `src/companions/*.test.ts`
   suite: schema validity, evidence-tag presence, referential integrity
   against the plant-id universe, and no exact-duplicate edges.

## Toolchain notes

- The `start` script runs source directly via `node --experimental-strip-types`
  (no separate build step). Unlike a bundler, Node's ESM resolver requires
  **explicit `.ts` extensions on relative imports** — that's why files in this
  package write `import { x } from './y.ts'` rather than `'./y'`. See
  `tsconfig.base.json` (repo root) for the shared `allowImportingTsExtensions`
  flag this — and `@garden-planner/engine`'s own internal imports — relies on.
- Everything else (strict TS, `verbatimModuleSyntax`, pinned Vite/Vitest,
  Node ≥ 20, ESM) follows the repo-wide conventions in `WORKPLAN.md` §0.5.

## Adding a source (PFAF, Permapeople, and beyond)

`src/sources/openfarm/` is the reference implementation — see
[`docs/adr/0006`](../../docs/adr/0006-openfarm-source-adapter.md) for the
full reasoning behind its shape. The pattern it establishes:

1. **A raw type + shape guard** (`types.ts`) for the source's own data shape,
   validated before trusting it — the same discipline `resolve/gbif-transport.ts`
   applies to GBIF responses.
2. **An offline-first cache** (`cache.ts` + `transport.ts`): read the
   committed snapshot by default; isolate the one place that would re-fetch
   it over the network behind an injectable interface, so tests never touch
   the network.
3. **A pure mapper** (`map.ts`) from the raw shape into the Stage 0.2 `Plant`
   schema — populate only fields the source actually provides, and **skip
   with a stated reason** (never guess, never silently drop) any record
   missing something the schema requires. Leave `gbifId: null`; that's the
   resolver's job.
4. **A `SourceAdapter`** (`source.ts`) implementing `src/pipeline/source.ts`,
   returning only the records step 3 can actually map.
5. **(Optional) a build-plants helper** (`build-plants.ts`) tying the mapper
   to a `GbifResolver` via `resolve/apply-resolution.ts#applyGbifResolution`,
   producing finished, `validatePlant`-passing `Plant`s for Stage 1.5 to
   later consume — proven by tests, not wired into the CLI (see the ADR for
   why the generic pipeline stays agnostic to this).

Register the adapter in `src/index.ts`'s `main()` (joining or replacing the
`sources` passed to `runPipeline`) — or pass it directly:
`runPipeline({ sources: [pfafAdapter], resolver })`. Nothing in
`pipeline/run.ts` needs to change; that's the point of the extension point.

## Module map

```
src/
  index.ts               CLI entry point: loads the cache, runs the pipeline,
                          saves the cache if anything new was learned.
                          Executed by `npm run start`.
  pipeline/
    source.ts             SourceAdapter — the "add a source" extension point.
    run.ts                Orchestration: gather names → resolve → log → summarize.
    starter-source.ts     Demo SourceAdapter from Stage 1.1 (interface reference only).
  resolve/
    gbif-transport.ts      The network boundary (injectable; real fetch impl).
    gbif-cache.ts           Load/save the committed JSON cache.
    gbif-resolver.ts         Offline-first resolve logic (cache → transport).
    apply-resolution.ts      Fills a Plant's gbifId via @garden-planner/engine.
  sources/
    openfarm/               The first real source adapter (Stage 1.2). See
                             docs/adr/0006 and this file's "Adding a source"
                             section above for the module-by-module pattern.
  spacing/                  Hand-verified, method-aware spacing table (Stage 1.3).
    schema.ts                SpacingRecord schema: reuses the engine's SpacingSchema,
                             adds per-method ≥2-source provenance + sanity bounds.
    table.ts                 The curated data (HAND_VERIFIED_SPACING). Not a source
                             adapter — original curation. See docs/adr/0007.
  companions/               Evidence-tagged companion/antagonist data (Stage 1.4).
    schema.ts                CompanionRelationship schema: directed from/to edges
                              reusing the engine's PlantLink/EvidenceLevel/SourceRef.
    plant-id-universe.ts     The pre-merge id universe (spacing ids ∪ OpenFarm
                              mapped ids) relationships are checked against.
    curated.ts                Hand-picked, individually-cited relationships.
    openfarm-derived.ts       Mechanical extraction from OpenFarm's companions field.
    relationships.ts          Combines both; PlantLink-shaped output for Stage 1.5.
                              Not a source adapter — see docs/adr/0008.
  exclusions/               UK-outdoor exclusion list (Stage 6.0).
    schema.ts                ExcludedCrop schema: id + common name + basis + reason.
    table.ts                 The 24 crops that can't be grown outdoors in Britain,
                             each with its stated ground. See docs/adr/0025.
  moisture/                 Curated soil-moisture enrichment slice.
    schema.ts                MoistureRecord schema: reuses the engine's
                             SoilMoistureSchema; requires a reason per row
                             instead of citations, and says why.
    table.ts                 The curated data (CURATED_MOISTURE), ~72 British
                             core crops. Not a source adapter — original
                             curation, same shape as spacing/ above.
  curated/                  Maintainer-curated full-plant input (Stage 1.7).
    plants.ts                CURATED_PLANTS: a plain, hand-authored Plant[].
                              Not a source adapter — see docs/adr/0021.
  merge/                    The Stage 1.5 merge, validation gate, and emitter.
    aliases.ts               Curated slug aliases (beetroot→beet, french-bean→green-bean).
    join.ts                  Join-key primitives: gbifId → scientific name → slug/alias.
    collect-openfarm.ts      Gathers OpenFarm plants, resilient to GBIF being offline.
    sanity.ts                Dataset-level (tree-tolerant) spacing absurdity bounds.
    merge.ts                 The merge: fold in curated (wins) + attach spacing (wins)
                             + remapped links.
    validate.ts              The hard-fail gate: schema + referential integrity + sanity.
    artifact.ts              Builds/writes data/plants.json (header + sorted plants).
    build-dataset.ts         Orchestrates gather → merge → validate → artifact (pure).
  build-data.ts            CLI entry: reads caches, probes GBIF, writes /data.
                            Executed by `npm run build:data`.
cache/
  gbif-name-cache.json    The committed, offline-first name-resolution cache.
  openfarm-crops.json     The committed OpenFarm rescue-dump snapshot (340 records).
```
