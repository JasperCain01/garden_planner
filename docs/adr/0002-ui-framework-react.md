# 0002 — UI framework: React

## Status

Accepted (Stage 0.1).

## Context

The app's polish is concentrated in a **drag-and-drop plot canvas** with live
feedback and animation. We want an engaging, "pretty" UI _and_ a codebase that is
easy for others to clone and contribute to. The main candidates were React and
Svelte.

## Decision

Use **React** (with Vite), plus a small set of interaction libraries introduced
in later stages:

- **dnd-kit** — accessible, fluid drag-and-drop (also supplies the
  keyboard-accessible drag alternative required by Stage 6.2).
- **react-konva** (or Pixi) — performant 2D canvas rendering of the plot.
- **Framer Motion (Motion)** — physics-based micro-interaction animation.

## Alternatives considered

- **Svelte** — genuinely strong for "pretty" UIs: animation and transitions are
  built into the language, with less boilerplate and smaller bundles. The
  deciding factor against it was that our polish lives in drag-and-drop + canvas
  interaction, where **React's ecosystem is the most mature and best-documented**
  (dnd-kit, react-konva, Framer Motion). That lowers the effort to reach an
  engaging result and, with the larger contributor pool, serves the
  "easily cloned by others" goal.

## Consequences

- Larger JavaScript bundle than a Svelte equivalent. This is a minor cost for a
  PWA that is cached after first load and then runs offline.
- Access to a deep, well-trodden set of examples for the exact interactions this
  app needs.
- Contributors are more likely to already know the framework.
