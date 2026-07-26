# 0019 — Icon set: programmatic archetypes instead of 160 bespoke illustrations, and the icon-resolution rule

## Status

Accepted (Stage 4.1).

## Context

Stage 4.1 (`docs/stage-4.1-brief.md`) needs one SVG icon per shipped crop
(160 — `data/plants.json`) plus a generic fallback, "in a single coherent
style, bundled with the app." The brief is explicit that this is partly a
design task a human may prefer to own or commission, and warns against
over-investing illustration effort in a coding session when a simpler,
consistent, honestly "placeholder-quality" set unblocks Stage 4.2 just as
well. `DESIGN.md`/`WORKPLAN.md` state a coherent-style requirement but no
concrete visual spec (colours, line weight, viewBox), so this stage also had
to settle those, and separately had to settle how a `Plant` resolves to one
of the 161 files.

## Decision

### The icon set is generated from a small archetype library, not hand-drawn per crop

`tools/icons/archetypes.ts` defines ~19 reusable shape functions (`leaf`,
`rootRound`, `rootLong`, `bulbAllium`, `pod`, `squash`, `berryCluster`, ...),
each built from a handful of shared primitives (a leaf silhouette, a
circle-cluster, a tapered blob). `tools/icons/classification.ts` maps every
one of the 160 shipped crop ids onto exactly one archetype (e.g. all seven
peppers → `pepper`; all onions/garlic/shallot/leek → `bulbAllium`).
`tools/icons/generate.ts` (a build-time-only script, run with
`node --experimental-strip-types tools/icons/generate.ts`, mirroring
`packages/etl`'s own "developer tool, not shipped" convention) reads
`data/plants.json`, renders each crop's archetype with its category's fill
colour, runs the result through SVGO, and writes one `<id>.svg` file per
crop into `app/src/icons/crops/`, plus `app/src/icons/generic.svg`.

Colour is the other axis of differentiation: fill colour is keyed to
`EdibleCategory` (vegetable/fruit/herb — three fixed tokens, `tools/icons/colors.ts`),
not to a crop's real-world colour, and every icon shares one ink stroke
colour. See `docs/icon-style-guide.md` for the full visual spec.

This means several crops in the same family are visually identical except
for colour (all seven peppers render the same silhouette). That is a
deliberate trade-off, not an oversight — see "Alternatives considered."

### `generate.ts` is a hard-fail gate against the classification map drifting from the dataset

Before writing anything, the generator diffs `data/plants.json`'s ids
against `classification.ts`'s keys in both directions and throws if either
side has an entry the other doesn't. This is the same "fail loudly rather
than ship a silent gap" posture as the ETL's dataset validation gate
(ADR 0009) and `app/src/dataset/shipped-plants.ts`'s own re-validation on
load — applied here to the one other place a per-crop list must stay in
lockstep with the dataset.

### Icon resolution: `plant.icon ?? plant.id`, falling back to the generic icon

`app/src/icons/resolveIcon.ts` exports `resolveIcon(plant): IconAsset`,
resolving in order: `plant.icon` if set, then `plant.id`, then the generic
fallback if neither matches a bundled asset. This is exactly the rule the
brief proposed and the schema doc comment already implied
(`PlantSchema.icon`: "often equal to `id`" — `packages/engine/src/schema/plant.ts`).
No shipped record sets `icon` today, so every shipped crop resolves via its
`id`; every user-defined crop (Stage 3.6 never sets `icon`) resolves via its
`user-`-namespaced `id`, which matches no bundled file, so it falls back to
the generic icon — exactly the behaviour Stage 3.6's own module doc predicted
and left for this stage to deliver.

`resolveIcon` never throws and never returns an unresolved state; the
`isFallback` flag on its result is the one bit Stage 4.2 needs to, say, style
the fallback differently.

### Bundling: `import.meta.glob`, not a hand-maintained import list

`resolveIcon.ts` builds its id → asset-URL map with
`import.meta.glob('./crops/*.svg', { eager: true, import: 'default', query: '?url' })`
rather than 160 individual `import` statements. Vite resolves every matched
file to its final bundled URL at build time (small SVGs — everything here —
end up inlined as `data:` URIs by Vite's default asset-inlining threshold;
larger ones would be emitted as separate hashed files; either way nothing is
fetched at runtime, per `WORKPLAN.md` §0.1). This also means adding a 161st
crop later requires no import-list edit — dropping a new file into `crops/`
is picked up automatically.

## Alternatives considered

- **160 independently hand-illustrated icons.** Rejected per the brief's own
  caution against over-investing a coding session in polished illustration
  work a human may prefer to own or commission. It would also make the
  eventual "swap in a real illustration" path (the style guide documents
  this) strictly _harder_: a hand-drawn set has no shared structure a
  contributor can lean on to keep a 161st icon consistent, whereas the
  archetype library **is** that shared structure, made explicit and reusable.
- **Per-species realistic colour** (red tomatoes, purple grapes, orange
  carrots, ...). Rejected in favour of a fixed three-colour category palette.
  A per-species palette is a second, larger classification problem layered on
  top of the shape one, for a placeholder set whose job is legibility and
  category recognition, not photographic accuracy — and it would fight the
  "single coherent style" requirement, since a rainbow of hand-picked hues
  reads as less unified than three deliberate tokens. Nothing stops a future
  contributor from overriding an individual icon's colour; the category
  default is just that, a default.
- **Fuzzy/keyword-based archetype classification at generation time** (e.g.
  matching `commonName` against a keyword list) instead of the explicit
  `classification.ts` map. Rejected: an explicit, reviewable, typo-checked
  (against `ArchetypeKey`) map is easier for a human contributor to audit and
  correct than a heuristic that could silently misclassify a new crop; the
  map is also the more honest artifact given several assignments are
  judgement calls (e.g. `ginger`/`myoga-ginger` → `rootRound` despite being
  herbs, because the rhizome shape reads better than a leaf sprig).
- **A picture-per-plant identity (SVGR React components, or inlined `<svg>`
  markup in a TS module) instead of URL assets.** Rejected for this stage:
  Stage 4.2 (not this one) decides how icons are actually rendered in the
  palette/canvas, and a plain asset URL (usable as an `<img src>`, a Konva
  `Image` via `useImage`, or inlined by fetching the URL) forecloses the
  fewest options for that stage. Introducing an SVGR build step now would
  also be a new toolchain dependency this stage doesn't need to justify.

## Consequences

- Extending the set (a 161st crop, or replacing a placeholder with real
  illustration) means either adding a `classification.ts` entry and
  re-running the generator, or hand-editing/replacing a specific file in
  `app/src/icons/crops/` directly — `docs/icon-style-guide.md` documents both
  paths.
- The generator (`tools/icons/`) lives outside the npm workspaces
  (`package.json`'s `workspaces` is `["packages/*", "app"]`) so it is not
  type-checked, tested, or built by the root `lint`/`typecheck`/`test`/`build`
  scripts — deliberately, mirroring how `packages/etl`'s own one-off scripts
  are invoked directly rather than wired into CI (which does not exist yet,
  `WORKPLAN.md` §1.4). It **is** linted and format-checked, since those run
  over the whole repository regardless of workspace membership.
- Because several crops share an archetype, two icons differing only by
  category colour can look near-identical at a glance (e.g. any two peppers).
  This is accepted as a placeholder-quality trade-off per the brief; nothing
  in `resolveIcon`'s interface changes if a future stage swaps in more
  differentiated art file-by-file.
- `resolveIcon` is the only supported way to go from a `Plant` to an icon;
  Stage 4.2 should import it from `app/src/icons/index.ts` rather than
  reading `crops/` or `classification.ts` directly, which are the icon set's
  own implementation detail.
