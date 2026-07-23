# Garden Planner 🌱

An offline-capable, statically-hosted planner for **edible** gardens and
allotments. Describe your plot (size, light/shade, location — default Britain),
and the app helps you work out which crops will thrive, how many fit at proper
spacing, and how to arrange them — with drag-and-drop and live warnings. You can
also **add your own crops** from a seed packet and **export a picture** of the
finished plot.

> **Status: Stages 0.1–1.6 complete.** The plant-record schema, the build-time
> ETL, and the validated dataset (`data/plants.json`, 160 crops) are built and
> green; the framework-free engine (Phase 2) and the drag-and-drop UI (Phase 3+)
> come next. The user-facing features described above — including user-added crops
> and plot-image export — are planned in [`WORKPLAN.md`](./WORKPLAN.md).

## Why this exists

A free, open, easy-to-clone tool for planning a productive garden, built to run
entirely in the browser so it works offline (in the garden, with no signal) and
can be hosted for free on GitHub Pages. See [`DESIGN.md`](./DESIGN.md) for the
concept and the data/architecture reasoning, and [`WORKPLAN.md`](./WORKPLAN.md)
for the staged build plan.

## Quick start

Requires Node.js 20+ (Node 22 recommended).

```bash
npm install        # install all workspaces
npm run dev        # start the app locally (Vite dev server)
```

Other useful commands (run from the repo root):

```bash
npm run build       # build every workspace
npm test            # run unit/component tests across workspaces
npm run typecheck   # type-check every workspace
npm run lint        # lint the whole repo
npm run format      # auto-format with Prettier
npm run e2e         # run Playwright end-to-end tests (builds + previews the app)
```

## Repository layout

This is an npm-workspaces monorepo. The split reflects a deliberate design
choice (see [`WORKPLAN.md`](./WORKPLAN.md) §0.1 and `docs/adr/`): the app is
**fully static and client-side**, and the data pipeline is a **build-time
developer tool** that is never shipped.

| Path               | What it is                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `app/`             | The React + Vite front-end. The only thing deployed to GitHub Pages.                                                     |
| `packages/engine/` | Framework-free horticultural logic (suitability scoring, spacing/density). Unit-testable in isolation; no UI dependency. |
| `packages/etl/`    | Build-time data pipeline. Ingests external plant sources and emits the static dataset. **Not part of the deployed app.** |
| `data/`            | The committed static dataset artifact the app loads at runtime.                                                          |
| `docs/`            | Architecture notes and Architecture Decision Records (`docs/adr/`).                                                      |

## Licensing

- **Code:** MIT (see [`LICENSE`](./LICENSE)).
- **Dataset (`/data`):** CC BY-NC-SA 4.0, inherited from Plants For A Future.
  See [`NOTICE`](./NOTICE).

This project is non-commercial by design and intended to be easily cloned,
forked, and learned from.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). In short: keep code clearly
commented, record non-obvious decisions as ADRs, and leave the repo green
(`lint`, `typecheck`, `test`, `build` all passing).
