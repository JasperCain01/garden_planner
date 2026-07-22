# Stage 1.5 brief — dataset build, merge & validation ⭐ keystone

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
and [`WORKPLAN.md`](../WORKPLAN.md) first (especially §0 ground rules, §1.1
"Data validation", and the Stage 1.5 entry); this brief concentrates the
requirements and — more importantly — the **traps** so you don't rediscover
them the hard way. Stages 0.2 (schema), 1.1 (ETL shell + GBIF resolver), 1.2
(OpenFarm adapter), 1.3 (hand-verified spacing), and 1.4 (companion data) are
done and on this branch. Stage 1.5 is the **keystone** stage that reconciles
all of them into the single artifact the app ships (`WORKPLAN.md` marks it ⭐
for the same reason Stage 0.2 and 2.1/2.2 are: a wrong call here is expensive
to unwind).

## Goal

Combine everything Stages 1.2–1.4 produced into the single static `/data`
artifact the app loads at runtime, reconciling conflicts by a documented
policy, and enforcing the **hard-fail validation gate**: no malformed or
dangling-referenced record ever ships. Finalize the dataset's licensing
attribution (`NOTICE`, `data/README.md`).

## Read this before assuming "join by GBIF id" is straightforward

`WORKPLAN.md` and every prior ADR (0005, 0006, 0007) describe reconciling
records "by GBIF id" as the plan. **Check GBIF reachability yourself, early**
(`docs/adr/0005`'s method: try the resolver's real transport, or a direct
`curl`/`WebFetch` to `api.gbif.org`) — but go in assuming it is still blocked,
because every session so far in this sandbox class has confirmed it is, and
the committed cache (`packages/etl/cache/gbif-name-cache.json`) is currently
**`{}`, completely empty**. If you run `buildOpenFarmPlants` against the real
resolver in an unreachable environment, **every one of the 161 mappable
OpenFarm records will resolve to `error`/`unresolved`, not `resolved`** — you
will get **zero** `Plant`s with a non-null `gbifId`, not a partial result.

This matters because it changes what "the merge" actually has to do right
now:

- **If GBIF is unblocked in your session:** run `npm run start -w
@garden-planner/etl` first to populate the cache for real, then the
  originally-planned "reconcile by `gbifId`" merge is straightforward and you
  should do it as designed.
- **If GBIF is still blocked (the likely case):** there is currently only
  **one** real source adapter (OpenFarm) producing full `Plant` records, so
  there is no second overlapping source to reconcile _by_ `gbifId` yet
  anyway — the urgent problem isn't cross-source species deduplication, it's
  **attaching the Stage 1.3/1.4 data slices onto the right OpenFarm `Plant`s
  without a working join key**. Every record on every side already carries a
  `scientificName` (OpenFarm's own binomial, the spacing table's, and
  implicitly the companion dataset's via its owning plant's record) — using
  **normalized `scientificName`** as the practical join key when `gbifId` is
  null (falling back to `gbifId` equality when it _is_ present, so the design
  degrades gracefully once GBIF is eventually reachable) is the natural
  fallback. **This is a genuine merge-policy decision for you to make and
  document in an ADR** — this brief is deliberately not prescribing the exact
  algorithm, per `WORKPLAN.md`'s "Opus: reconciliation policy... cross-cutting
  and easy to get subtly wrong."

## The three inputs, and what each one actually hands you

1. **OpenFarm `Plant`s** — `packages/etl/src/sources/openfarm/build-plants.ts#buildOpenFarmPlants(rawRecords, resolver)`.
   Async; needs a `GbifResolver` (`resolve/gbif-resolver.ts#createGbifResolver`)
   and the raw cache (`sources/openfarm/cache.ts#loadOpenFarmCache`). Produces
   up to 161 schema-valid `Plant`s (fewer if GBIF is unreachable — see above),
   each with `id` = the OpenFarm slug (e.g. `onion`, `carrot`, `beet`,
   `green-bean`). **Not currently wired into `pipeline/run.ts` or
   `src/index.ts`** — Stage 1.2's ADR (`docs/adr/0006`) left it as a
   tested-but-unwired capability specifically for you to import here.
2. **The hand-verified spacing table** — `packages/etl/src/spacing/table.ts#HAND_VERIFIED_SPACING`,
   12 `SpacingRecord`s (British-spelling slugs: `onion`, `lettuce`, `carrot`,
   `potato`, `tomato`, `beetroot`, `radish`, `garlic`, `leek`, `pea`,
   `broad-bean`, `french-bean`). Each is a **thin slice** (id, names,
   category, `spacing`, per-method `provenance`) — not a full `Plant`. Use
   `spacing/schema.ts#spacingRecordSources(record)` to get the flattened
   `SourceRef[]` for `Provenance.fields.spacing`. **9 of these 12 slugs
   happen to equal an OpenFarm slug** (`onion`, `lettuce`, `carrot`, `potato`,
   `tomato`, `radish`, `garlic`, `leek`, `pea`); the other 3 (`beetroot`,
   `broad-bean`, `french-bean`) don't match OpenFarm's (`beet`, ?, `green-bean`)
   — this is exactly the scenario the scientific-name-join fallback above
   needs to handle. Per `WORKPLAN.md`'s conflict policy and `docs/adr/0007`'s
   Consequences: **hand-verified spacing wins over OpenFarm's scraped
   row-spacing figures** for the same plant.
3. **Companion/antagonist relationships** — `packages/etl/src/companions/relationships.ts#ALL_COMPANION_RELATIONSHIPS`
   (86 directed edges: 8 hand-curated + 78 OpenFarm-derived) and
   `#toPlantLinksById(relationships)`, which returns a
   `Map<plantId, {companions: PlantLink[], antagonists: PlantLink[]}>` —
   already real, `PlantLinkSchema`-validated `PlantLink`s, keyed by the
   **pre-merge** plant-id universe (`companions/plant-id-universe.ts#PLANT_ID_UNIVERSE`,
   164 ids — union of the spacing ids and OpenFarm-mapped ids, _not_ GBIF
   ids). **If your merge changes a plant's final `id`** (e.g. choosing
   `beetroot` over `beet`, or vice versa, when unifying the same species),
   **you must remap the companion links' `plantId` references to match** —
   they were authored against the pre-merge ids and will dangle silently
   otherwise. This is the concrete referential-integrity risk `docs/adr/0008`
   §5 and the companion links' own doc comments flagged as "Stage 1.5's job."

## What "the hard-fail validation gate" means concretely

`WORKPLAN.md` §1.1: schema validation (every record `validatePlant()`-clean),
referential integrity (every `PlantLink.plantId` resolves to a real record in
the **final, merged** dataset — this is the check the whole pipeline has been
deferring to you), and sanity bounds (the spacing table's own
`spacingSanityIssues`/`SPACING_SANITY_BOUNDS` already cover spacing; decide if
anything else needs one). **Test this by feeding the build an intentionally
broken record and asserting it fails loudly** — `WORKPLAN.md`'s own
verification bar for this stage, not optional.

## What to build

1. A merge step (likely `packages/etl/src/merge/` or similar — your call, but
   document the shape choice the way `docs/adr/0007`/`0008` documented
   theirs) that: gathers OpenFarm `Plant`s, attaches the spacing slice and its
   provenance onto matching plants (spacing wins on conflict), attaches
   companion/antagonist `PlantLink`s (remapping ids if you unify any), and
   decides + documents the **join-key policy** (see above).
2. The hard-fail validation gate: schema + referential integrity + sanity
   bounds, run over the whole merged set, throwing/failing the build loudly
   on any violation.
3. Emit the artifact to `/data` (format is your call — plain JSON is the
   obvious default; `data/README.md` already sketches "a build output of the
   ETL pipeline"). Update `data/README.md`'s "Status" section (currently says
   "Empty for now").
4. Finalize `NOTICE` and `data/README.md`'s licensing section — `NOTICE`
   already states CC BY-NC-SA reasoning per PFAF's terms and lists sources
   under a "finalized in Workplan Stage 1.5" placeholder; since PFAF isn't
   actually ingested yet (`docs/adr/0006`'s addendum — still blocked), decide
   whether the licence commitment should reflect _only the sources actually
   shipped_ right now (OpenFarm CC0 + hand-verified spacing, which would let
   the artifact ship under something less restrictive today) or _stay_
   CC BY-NC-SA pre-emptively for when PFAF is eventually unblocked. Record
   the call in an ADR — this is exactly the kind of decision `WORKPLAN.md`
   §0.5's "Licensing (confirmed): non-commercial" note anticipated needing a
   concrete trigger to finalize.

## Constraints & gotchas

- **Toolchain quirks already solved (don't re-discover):** single pinned Vite
  6 / Vitest 3; Node ≥ 20; ESM (`"type": "module"`); strict TS with
  `verbatimModuleSyntax`; explicit `.ts` extensions on relative imports in
  `packages/etl` (needed by `node --experimental-strip-types`).
- **Unit tests must never hit the network.** Every existing GBIF/OpenFarm test
  injects a stub resolver/transport/reader — follow the same pattern if your
  merge step's tests need a `GbifResolver`.
- **Don't silently drop a record.** Every prior stage's discipline: if a
  record can't be merged/validated, it's skipped with a stated, logged
  reason — never silently dropped, never forced through with a guess.

## Deliverables

1. The merge/validate/emit pipeline, tested with both a clean run (produces a
   valid artifact from the real data) and an intentionally-broken-record run
   (fails loudly, asserted in a test).
2. The emitted `/data` artifact from the real Stage 1.2–1.4 data.
3. **ADR** `docs/adr/0009-*.md`: the join-key policy (GBIF id vs. scientific-
   name fallback), the conflict-resolution rule (spacing wins), how
   companion-link ids are kept valid across any id unification, and the
   licensing finalization call. Add it to `docs/adr/README.md`'s index.
4. Updated `data/README.md` and `docs/architecture.md`.

## Definition of done (WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code commented per §0.2; ADR written; docs updated.
Run `/code-review` and `/verify` before finishing. Commit and push.

## Model

**Opus** — `WORKPLAN.md` calls this out explicitly: "Reconciliation policy and
the validation gate are cross-cutting and easy to get subtly wrong." The
join-key fallback decision (§ above) in particular has no single obviously-
correct answer and real consequences if gotten wrong quietly — worth the
extra rigor a keystone stage warrants.

## After 1.5

With `/data` populated and validated, Phase 2 (the framework-free suitability
and spacing engine, `WORKPLAN.md` Stage 2.1) can finally run against real
data instead of hand-written fixtures. Stage 1.6 (location/climate static
data) has no dependency on 1.5 and can proceed in parallel if useful.
