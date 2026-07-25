# 0015 — App state management: Zustand, and the id-keyed user-plant overlay

- **Status:** Accepted
- **Date:** 2026-07-25
- **Workplan stage:** 3.1 — app shell, state & routing

## Context

Stage 3.1 (`docs/stage-3.1-brief.md`) is the first Phase 3 stage: it stands up
the app shell, routing, and the dataset-loading layer every later UI stage
builds on. `WORKPLAN.md` §0.5 pins React, Vite, dnd-kit, react-konva, and
Framer Motion, but deliberately leaves state management unpinned — "the brief
doesn't prescribe Redux/Zustand/Context/whatever". Two things need an answer
this stage:

1. **What holds the app's client state** (the plot definition, placed crops,
   and — the part that actually matters for Stage 3.1 — the session's
   user-defined crops), and how later stages (3.2 plot, 3.4 canvas, 3.6
   add-crop form) are expected to read and write it.
2. **What shape the user-plant overlay is** — ADR 0011 settled that a user
   crop is a fully-valid `Plant` with a `user-`-namespaced id, produced by
   `createUserPlant`; it did not settle how a collection of them is held in
   memory for the session.

Both are the kind of choice a newcomer forking this project might question, so
they get an ADR together rather than two thin ones — they're one decision in
practice: picking a state container mostly matters for how naturally it
expresses the overlay shape below.

## Decision

### State library: Zustand

**Zustand**, via a small number of independent stores (one per concern,
starting with the user-plant overlay in `state/user-plants-store.ts`) rather
than one large combined store or React Context.

Reasoning:

- **The state is UI-adjacent but not view-shaped.** The user-plant overlay, and
  later the plot/placement state, are plain data the _engine_ also consumes
  (`rankPlants`, `fitPlant`, `evaluatePlot` all take plain values, never a
  React type). Zustand stores are plain JS outside of React — `useUserPlantsStore.getState()`
  works in a test, a future non-component utility, or the browser console with
  no Provider and no render — which matches "keep modules framework-agnostic
  where possible" (`WORKPLAN.md` §0.2) better than Context, whose value only
  exists inside a render tree.
- **No boilerplate tax for what is, so far, simple state.** Redux/Redux
  Toolkit's action/reducer/selector ceremony is built for state large enough to
  need that discipline; Stage 3.1's actual state is "a map of user-added
  plants". Zustand's `create` gives selectors and update batching (`set`) with
  none of that scaffolding, while still scaling to the plot/placement state
  Stages 3.2–3.5 add, each as its own store rather than one growing object.
- **Context was the other realistic option and loses on re-render granularity.**
  A canvas re-evaluating `evaluatePlot` on every placement change (Stage 3.5)
  wants components to subscribe to just the slice they read; plain Context
  re-renders every consumer on any change unless split into many
  providers/memoized values by hand — which is Zustand's selector model, just
  built in rather than hand-rolled.
- **Small, widely used, no server-state features we don't need.** Unlike
  Jotai/Recoil (atom graphs, a different mental model) or TanStack Query
  (built for server/cache state — this app is offline-first with no server),
  Zustand is the closest fit to "a few independent, plain-object stores a
  component can select from".

### Overlay shape: `Record<PlantId, Plant>`, keyed by id

The session's user-defined crops are held as a **plain object keyed by
`Plant.id`** (`state/user-plants-store.ts`), not an array:

```ts
userPlants: Readonly<Record<string, Plant>>;
```

- **No duplicate id is a property of the data structure, not a rule callers
  remember.** An array overlay could accumulate two entries with the same id
  if a caller forgot to check first; a keyed map cannot — assigning to an
  existing key replaces it. That also gives "editing" a crop (Stage 3.6, not
  built yet) a free implementation: re-submit with the same id, and
  `addUserPlant` overwrites rather than duplicates.
- **Removal and lookup are both O(1) by the only key that matters.** Every
  consumer of a user crop already has its `id` (that's how ADR 0011's `user-`
  namespace and `isUserPlantId` work), so keying by id costs nothing and saves
  a `findIndex`/`filter` pair on every remove.
- **The concatenation stays trivial.** `use-plant-list.ts`'s
  `usePlantList()` does `[...SHIPPED_PLANTS, ...Object.values(userPlants)]` —
  one line, and the shipped array (order-stable, from `data/plants.json`) is
  never touched by the overlay's own key ordering.

The shipped dataset itself is **not** store state — it's loaded once at module
scope (`dataset/shipped-plants.ts`) and never changes for the life of the tab,
so putting it in Zustand would only add a subscription for data that never
fires it.

## Alternatives considered

- **React Context + `useReducer`.** No new dependency, but loses on re-render
  granularity (above) and requires hand-rolling the selector memoization
  Zustand gives for free — a worse version of the same idea for a UI that
  (Stage 3.4 onward) updates on every drag frame.
- **Redux Toolkit.** Mature and familiar, but its action-type/reducer/slice
  ceremony is disproportionate to state this shape; nothing here needs
  time-travel debugging or the middleware ecosystem RTK exists for.
- **Jotai/Recoil (atom-based).** A reasonable fit too, but the atom-graph
  mental model is a bigger conceptual ask for a community project aiming to
  stay easy to fork and learn from (`WORKPLAN.md` §0.2), for no capability this
  app needs over Zustand's plain stores.
- **User overlay as an array (`Plant[]`), de-duplicated on add.** Rejected:
  pushes the "no duplicate id" invariant into every call site that mutates the
  array instead of the data structure enforcing it once.
- **User overlay merged into the same store as the shipped list (one big
  `plants: Plant[]`).** Rejected: it would make "which plants are removable"
  (Stage 3.6's UI need) a filter over the combined list by `isUserPlantId`
  instead of "is this id a key in the overlay" — recoverable, but it re-derives
  a distinction the shipped/user split already gives for free, and it would
  make the shipped array no longer a stable, referentially-unchanging constant
  (harder to memoize against).

## Consequences

- A new dependency, `zustand`, and a convention: state that multiple routes or
  components need lives in its own `state/*.ts` store; state local to one
  component still just uses `useState`.
- `usePlantList()` (`state/use-plant-list.ts`) is the one hook every later
  stage should call for "the current plant list" — palette (3.3), canvas
  drag-source (3.4), and the add-crop form's post-submit list (3.6) all read
  through it rather than reaching into `SHIPPED_PLANTS` or the store
  directly, so the shipped ∪ user concatenation stays in exactly one place.
- The overlay is unpersisted by design (`docs/stage-3.1-brief.md`): a page
  reload loses session-added crops. Nothing about this decision changes that —
  if a future stage adds persistence, it's an explicit addition to
  `user-plants-store.ts` (e.g. a `persist` middleware), not implied by
  anything here.
- Future stores (Stage 3.2's plot definition, Stage 3.4's placements) should
  follow the same pattern: a focused Zustand store per concern, plain data in
  and out, no React-only shapes leaking into what the engine consumes.
