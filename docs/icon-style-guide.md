# Icon style guide (Workplan Stage 4.1)

This is where a contributor looks before adding or replacing a crop icon.
For the reasoning behind the approach (why archetypes instead of 160 bespoke
illustrations, why colour is category-based, why resolution works the way it
does), see [ADR 0019](./adr/0019-icon-set-archetypes-and-resolution.md).
This document is the "how", not the "why."

## Where things live

```
app/src/icons/
  crops/*.svg       160 generated crop icons, one per data/plants.json id
  generic.svg       the fallback icon (no crop-specific icon set)
  resolveIcon.ts     Plant -> IconAsset lookup (the Stage 4.2 interface)
  index.ts           public entry point — import from here
  resolveIcon.test.ts, budget.test.ts

tools/icons/
  archetypes.ts      the ~19 shape-builder functions
  classification.ts  crop id -> archetype key (edit this to change a crop's shape)
  colors.ts          category fill colours + the shared ink stroke colour
  generate.ts        the generator script (run manually, not part of any build)
```

`app/src/icons/` is bundled with the app like any other source file — **there
is no runtime fetch**, per `WORKPLAN.md` §0.1. `tools/icons/` is a
developer-only tool (like `packages/etl`): it is not an npm workspace, so it
is not linted, typechecked, tested, or built automatically; it is linted and
format-checked, since those two checks run over the whole repository.

## Visual conventions

Every icon (crop or fallback) follows the same spec:

| Property         | Value                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `viewBox`        | `0 0 64 64`                                                                                                          |
| `width`/`height` | `64` (present alongside `viewBox` so the file has sane intrinsic dimensions; consumers should still size it via CSS) |
| Safe area        | roughly an 8px margin — keep silhouettes inside `x:8–56, y:8–56`                                                     |
| Stroke width     | `2.5` (in the 64x64 coordinate space)                                                                                |
| Stroke colour    | `#20301f` (`INK` in `tools/icons/colors.ts`) — the **only** stroke colour used, on every icon                        |
| Fill colour      | keyed to `EdibleCategory`, not to a crop's real-world colour — see below                                             |
| Style            | flat fills, rounded line joins/caps, no gradients, no shadows, no photographic detail                                |

### Category fill colours

| Category     | Fill                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| `vegetable`  | `#4f8a45`                                                                   |
| `fruit`      | `#d1683a`                                                                   |
| `herb`       | `#2f8577`                                                                   |
| _(fallback)_ | `#8a8f87` (deliberately desaturated — "no icon set", not a fourth category) |

Colour tells you the category; **shape** (the archetype) tells you the crop
family. This is why, say, every pepper (bell, jalapeño, habanero, ...) shares
one silhouette — see the ADR for why that's an accepted trade-off, not a
gap.

## The archetype library

`tools/icons/archetypes.ts` exports these builders (`(fill, ink) => string`
of inner SVG markup, wrapped by `svgShell`):

`leaf`, `roundHead`, `flowerHead`, `rootRound`, `rootLong`, `bulbAllium`,
`stalk`, `pod`, `corn`, `squash`, `elongatedVeg`, `eggplant`, `okra`,
`pepper`, `roundFruit`, `tuber`, `berryCluster`, `melon`, `nut`,
`herbSprig`, `pineapple`, `dragonFruit`, `starFruit` — plus `seedling`,
used only by the generic fallback.

Each one is built from a small set of shared primitives already in the same
file (`leaf(...)`, `groundLine(...)`, `roundBody(...)`, `stemAndCap(...)`) —
reuse those rather than writing raw path data from scratch when adding a new
archetype, so new shapes stay visually consistent with old ones by
construction.

## Adding an icon for a new crop

This happens whenever a new crop is added to `data/plants.json` (Stage 1.7's
curated input, or a future source adapter).

1. Pick the closest existing archetype for the new crop (skim the list
   above, or look at a similar existing crop in `tools/icons/classification.ts`).
   If none fits, add a new archetype function to `archetypes.ts` and register
   it in the `ARCHETYPES` map at the bottom of that file.
2. Add one line to `tools/icons/classification.ts`: `'<new-id>': '<archetypeKey>'`.
3. Re-run the generator from the repo root:
   ```bash
   node --experimental-strip-types tools/icons/generate.ts
   ```
   This regenerates **every** icon (idempotent — it clears `app/src/icons/crops/`
   first), runs each through SVGO, and prints the total payload size. It
   throws immediately if `data/plants.json` and `classification.ts` disagree
   about which ids exist, so a missing entry can't ship silently.
4. Run `npm test -w app` — `resolveIcon.test.ts` asserts every shipped crop
   resolves to a non-fallback icon, so a missed classification entry (or a
   generation failure) fails the test suite, not just the generator.

## Replacing a placeholder with real illustration

Nothing about `resolveIcon` cares how a file under `app/src/icons/crops/`
was produced. To hand-replace one crop's icon with real artwork:

1. Overwrite `app/src/icons/crops/<id>.svg` directly (don't touch
   `classification.ts` — the generator would just overwrite your file the
   next time someone re-runs it for an unrelated crop, unless you also
   remove that crop's `classification.ts` entry so a future full re-run
   skips it — the cleaner path for a handful of one-off replacements is to
   keep the replacement file and simply not re-run the generator afterward).
2. Keep the same conventions above (`viewBox="0 0 64 64"`, similar stroke
   weight) so the replaced icon doesn't stand out against the rest of the set.
3. Run it through an optimizer (`npx svgo <file>`, same as the generator
   does internally) and check it against the size budget below.
4. Record the new licence/attribution in `NOTICE` if it isn't your own
   original work under the same terms as the rest of the set (see `NOTICE`'s
   "ILLUSTRATIONS" section).

## Size budget

Recorded and **enforced** by `app/src/icons/budget.test.ts` (part of the
normal `npm test` run — CI itself remains deferred, `WORKPLAN.md` §1.4, but
nothing stops the check running locally on every test invocation):

- **Per icon:** ≤ 4 KB (generous headroom — the generated, SVGO-optimized set
  averages well under 1 KB per icon today).
- **Whole set (160 crops + 1 fallback):** ≤ 250 KB.

Actual figures as generated today (`node --experimental-strip-types tools/icons/generate.ts` prints
this on every run): **~121 KB total, ~751 bytes/icon average.** Small
enough that Vite inlines every icon as a `data:` URI in the JS bundle rather
than emitting separate asset files (its default inlining threshold is 4 KB
per asset) — still zero runtime fetches either way.

## Licensing

Every icon is original work generated by `tools/icons/generate.ts` from the
archetype library in this repository — no third-party icon set, font, or
clip-art was used as a source. See `NOTICE`'s "ILLUSTRATIONS" section.
