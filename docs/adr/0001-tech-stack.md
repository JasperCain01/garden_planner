# 0001 — Tech stack: TypeScript + Vite monorepo

## Status

Accepted (Stage 0.1).

## Context

We need a stack that produces a **static site** (for free GitHub Pages hosting),
supports **offline** use, keeps the horticultural logic testable in isolation,
and is approachable for contributors who will clone and extend the project.

## Decision

- **Language: TypeScript**, strict mode, across all workspaces. Static typing
  catches whole classes of bugs at author time and makes the code
  self-documenting — valuable for a fork-and-learn project.
- **Build tool: Vite.** Fast static builds with first-class GitHub Pages support
  and a mature plugin ecosystem (React, PWA).
- **Structure: an npm-workspaces monorepo** with three workspaces —
  `app` (front-end), `packages/engine` (framework-free logic), and
  `packages/etl` (build-time data pipeline) — plus a committed `/data` artifact.
  npm workspaces need no extra tooling and are familiar to most contributors.
- **Testing: Vitest** for unit/component tests (shares Vite's config and
  transform pipeline) and **Playwright** for end-to-end tests (already available
  in our environment).
- **Quality: ESLint 9 (flat config) + Prettier**, enforced in CI.
- **Validation: zod + JSON Schema** for the data layer (wired in Stage 0.2).

## Alternatives considered

- **Next.js / other SSR frameworks** — overkill and awkward for a purely static,
  backend-free app; SSR buys us nothing here.
- **Nx / Turborepo** — more powerful monorepo tooling than a three-package
  project needs; npm workspaces keep the barrier to entry low.
- **Jest** instead of Vitest — Vitest reuses the Vite pipeline, so there's one
  fewer config to understand.

## Consequences

- One toolchain (Vite) spans dev, build, and tests, reducing moving parts.
- The monorepo boundary enforces the "engine/etl have no UI dependency" rule
  structurally (see ADR 0003).
- npm workspaces are simple but less feature-rich than dedicated monorepo tools;
  acceptable at this scale, revisit only if the project grows substantially.
