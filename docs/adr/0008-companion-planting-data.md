# 0008 — Companion-planting data: evidence tagging, sourcing, and the plant-id universe

## Status

Accepted (Stage 1.4).

## Context

Stage 1.4 (`docs/stage-1.4-brief.md`; `WORKPLAN.md`) produces the companion
and antagonist relationships between crops — the data behind "suggest
companions / warn about antagonists" (`DESIGN.md` §1, Stage 2.3). `DESIGN.md`
§"Companion planting data" is explicit about the problem this stage exists to
solve: companion planting "is a mix of solid science (e.g. legumes fixing
nitrogen, scent-masking pest deterrence) and folklore. The open data reflects
that." The Stage 0.2 schema already forces the honesty this implies —
`EvidenceLevelSchema` (`'well-supported' | 'traditional'`) is a required field
on `PlantLinkSchema` (`packages/engine/src/schema/plant.ts`) — but assigning
that tag **per pairing, honestly** is this stage's actual job, deliberately
left undone by Stage 1.2's OpenFarm adapter (`docs/adr/0006` §2's rejected
alternative: "map companion data now with a blanket `traditional` tag").

Four questions had to be settled: **what shape the curated relationship data
takes**; **is this a `SourceAdapter` or curation**; **what plant-id universe a
pre-merge relationship should be checked against**, so links aren't dangling
by construction even though full referential integrity is Stage 1.5's job;
and **is the named Wikipedia dataset actually usable**.

The code lives in `packages/etl/src/companions/`.

## Decision

### 1. Two data sources, kept in two files, for two different reasons

`DESIGN.md` names two candidate sources: a Wikipedia-scraped dataset
(`GenevieveMilliken/companion_plants`) and OpenFarm's own `companions` field
(already cached, `packages/etl/cache/openfarm-crops.json`, present on 134 of
340 records). Both were investigated; only one was usable, and a third
(hand-curated, cited relationships) turned out to be necessary to get any
`well-supported`-tagged data at all:

- **`GenevieveMilliken/companion_plants` — reachable in principle, but
  undiscoverable.** As in Stages 1.1–1.3, `raw.githubusercontent.com` is
  reachable in this sandbox (confirmed: the repo's `README.md` and its
  referenced image both fetch with `HTTP 200`), but every other GitHub
  surface is blocked — `github.com`'s own HTML (403), `api.github.com`
  (403/proxy-intercepted), `codeload.github.com` (403), and even third-party
  mirrors like `cdn.jsdelivr.net`/`data.jsdelivr.com` (connection refused at
  the proxy). `raw.githubusercontent.com` only serves a file at a path you
  already know; without the API, the git protocol, or a directory listing,
  there is no way to discover what that dataset's actual CSV/JSON file is
  named or where it lives in the repo. Roughly 30 plausible filenames were
  tried across `master`/`main` (`data/companion_plants.csv`,
  `companion_plants.csv`, `data/plants.json`, notebook names, scraper script
  names, and variants of each) — every one 404'd. This is a different
  _class_ of blocker than Stages 1.1/1.2's ("the host is blocked"): the host
  is reachable, the specific resource is not discoverable. Per the brief's
  own instruction ("if blocked, document it honestly... rather than
  fabricating data"), this dataset is **not used** — recorded here so a
  future session with `git clone` or GitHub API access doesn't need to
  redo this investigation, and can go straight to `git ls-files` on a real
  clone.
- **OpenFarm's `companions` field — used, mechanically, as `traditional`
  only.** This field is real, already in the repo, and needs no new fetch.
  But it is exactly what `docs/adr/0006` warned about: a scraped wiki field
  with no citation of its own. `src/companions/openfarm-derived.ts` turns it
  into relationships mechanically (see §4) — always tagged `traditional`,
  never `well-supported`, because there is nothing behind any single entry
  to elevate it. This is **not** the blanket-tagging `docs/adr/0006`
  rejected: that alternative was rejected for tagging _without judgement, as
  a way to avoid the decision_; here the same tag is applied _because_ a
  scraped-wiki field is definitionally uncited, which is an honest
  per-source judgement, not an avoidance of one.
- **A small hand-curated set — the only source of `well-supported` data.**
  Since neither ingested source can honestly support a `well-supported` tag,
  getting _any_ well-supported relationships into this dataset required
  actually researching real horticultural science: `src/companions/curated.ts`
  hand-picks 8 relationships among the Stage 1.3 spacing crops, each backed
  by a real citation (a peer-reviewed study, a university extension
  plant-pathology page, a USDA-affiliated agronomy publication), each
  evidence-tagged by weighing that citation's actual strength — not by
  assumption. Three of the eight are `well-supported`; five are
  `traditional`, including three that _look_ superficially science-adjacent
  (organosulfur allelopathy against legumes) but whose citations turned out,
  on inspection, to describe a plausible mechanism without garden-scale
  confirmation — recorded traditional rather than overstated. See §3.

### 2. Curation lives in a directed-edge schema, separate from `PlantLink`

`CompanionRelationshipSchema` (`companions/schema.ts`) does not redefine
`PlantLinkSchema`/`EvidenceLevelSchema` — it imports and reuses them
directly. What it adds is the framing an _authoring-time_ dataset needs that
`PlantLink` itself can't express, because `PlantLink` only makes sense once
attached to its owning `Plant`:

- `from` / `to` — a `PlantLink` has no `from`; a curated dataset needs one.
  **Direction convention:** `from` is the plant the recommendation is _for_
  — `toPlantLinksById` attaches the resulting `PlantLink` to `from`'s own
  list, pointing at `to` (mirroring how `Plant.companions` reads:
  "companions for this plant"). For a `symmetric: false` edge this means
  `from` must be the plant that actually benefits or is harmed — see the
  `lettuce`→`pea` entry in §3, where `lettuce` (the nitrogen beneficiary) is
  `from`, not `pea`. An earlier draft of this entry had `from`/`to` swapped
  (`pea`→`lettuce`), which would have silently surfaced the recommendation
  under the wrong plant — caught in code review (see Consequences).
- `kind: 'companion' | 'antagonist'` — the Stage 0.2 schema distinguishes
  these only by _which array_ (`Plant.companions` vs `Plant.antagonists`) a
  link lives in; a flat edge list needs its own field.
- `symmetric: boolean` — whether the claim holds in both directions (most
  do) or is inherently one-directional (e.g. a nitrogen-fixing legume
  enriching soil for a neighbour that fixes none back — see the `lettuce`→
  `pea` entry in §3). `relationships.ts#toPlantLinksById` is the bridge
  that expands a relationship into real `PlantLink`s — via
  `PlantLinkSchema.parse`, never restating the shape — attaching to both
  ends when `symmetric: true` and only to `from` when `false`.
- `note: string` (required, unlike `PlantLink.note`, which is optional) —
  every curated relationship must record _why_ its evidence tag was chosen,
  the same "reviewable fact, not an assertion" discipline `docs/adr/0007`
  applied to spacing citations.
- `sources: SourceRef[]` (nonempty) — reuses the engine's own
  `SourceRefSchema` verbatim.

### 3. The hand-curated set: what got which tag, and why

All eight relationships link plants within the Stage 1.3 spacing table, so
every id is trivially inside the plant-id universe (§5):

| From    | To          | Kind       | Evidence           | Why                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ----------- | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| onion   | carrot      | companion  | **well-supported** | Uvah & Coaker (1984), a peer-reviewed entomology field study: intercropping cut carrot-fly damage on carrots and thrips damage on onions vs. either grown alone — a real, cited, mutual effect.                                                                                                                                                                                                                    |
| potato  | tomato      | antagonist | **well-supported** | Both are hosts of _Phytophthora infestans_ (late blight) and share pests; university extension plant-pathology guidance explicitly documents the shared-susceptibility risk.                                                                                                                                                                                                                                       |
| lettuce | pea         | companion  | **well-supported** | Legume nitrogen fixation is well-established microbiology, and agronomy research has _measured_ real (if variable) within-season nitrogen transfer to a neighbouring non-legume — recorded well-supported for the mechanism and its measured effect, but one-directional (`symmetric: false`): `from` is `lettuce` (the beneficiary), not `pea`, per the direction convention in §2 — only the neighbour benefits. |
| onion   | pea         | antagonist | traditional        | Popular claim: allium organosulfur compounds suppress legume root-nodule rhizobia. Real chemistry, but a cited allelopathy review notes these compounds are short-lived and short-range — mechanistically plausible, not garden-scale-confirmed. Recorded traditional, not overstated.                                                                                                                             |
| garlic  | french-bean | antagonist | traditional        | Same allium-vs-legume claim, same caveat, different pairing.                                                                                                                                                                                                                                                                                                                                                       |
| leek    | broad-bean  | antagonist | traditional        | Same allium-vs-legume claim, same caveat, a third pairing (rather than an exhaustive 3×3 allium/legume matrix — see Alternatives).                                                                                                                                                                                                                                                                                 |
| carrot  | radish      | companion  | traditional        | A standard companion-chart pairing (shared bed, radish marks/loosens the row) — a garden-management convenience claim repeated across guides, not a study finding.                                                                                                                                                                                                                                                 |
| lettuce | carrot      | companion  | traditional        | Another standard chart pairing (shallow lettuce roots vs. deeper carrot roots) — same evidentiary tier as above.                                                                                                                                                                                                                                                                                                   |

Both evidence tags and both relationship kinds are represented on purpose —
`curated.test.ts` asserts this isn't accidentally uniform. The three
`well-supported` entries each cite **two independent sources**; the schema
itself only requires one, but `curated.test.ts` holds `well-supported`
specifically to the higher bar, since that tag is the one users will trust
most.

**On retrieval honesty**, exactly as `docs/adr/0007` recorded for the
spacing table: several cited domains (`extension.wvu.edu`, `almanac.com`,
similar university/extension hosts) are blocked for direct fetch by this
sandbox's egress policy. Every citation was retrieved via web-search result
snippets of the source's own published words — genuine retrieval, not
fabrication — with the real page URL recorded so a reviewer with
unrestricted network access can re-open and re-check every one.

### 4. The OpenFarm-derived set: a pure, filtered transform, not a `SourceAdapter`

`companions/openfarm-derived.ts#deriveOpenFarmCompanionRelationships` is a
pure function (`records, idUniverse, retrievedAt) => CompanionRelationship[]`)
over the already-committed `cache/openfarm-crops.json`. For each cached
record whose own slug is in the plant-id universe, and for each slug in its
`companions` array that is _also_ in the universe, it emits one relationship:
`evidence: 'traditional'`, citing that record's own Wayback Machine URL, and
**`symmetric: false`**.

The `symmetric: false` choice is deliberate and checked against the real
data: only 110 of 230 companion edges in the raw dump (~48%) are mutually
listed by both sides. Recording every edge as `symmetric: true` would invent
the un-reciprocated half of the claim for the other 52%; recording exactly
what each page stated, and letting a genuinely reciprocal pair naturally
produce two directed edges, is the honest choice. This mirrors
`docs/adr/0007`'s "leave the block absent rather than infer" discipline, one
level up: don't infer a direction the source never stated.

Running this against the real cache and the real universe (§5) produces
**78 relationships** from **161** OpenFarm-mapped records — a genuine,
non-trivial "traditional" companion dataset with zero hand-authoring effort,
which is exactly what a mechanical ingest-and-filter step should look like.

Filtered to the plant-id universe rather than to the raw 340-record dump or
even the 162-slug `categories.ts` allow-list, so the id side of a derived
edge is always a real, mappable `Plant.id` — never a slug this project would
otherwise skip and never map.

### 5. The plant-id universe: union of the two id-producing stages that exist today

Referential integrity against the _final, merged_ dataset is formally Stage
1.5's job (`PlantLinkSchema`'s own doc comment: a single relationship can't
see the whole eventual dataset). But this stage still shouldn't author
dangling links by construction. `companions/plant-id-universe.ts` computes
the natural pre-merge universe: the union of

- the 12 Stage 1.3 hand-verified spacing ids (`HAND_VERIFIED_SPACING`), and
- every OpenFarm crop the Stage 1.2 mapper (`mapOpenFarmCrop`) actually turns
  into a `Plant` — **161** ids, computed by calling the real mapper, not by
  re-deriving its rules (so this can never silently drift from what Stage
  1.2 ships).

The two sets overlap on 9 ids that happen to share a slug in both places
(`onion`, `lettuce`, `carrot`, `potato`, `tomato`, `radish`, `garlic`,
`leek`, `pea` — plain English crop names both curators independently chose),
giving a union of **164** ids. Every relationship's `from`/`to` — curated and
OpenFarm-derived alike — is checked against this set in tests
(`findDanglingRelationships`), not just eyeballed.

This is the same situation `docs/adr/0007`'s Consequences section already
flagged: some spacing-table ids use British/simplified spellings
(`beetroot`, `broad-bean`, `french-bean`) that don't match OpenFarm's own
slugs (`beet`, `green-bean`) for the same species. That's harmless for the
eventual merge (which joins on GBIF id / scientific name), but it does mean
those three spacing crops currently have no OpenFarm-derived companion data
of their own, and OpenFarm's `beet`/`green-bean` records — real, mapped
`Plant`s in the universe — are companion-eligible under their own ids even
though they represent the same species as `beetroot`/`french-bean`. Nothing
here needs to reconcile that; it is exactly the kind of pre-merge duplication
Stage 1.5 exists to resolve.

`plant-id-universe.ts` and `openfarm-derived.ts` both need the raw cached
records (the former to compute the universe, the latter to derive edges from
it), and `loadOpenFarmCache` has no memoization of its own. Rather than have
each module read and shape-validate the 340-record file independently,
`plant-id-universe.ts` loads it once (`OPENFARM_CACHE_RECORDS`) and
re-exports it; `openfarm-derived.ts` imports that instead of calling
`loadOpenFarmCache` a second time.

### 6. Duplicate detection has two layers, because expansion can create duplicates the edge list doesn't have

`findDuplicateRelationships` (§ schema.ts) operates on the pre-expansion
directed-edge list, and deliberately does **not** flag a relationship and its
reverse-direction counterpart (`A→B` alongside `B→A`) as a duplicate — that
distinction matters for exactly the asymmetric case in §3 (`lettuce`→`pea`
recorded once, not twice, once per direction). But `relationships.ts#toPlantLinksById`'s
`symmetric: true` expansion can turn a legitimately-distinct `A→B` edge and an
independently-authored `B→A` edge into the _same_ `PlantLink` appearing twice
in one plant's `companions`/`antagonists` array — a defect the edge-list-level
check structurally cannot see, since it never looks at expanded output.

`relationships.ts#findDuplicatePlantLinks` closes that gap: it checks the
actual `Map<plantId, PlantLinksByKind>` `toPlantLinksById` produces, not the
input edges. `relationships.test.ts` asserts it against both a fixture proving
it catches the scenario and the real `ALL_COMPANION_RELATIONSHIPS` (currently
clean). This two-layer split — one invariant on the authored data, a second on
the derived output — mirrors why `docs/adr/0007`'s sanity bounds
(`spacingSanityIssues`) are checked both inside the schema's `superRefine` and
independently unit-tested: a single check at the wrong layer misses defects
only visible at the other one.

**No precedence rule is recorded for a `curated.ts`/`openfarm-derived.ts`
collision** (the same `(kind, from, to)` triple asserted by both a
hand-curated and a mechanically-derived entry) — `findDuplicateRelationships`
over `ALL_COMPANION_RELATIONSHIPS` would simply fail the test suite the day
that happens (currently: zero collisions, verified). Unlike spacing, where
`docs/architecture.md` records "hand-verified figures win over scraped ones"
as an explicit merge-time policy, no analogous rule exists here yet, because
Stage 1.4 has no merge step of its own — the two lists are just concatenated.
When a collision is eventually hit (most likely from a future OpenFarm cache
refresh), the fix is a human editorial decision — most naturally, keep the
hand-curated entry's tag and reasoning where the two disagree — not an
automatic rule, since a curator should look at _why_ they disagree before
picking a winner.

### 7. Is this a `SourceAdapter` or curation? Both — split by file, like Stage 1.3's data vs. the schema it validates against

`src/pipeline/source.ts`'s `SourceAdapter` interface resolves **plant
names** for GBIF (`fetchRecords(): Promise<SourceRecord[]>`, one `name` per
record); it has no shape for **a relationship between two plants**. Forcing
`openfarm-derived.ts` through it would mean pretending a companion edge is a
plant-name lookup — a category error, the same one `docs/adr/0007` avoided
for the spacing table. So neither `openfarm-derived.ts` nor `curated.ts` is
wired into `pipeline/run.ts`, and there is no `SourceAdapter` for companion
data.

But `openfarm-derived.ts` genuinely _is_ ingestion, not authorship — it is a
pure, mechanical transform of already-fetched external data, with no
per-relationship human judgement involved beyond the one honest,
source-level call ("uncited scrape data is `traditional`, full stop"). That
distinguishes it from `curated.ts`, where every single relationship's
evidence tag is an individually-researched judgement call. Keeping them in
separate files (rather than one undifferentiated relationship list) makes
that split visible in the repo layout itself, not just in prose: a reviewer
auditing "is this evidence tag defensible?" reads `curated.ts` line by line;
a reviewer auditing "does the mechanical extraction actually match the raw
data?" reads `openfarm-derived.ts`'s pure function and its tests.
`relationships.ts` then concatenates both into `ALL_COMPANION_RELATIONSHIPS`
for downstream (Stage 1.5) consumption, so nothing later needs to care about
the split.

## Alternatives considered

- **Implement OpenFarm companion extraction as a second `SourceAdapter`.**
  Rejected: `SourceAdapter.fetchRecords()` returns records to resolve a
  _name_ against GBIF; a companion relationship has two plant ids and no
  name of its own to resolve. The interface doesn't fit, and forcing it
  would blur the pipeline's "stays agnostic to per-source shaping"
  principle (`docs/adr/0006` §4) into meaninglessness.
- **Keep guessing filenames for `GenevieveMilliken/companion_plants`
  indefinitely, or fabricate plausible-looking relationships "in its
  style."** Rejected outright: fabricating data is exactly what this
  project's evidence-tagging discipline exists to prevent. ~30 documented
  attempts across two branches and multiple naming conventions is a
  reasonable, bounded effort before recording the blocker and moving on —
  matching how Stages 1.1/1.2 treated GBIF/PFAF/Permapeople being
  unreachable.
- **Tag every OpenFarm-derived relationship `well-supported` because OpenFarm
  is itself derived from real growing guides.** Rejected: the _page_ may
  have been written by a horticulturist, but the specific companion claim on
  it carries no citation a reviewer can check — indistinguishable, from this
  project's evidence, from an editor's opinion. `docs/adr/0006` §2 already
  drew this line for the adapter; this stage holds it too.
- **Record every OpenFarm-derived edge `symmetric: true`.** Rejected: the
  raw data is only ~48% mutually reciprocated (§4); asserting symmetry
  uniformly would invent the missing half of over 100 edges' claims.
- **Cover the full allium×legume matrix (9 pairings) for the traditional
  antagonist folklore.** Rejected as unnecessary breadth for the same reason
  `docs/adr/0007` kept the spacing table to 12 crops: three representative
  pairings (one per allium, one per legume) make the pattern and its caveat
  clear without multiplying near-duplicate entries that all share one
  citation pair.
- **Store the dataset as `data/*.json`.** Rejected for the same reason
  `docs/adr/0007` rejected it for spacing: `curated.ts`'s citations and
  reasoning notes are the point, and JSON can't carry the inline "why this
  tag" prose that makes the curation reviewable. `openfarm-derived.ts`,
  being a pure mechanical transform with no per-row prose, could in
  principle be JSON-backed — kept as a `.ts` function instead purely for
  consistency with the rest of `src/companions/` and because its _input_
  (`cache/openfarm-crops.json`) is already the appropriate JSON artifact.

## Consequences

- Stage 1.5's merge can import `relationships.ts#ALL_COMPANION_RELATIONSHIPS`
  and `#toPlantLinksById` directly to attach `Plant.companions` /
  `Plant.antagonists` onto merged records by id — every produced link is
  already a real, `PlantLinkSchema`-validated `PlantLink`, not a shape Stage
  1.5 has to reconstruct.
  - the actual `Plant.id` for `beetroot`/`broad-bean`/`french-bean` after the
    merge, once decided, may want its own dedicated relationships in
    `curated.ts` if the merge doesn't unify them with OpenFarm's differently-
    spelled equivalents.
- The dataset is intentionally small on the `well-supported` side (3 of 86
  total relationships). This is an honest reflection of how little of
  companion-planting folklore actually has controlled-trial backing, not an
  implementation gap — extending it further means researching and citing
  more individual claims by hand, the same per-relationship cost
  `docs/adr/0007` accepted for spacing.
- `GenevieveMilliken/companion_plants` remains untried. A future session
  with `git clone`/API-level GitHub access (not just
  `raw.githubusercontent.com` path fetches) should revisit it — `git ls-files`
  on a real clone immediately answers what ~30 blind HTTP guesses here could
  not.
- Extending coverage: add a new entry to `CURATED_COMPANION_RELATIONSHIPS`
  (with real citations and an honest evidence call) for hand-curated
  relationships — **and get the `from`/`to` direction right for any
  non-symmetric entry** (§2's convention: `from` is the plant that benefits
  or is harmed, not the one that causes the effect); `openfarm-derived.ts`
  needs no manual extension — it automatically picks up more relationships as
  `categories.ts`'s OpenFarm allow-list grows (see `docs/adr/0006`'s own
  extension note) or as the spacing table grows.
- This stage's own code review caught and fixed three defects before merge,
  worth recording since they're the kind a future contributor could
  reintroduce: (1) `plant-id-universe.ts` and `openfarm-derived.ts` originally
  loaded and shape-validated the 340-record OpenFarm cache independently —
  now loaded once and shared (§5); (2) the `lettuce`/`pea` entry originally
  had `from`/`to` backwards relative to the direction convention this ADR now
  states explicitly (§2) — a mistake the schema itself couldn't catch, since
  both directions are individually valid slugs; (3) `findDuplicateRelationships`
  operating only on the pre-expansion edge list left a gap where a `symmetric:
true` edge plus an independently-authored reverse edge could double-list a
  `PlantLink` after expansion — closed by `findDuplicatePlantLinks` (§6),
  which checks `toPlantLinksById`'s actual output.
