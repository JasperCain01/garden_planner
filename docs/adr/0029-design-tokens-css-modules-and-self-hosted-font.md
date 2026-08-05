# 0029 — The design system: CSS custom properties + CSS Modules, and one self-hosted font

- **Status:** Accepted
- **Date:** 2026-07-28
- **Phase:** UI redesign Phase 0 — design system foundation
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

`docs/ui-aesthetic-review.md` opens with a blunt finding: the app "has **no
visual design at all**" — there was not a single CSS file under `app/`, only a
handful of inline `style` props, and everything else was browser default.
Phase 0 of that plan is the prerequisite for the five phases after it: put real
styling infrastructure in place and migrate what exists onto it, without
changing a single layout decision (those are Phases 1–4's job).

So the decisions worth recording here are not "what should it look like" — the
review already specified the palette — but **how styling is expressed in this
codebase from now on**, since every later phase and every future contributor
inherits that choice.

Four questions had to be answered:

1. Tailwind, a component library, or plain CSS?
2. Where do component styles live, and how do they avoid colliding?
3. What happens to colours that a `<canvas>` needs as JavaScript strings?
4. How does a webfont reach an offline-capable, no-CDN PWA?

## Decision

### 1. Plain CSS with custom properties, no framework

`app/src/styles/tokens.css` defines every colour, space, radius, shadow and
type value as a CSS custom property on `:root`; `app/src/styles/global.css`
restyles the HTML primitives (buttons, inputs, selects, fieldsets, links,
focus rings) in terms of those tokens. Both are imported once, from
`main.tsx`.

No Tailwind, no component library. The review recommended this and the
codebase agrees: the app is small, the diff stays readable, and — the reason
that matters most here — this is a teaching-friendly repo (`CONTRIBUTING.md`
§3). A reader who knows CSS can read every rule in this app without learning a
utility vocabulary first, and a token file with the contrast maths written
beside the values teaches something a `bg-green-700` class cannot.

Buttons get their two variants from a `data-variant="primary"` attribute
rather than a class, so a component can render an ordinary styled button
without importing a stylesheet at all, and a component's own `className`
can't accidentally clobber the variant.

### 2. Component styles live in `*.module.css` next to the component

Anything specific to one component — layout, its own states — goes in a CSS
Module beside it (`PlantPalette.module.css` next to `PlantPalette.tsx`). Class
names are locally scoped by the bundler, so two components can both have a
`.field` without knowing about each other, and a module can be read as the
complete styling story for the component it sits next to.

`global.css` holds exactly three utility classes (`.card`, `.muted`,
`.visually-hidden`) and otherwise only element selectors. That boundary is the
point: an element looks right everywhere because of `global.css`; a component
is laid out because of its own module. A growing pile of global utilities
would be Tailwind with extra steps and worse tooling.

**Inline `style` survives in exactly two places**, both of which compute a
value per render that no stylesheet can carry: the dragged palette card's
transform (changes on every pointer move) and the Konva stage's pixel size
(derived from the plot's own dimensions). Both carry a comment saying so.

### 3. Colours a `<canvas>` needs stay in TypeScript — and are checked, not trusted

Konva paints to a `<canvas>` and cannot read a CSS custom property, so
`canvas/PlotCanvas.tsx`'s `CATEGORY_COLORS` and `warnings/severity.ts`'s
`SEVERITY_COLORS` have to remain literal strings in TypeScript. But the DOM
side of the same ideas — a category chip, a severity label in the warnings
list — has to read them from CSS. The values therefore exist twice, which is
exactly the duplication that rots quietly: someone re-tunes a severity colour
for contrast, the canvas badge follows, the warnings list doesn't.

`app/src/styles/tokens.test.ts` reads `tokens.css` off disk and fails if any
`--category-*` or `--severity-*` token disagrees with the TypeScript map it
mirrors. The mirror is enforced, not documented-and-hoped-for. (The
suitability-band colours have no Konva consumer, so `tokens.css` is their only
home — nothing to mirror, nothing to guard.)

### 4. One self-hosted font, latin subset, declared by hand

Headings use **Fraunces** (the review's first suggestion), body text stays on
the system stack. The font ships from `@fontsource-variable/fraunces` in
`node_modules` — never a CDN, because an offline launch (ADR 0022) must not
depend on a network that isn't there, and because a Google Fonts link leaks a
request to a third party.

`app/src/styles/fonts.css` writes the `@font-face` out by hand rather than
importing the package's `index.css`, which declares three subsets (latin,
latin-ext, Vietnamese) and would have Vite emit — and Workbox precache — all
three, ~110 kB, for a UI that needs one. Declaring the latin face alone ships
36 kB, and its `unicode-range` is copied verbatim from the package so the
browser's subset matching is unchanged.

Two consequences had to be handled rather than assumed:

- `vite.config.ts`'s Workbox `globPatterns` gained `woff2`. The font is over
  Vite's inline limit, so it is emitted as a real hashed file — without this
  it would have been the one asset an offline launch had to fetch and
  couldn't. (Unlike the `svg` in that list, which is a safety net, this one is
  load-bearing today.)
- Fraunces is SIL Open Font License 1.1, which requires the licence to travel
  with the font. It ships at `app/public/fonts-fraunces-OFL.txt` and is
  recorded in `/NOTICE`.

## Alternatives considered

- **Tailwind.** Fastest to write, and the review explicitly allowed it if the
  implementer preferred. Rejected for this codebase: it puts the design
  vocabulary in a config file and the styling in the JSX, which is the
  opposite of the "reasoning next to the code" convention every other module
  here follows, and it would make the Phase 0 diff a rewrite of every
  component's markup rather than an additive change.
- **A component library (MUI, Radix, shadcn).** Would supply accessible
  primitives — but Stage 6.2 already hand-built and audited the accessible
  behaviour this app needs, and adopting a library now would mean re-doing
  that work against someone else's abstractions, plus a large dependency in a
  bundle that already ships a 144-crop dataset and Konva.
- **One global stylesheet, no modules.** Simplest possible setup, and fine at
  today's size — but it makes every class name a global name, which is a bill
  that comes due exactly when Phase 1 starts moving components around.
- **Styled-components / CSS-in-JS.** Runtime cost, an extra dependency, and it
  would put styling back inside the components — the thing Phase 0 exists to
  undo.
- **Importing `@fontsource-variable/fraunces/index.css`.** One line instead of
  a hand-written `@font-face`, at the cost of tripling the precached font
  payload for subsets this UI never renders.
- **Variable font with all axes** (`full.css`, ~104 kB latin). Fraunces' SOFT
  and WONK axes are genuinely charming; nothing in the design uses them today,
  so the weight-only file is what ships.

## Consequences

- **Every later phase has a vocabulary to spend.** Phases 1–5 add layout and
  behaviour without re-litigating colour, spacing or type — and a change of
  mind about any of those happens in one file.
- **Two colour maps are duplicated across languages.** Accepted, because the
  alternative (reading computed styles from JavaScript at paint time) is worse
  in every way. The drift test is what makes it safe.
- **Two band colours moved.** `poor` and `unsuitable` were tuned in Stage 6.2
  to clear 4.5:1 against _white_; a chip puts them on a tint, where no usable
  tint kept them compliant. Both were darkened one step in the same hue and
  re-measured (`docs/accessibility.md` §2). Contrast was preserved; the exact
  hexes were not, and that is the right trade.
- **The e2e drag helper got more robust, not more fragile.** Capping the
  palette list at `min(65vh, 40rem)` made the page height independent of the
  viewport, which meant a filtered crop could sit below the _list's_ own fold;
  `e2e/drag.ts` now scrolls the entry into the palette's scrollport before
  measuring. That is a real trap the helper's own doc now names, and it no
  longer depends on picking a tall-enough viewport.
- **A webfont is now on the critical path for headings.** `font-display: swap`
  keeps text visible while it loads, and the system stack renders the same
  content if it never arrives.
