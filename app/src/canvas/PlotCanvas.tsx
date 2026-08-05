/**
 * The plot canvas (Workplan Stage 3.4 ⭐ signature feature) — `DESIGN.md`
 * §1 step 3: draws the plot outline and every placed plant, and owns
 * select/move/remove once a plant has landed on it. Since UI redesign Phase 2
 * it also draws the *ground* (grid, dimensions, soil surround) and owns
 * editing the outline, which used to be a second picture of the same plot in
 * another column.
 *
 * **The first real react-konva work in this codebase.** ADR 0016 deferred
 * Konva to exactly this stage: a handful of draggable polygon corners
 * (`PlotOutlineEditor.tsx`) didn't need a retained-canvas scene, but "dozens
 * of plant markers, placed, dragged, layered, redrawn on every density
 * recalculation" (that ADR's own description of this stage's job) does. See
 * `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` for the fuller reasoning,
 * including why this component is not component-tested the way
 * `PlotOutlineEditor.test.tsx` was (a Konva `<Stage>` renders to `<canvas>`,
 * which jsdom can't query — the pure logic this component leans on
 * (`geometry.ts`, `grid.ts`, `footprint.ts`, `drop.ts`, `feedback.ts`,
 * `outline-edit.ts`, `state/placements-store.ts`) is tested instead, and this
 * component itself is covered by the Playwright E2E journey per the ADR).
 *
 * **Where dnd-kit's job ends and Konva's begins:** this component is the
 * *drop target* (`useDroppable`, matched against `drop.ts`'s
 * `CANVAS_DROPPABLE_ID` — the palette's `useDraggable` entries are the drag
 * source, wired up in `PlotDefinitionPage.tsx`). Once a plant is on the
 * canvas, dnd-kit is out of the picture entirely: Konva's own `draggable`
 * prop and `onDragEnd` handle moving a placed plant, because that is a
 * continuous in-scene coordinate update, not another drop-zone handoff.
 *
 * **Coordinate conversion** is `geometry.ts`'s `cmToPx`/`pxToCm` at the
 * canvas's **live** scale (`pxPerCm`, measured and zoomed by
 * `useCanvasScale.ts`). Until UI redesign Phase 2 that scale was a fixed 0.6
 * px/cm, which is why the default 3×2m plot drew as a ~228×168px rectangle in
 * the middle of a region twenty times its area. Everything in this file is
 * sized from `pxPerCm` or from the plot's own centimetres — the only fixed
 * pixel sizes left are the ones that must not scale, and each says so.
 *
 * **Warning badges (Workplan Stage 3.5).** A small severity-coloured circle
 * at a marker's top-right corner, present only for a placement `evaluate-
 * canvas.ts` flagged. This component does no warning logic itself — it only
 * looks up `severityByPlacementId` (computed by `warnings/evaluate-canvas.ts`
 * and threaded down from `PlotDefinitionPage.tsx` via `PlotCanvasSection.tsx`)
 * and asks `warnings/severity.ts` for that severity's colour, keeping this
 * file's own job what it has always been — a render of already-computed data
 * (see `docs/adr/0017` for why `PlotCanvas.tsx` has no dedicated component
 * test, and `docs/adr/0018` for the warnings-derivation decision behind the
 * map this reads).
 *
 * **Stage ref (Workplan Stage 3.7).** The optional `stageRef` prop is forwarded
 * straight onto react-konva's `<Stage>`, so `PlotCanvasSection.tsx` can hand
 * the mounted Konva `Stage` instance to `canvas/export.ts`'s `exportPlotImage`
 * for rasterisation. This component still does nothing export-related itself —
 * it only exposes the ref.
 *
 * **Outline editing (UI redesign Phase 2, ADR 0031).** "Edit shape" puts the
 * corner and midpoint handles on *this* scene rather than on a separate SVG in
 * the settings column, so there is one picture of the plot instead of two at
 * different scales. Both the pointer path (drag a handle, click a midpoint,
 * double-click to remove) and the keyboard path (select a corner, arrow keys,
 * Delete) live here; `useOutlineEditing.ts` owns the state and the validation
 * rule, this file owns the drawing and the events.
 */

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import type Konva from 'konva';
import { useDroppable } from '@dnd-kit/core';
import { Circle, Group, Image, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { EdibleCategory, PlotRegion, WarningSeverity } from '@garden-planner/engine';
import { resolveIcon } from '../icons/index.ts';
import { useIconImage } from '../icons/useIconImage.ts';
import { usePlacementsStore, type PlacedPlant } from '../state/placements-store.ts';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion.ts';
import { severityColor, severityGlyph } from '../warnings/severity.ts';
import { CANVAS_DROPPABLE_ID } from './drop.ts';
import { canopyRadiusPx, iconRadiusPx, spacingLabel } from './footprint.ts';
import {
  CANVAS_PADDING_CM,
  canvasSizePx,
  clampToBounds,
  cmToPx,
  pxToCm,
  regionBounds,
} from './geometry.ts';
import { majorGridLinesCm, metresLabel, minorGridLinesCm } from './grid.ts';
import { NAME_FONT_SIZE_PX, visibleLabels } from './labels.ts';
import { SCENE_COLORS, withAlpha } from './scene.ts';
import type { OutlineEditing } from './useOutlineEditing.ts';
import styles from './PlotCanvas.module.css';

/** How far one arrow-key press nudges the selected placement — or, in edit mode, the selected outline corner — in plot centimetres. The keyboard-operable alternative to Konva's pointer-only `draggable` (Workplan Stage 6.2, ADR 0026). */
const NUDGE_STEP_CM = 10;

/** The larger nudge step held-Shift gives, for crossing a big plot without needing dozens of presses. */
const NUDGE_STEP_CM_FAST = 50;

/** Arrow key → unit direction, in the same x/y frame `PlotRegion.vertices` uses (down/right positive, matching screen and canvas pixel conventions). */
const NUDGE_DIRECTIONS: Readonly<Record<string, { dx: number; dy: number }>> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

/** Radius of a warning badge, in canvas pixels — small enough to read as a corner accent, not a second marker. Deliberately **not** scaled: it is a piece of UI sitting on the scene, not a thing in the garden. */
const BADGE_RADIUS_PX = 7;

/** Type sizes for the things drawn on the scene that are UI rather than garden — dimension labels, the tooltip. Screen pixels, so they stay readable at every zoom. (The name label's own size, `NAME_FONT_SIZE_PX`, lives in `labels.ts` now — `visibleLabels`'s collision estimate needs the same figure this draws with.) */
const LABEL_FONT_SIZE_PX = 13;
const TOOLTIP_FONT_SIZE_PX = 12;

/** How strongly the two grids show through the plot's fill. Faint enough to read as texture rather than as a second drawing, per the review's "subtle grid at 50cm (fainter) / 1m (stronger)". */
const GRID_MINOR_ALPHA = 0.12;
const GRID_MAJOR_ALPHA = 0.28;

/** Corner and midpoint handle radii while editing the outline, in screen pixels — a hit target's size is a property of the pointer, not of the plot, so these don't scale either. */
const CORNER_HANDLE_RADIUS_PX = 9;
const MIDPOINT_HANDLE_RADIUS_PX = 6;

/** How long the drop "pop" runs, in seconds (Konva's `to` takes seconds). The review asks for 150ms. */
const DROP_POP_SECONDS = 0.15;

/** The scale a just-dropped marker pops up *from*. */
const DROP_POP_FROM = 0.6;

/** A pointer press that moves less than this many pixels is a click, not a pan — so "click empty ground to deselect" survives the pan gesture living on the same button. */
const PAN_CLICK_SLOP_PX = 4;

/** No warnings for anyone — the default so callers that haven't computed warnings yet (or whose conditions don't currently resolve) can pass nothing rather than build an empty map themselves. */
const NO_SEVERITIES: ReadonlyMap<string, WarningSeverity> = new Map();

/**
 * A colour per edible category, rendered as the marker's canopy and core
 * (Stage 4.2). Provides immediate, at-a-glance category indication even while
 * the icon image is loading. Not a suitability cue — unrelated to the
 * palette's band colours.
 *
 * **Held here as literal strings, and mirrored in CSS (UI redesign Phase 0).**
 * Konva paints a `<canvas>`, so it cannot read a CSS custom property — this
 * map has to be TypeScript. The DOM side of the same idea (a category chip in
 * the palette, a legend) reads `--category-*` from `styles/tokens.css`
 * instead, so the values exist twice; `styles/tokens.test.ts` imports this map
 * and fails if the two copies ever disagree. Exported for that test. The rest
 * of the scene's colours work the same way and live in `scene.ts`.
 */
export const CATEGORY_COLORS: Readonly<Record<EdibleCategory, string>> = {
  vegetable: '#4c8c2b',
  herb: '#00796b',
  fruit: '#c0392b',
};

export interface PlotCanvasProps {
  /** The outline to draw and place plants within. Not `usePlotStore`'s `region` directly: while an outline edit is mid-flight and invalid, this is the *draft* (`useOutlineEditing.ts#useDisplayRegion`), so the whole scene moves with the corner being dragged. */
  readonly region: PlotRegion;
  /** Rendered canvas pixels per plot centimetre — the live, fitted-and-zoomed scale from `useCanvasScale.ts`. */
  readonly pxPerCm: number;
  /** Worst severity per placement id (`warnings/evaluate-canvas.ts`'s `CanvasWarnings.severityByPlacementId`), for the badge each marker shows. Defaults to no warnings for anyone. */
  readonly severityByPlacementId?: ReadonlyMap<string, WarningSeverity>;
  /** Forwarded onto the underlying Konva `Stage` (Workplan Stage 3.7) so `PlotCanvasSection` can rasterise it for export (`canvas/export.ts`) without this component knowing anything about exporting. */
  readonly stageRef?: RefObject<Konva.Stage | null>;
  /** Outline-editing state and operations (`useOutlineEditing.ts`). Optional so a caller that doesn't offer editing — and `PlotCanvas.test.tsx` — can leave it out. */
  readonly outlineEditing?: OutlineEditing;
  /** The scrolling element the stage sits in, so dragging empty ground can pan it when zoomed in. Optional for the same reason. */
  readonly panContainerRef?: RefObject<HTMLElement | null>;
}

/**
 * A placed-plant marker (UI redesign Phase 2 — "footprint-true markers").
 *
 * Three concentric pieces, and the reason there are three is the whole point
 * of the change:
 *
 * 1. the **canopy**, a translucent disc at the crop's real spacing footprint ×
 *    the live scale (`footprint.ts`) — this is what makes a butternut squash
 *    visibly claim half a 3m bed while a radish claims a thumbprint;
 * 2. the **core**, a solid category-coloured circle capped at a legible size,
 *    which is what the 16px marker used to be and is still what you click;
 * 3. the **icon**, drawn on the core once it has loaded (async, so the core
 *    renders immediately for instant category feedback).
 *
 * Plus a warning badge when the placement has one, a glow ring when it is
 * selected, and a name label once the canvas is zoomed in far enough for the
 * text to be shorter than the plant's own footprint.
 *
 * **The canopy's *fill* is not drawn here (post-review fix A1).** A
 * tree-scale crop's footprint can exceed the plot itself — an Apple
 * (360×450 cm spacing) on the default 3×2 m bed floods the entire canvas in
 * translucent red, reading as an error overlay rather than one plant's
 * footprint. `PlotCanvas`'s render draws every placement's fill together in
 * one `<Group>` clipped to the plot outline (the same `clipFunc` the grid
 * uses), *below* every marker, so the flood can never spill onto the soil
 * surround or the dimension labels and never covers a neighbouring marker's
 * core. This component still draws the canopy's **outline ring**, unclipped
 * — the ring visibly exceeding the plot is the honest part of the picture,
 * matching the engine's own "only 0 fit" feedback, and clipping only the
 * fill is what keeps it that way. Clipping was measured sufficient for the
 * Apple-on-3×2m case (every core renders after every fill, so cores are
 * never obscured regardless of fill opacity); the optional alpha-easing this
 * fix's writeup allowed for wasn't needed.
 */
interface PlacementMarkerProps {
  readonly placement: PlacedPlant;
  readonly px: { x: number; y: number };
  readonly pxPerCm: number;
  readonly isSelected: boolean;
  /** Whether this placement survived `labels.ts#visibleLabels`'s collision pass (post-review fix A2) — replaces the old `pxPerCm >= NAME_LABEL_MIN_PX_PER_CM` check, which said nothing about *neighbouring* labels. */
  readonly showLabel: boolean;
  readonly reduceMotion: boolean;
  readonly severityByPlacementId: ReadonlyMap<string, WarningSeverity>;
  readonly onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  readonly onSelect: () => void;
  readonly onRemove: () => void;
  readonly onHoverChange: (hovered: boolean) => void;
}

function PlacementMarker({
  placement,
  px,
  pxPerCm,
  isSelected,
  showLabel,
  reduceMotion,
  severityByPlacementId,
  onDragEnd,
  onSelect,
  onRemove,
  onHoverChange,
}: PlacementMarkerProps) {
  const icon = resolveIcon(placement.plant);
  const iconImage = useIconImage(icon.url);
  const groupRef = useRef<Konva.Group>(null);

  const canopyPx = canopyRadiusPx(placement.plant, pxPerCm);
  const corePx = iconRadiusPx(placement.plant, pxPerCm);
  const categoryColor = CATEGORY_COLORS[placement.plant.category];

  /*
   * The drop "pop": a marker scales up from 60% to full over 150ms when it
   * first appears. Markers are keyed by placement id, so a mount *is* a drop —
   * there is no "which one is new" bookkeeping to get wrong.
   *
   * **Post-review fix A1 moved the canopy fill out of this Group** (it now
   * draws in `PlotCanvas`'s own plot-clipped layer, below every marker, so a
   * tree-scale crop's fill can't flood the canvas). The pop still animates
   * this whole Group — glow, ring, core, icon, badge, label — the fill simply
   * isn't a member of it any more and appears at its clipped size without
   * popping. A ring popping in around an already-present fill reads fine;
   * splitting the pop itself across two layers to keep the fill animated too
   * would need a second, position-synced tween for one cosmetic 150ms beat.
   *
   * `node.to()` is a method on an already-constructed Konva node, never a
   * `new Konva.Tween()`, for the same reason `export.ts` only ever calls
   * methods on the stage it is handed: importing the `konva` package at module
   * scope crashes under Vitest (ADR 0017, `src/test/setup.ts`). Both calls are
   * guarded because under that test setup `groupRef` holds a mocked `<div>`
   * with neither method.
   */
  useEffect(() => {
    const node = groupRef.current;
    if (node === null || reduceMotion) return;
    if (typeof node.scale !== 'function' || typeof node.to !== 'function') return;
    node.scale({ x: DROP_POP_FROM, y: DROP_POP_FROM });
    node.to({ scaleX: 1, scaleY: 1, duration: DROP_POP_SECONDS });
  }, [reduceMotion]);

  return (
    <Group
      ref={groupRef}
      x={px.x}
      y={px.y}
      draggable
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onRemove}
      onDblTap={onRemove}
      onMouseEnter={(event: Konva.KonvaEventObject<MouseEvent>) => {
        setStageCursor(event, 'grab');
        onHoverChange(true);
      }}
      onMouseLeave={(event: Konva.KonvaEventObject<MouseEvent>) => {
        setStageCursor(event, '');
        onHoverChange(false);
      }}
    >
      {/* The selection glow, drawn under everything so it reads as light
          escaping from behind the marker rather than a ring drawn on it. The
          review asked for "glow ring, not stroke tweak" — a stroke-width
          change was invisible on a 16px circle and would be more so on a
          canopy. */}
      {isSelected && (
        <Circle
          radius={canopyPx + 6}
          stroke={SCENE_COLORS['green-700']}
          strokeWidth={3}
          shadowColor={SCENE_COLORS['green-700']}
          shadowBlur={16}
          shadowOpacity={0.9}
          listening={false}
        />
      )}
      {/* The canopy's outline ring only — how much ground this plant actually
          wants. Deliberately unclipped, unlike the fill (drawn separately, in
          `PlotCanvas`'s own clipped layer, below every marker — see A1's note
          on `PlacementMarker`'s doc comment): the ring visibly exceeding the
          plot for a tree-scale crop is the honest part of the picture. Not
          listening — the **core** below is the marker's hit target, so a
          click anywhere in a huge canopy doesn't select it from arbitrary
          distance. */}
      <Circle
        radius={canopyPx}
        stroke={withAlpha(categoryColor, 0.55)}
        strokeWidth={1}
        listening={false}
      />
      {/* The core, always visible for immediate category feedback, and what
          gets clicked (Konva bubbles a hit on this shape up to this Group's
          onClick/onTap). */}
      <Circle
        radius={corePx}
        fill={categoryColor}
        stroke={SCENE_COLORS['surface-card']}
        strokeWidth={1.5}
      />
      {/* Icon image, rendered once loaded. */}
      {iconImage && (
        <Image
          image={iconImage}
          x={-corePx}
          y={-corePx}
          width={corePx * 2}
          height={corePx * 2}
          listening={false}
        />
      )}
      {/* The crop's name, once there is room for it to mean anything *and*
          `labels.ts#visibleLabels` says it doesn't collide with a
          neighbour's (post-review fix A2). */}
      {showLabel && (
        <Text
          text={placement.plant.commonName}
          fontSize={NAME_FONT_SIZE_PX}
          fill={SCENE_COLORS['text-strong']}
          width={240}
          offsetX={120}
          y={canopyPx + 3}
          align="center"
          listening={false}
        />
      )}
      {/* Warning badge, if present — pinned to the core, not the canopy, so it
          stays beside the icon rather than drifting to the edge of a large
          crop's footprint. */}
      {(() => {
        const severity = severityByPlacementId.get(placement.id);
        if (severity === undefined) return null;
        const badgeOffset = corePx * 0.75;
        return (
          <Group x={badgeOffset} y={-badgeOffset} listening={false}>
            <Circle
              radius={BADGE_RADIUS_PX}
              fill={severityColor(severity)}
              stroke={SCENE_COLORS['surface-card']}
              strokeWidth={1}
            />
            <Text
              text={severityGlyph(severity)}
              fontStyle="bold"
              fontSize={10}
              fill={SCENE_COLORS['surface-card']}
              width={BADGE_RADIUS_PX * 2}
              height={BADGE_RADIUS_PX * 2}
              offsetX={BADGE_RADIUS_PX}
              offsetY={BADGE_RADIUS_PX}
              align="center"
              verticalAlign="middle"
            />
          </Group>
        );
      })()}
    </Group>
  );
}

/**
 * Set the cursor on the Konva stage's own container element.
 *
 * Konva shapes are painted pixels, not DOM nodes, so `cursor:` in a stylesheet
 * cannot reach them — the stage's container is the only element there is, and
 * whatever is under the pointer has to set it. Passing `''` clears the inline
 * style so the container falls back to inheriting from `.stage`, which is what
 * carries the pan cursor.
 *
 * Defensive about the lookup because under the Vitest mock (`src/test/setup.ts`)
 * these events don't carry a real Konva target at all.
 */
function setStageCursor(event: Konva.KonvaEventObject<MouseEvent>, cursor: string): void {
  const container = event.target?.getStage?.()?.container?.();
  if (container !== undefined && container !== null) {
    container.style.cursor = cursor;
  }
}

export function PlotCanvas({
  region,
  pxPerCm,
  severityByPlacementId = NO_SEVERITIES,
  stageRef,
  outlineEditing,
  panContainerRef,
}: PlotCanvasProps) {
  const placements = usePlacementsStore((state) => state.placements);
  const selectedId = usePlacementsStore((state) => state.selectedId);
  const movePlacement = usePlacementsStore((state) => state.movePlacement);
  const removePlacement = usePlacementsStore((state) => state.removePlacement);
  const selectPlacement = usePlacementsStore((state) => state.selectPlacement);
  const reduceMotion = usePrefersReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Registers this element as the drop target `drop.ts`'s `resolveDrop` looks
  // for — the palette→canvas handoff half of this stage's drag-and-drop.
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const editing = outlineEditing?.active === true;
  const size = canvasSizePx(region, pxPerCm);
  const bounds = regionBounds(region);
  const toPx = (point: { x: number; y: number }) => cmToPx(point, region, pxPerCm);
  const outlinePoints = region.vertices.flatMap((vertex) => {
    const px = toPx(vertex);
    return [px.x, px.y];
  });
  const outlineInvalid = editing && outlineEditing?.error != null;
  const hovered = placements.find((placement) => placement.id === hoveredId) ?? null;
  // Post-review fix A2: which markers actually get to draw a name label,
  // once neighbours are close enough to collide (`labels.ts`).
  const shownLabelIds = visibleLabels(placements, region, pxPerCm, selectedId);

  /*
   * Panning by dragging empty ground, the review's companion to zoom.
   *
   * The scroll happens on the *viewport* element (`PlotCanvasSection`'s
   * `.viewport`, handed down as `panContainerRef`) rather than by translating
   * the stage: the viewport already scrolls a zoomed-in plot natively — which
   * is what gives keyboard users and trackpads a pan for free — and a second,
   * parallel notion of "where the plot is" would immediately disagree with it.
   *
   * The gesture shares its button with "click empty ground to deselect", so
   * the two are told apart the only way they can be: by whether the pointer
   * actually moved (`PAN_CLICK_SLOP_PX`). A press that doesn't move is a
   * click and still deselects.
   */
  const panRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null,
  );
  const pannedRef = useRef(false);

  function handleStageBackgroundPress(event: Konva.KonvaEventObject<Event>): void {
    if (event.target !== event.target.getStage()) {
      return;
    }
    pannedRef.current = false;
    const container = panContainerRef?.current;
    const pointer = 'clientX' in event.evt ? (event.evt as PointerEvent) : null;
    if (container == null || pointer === null) {
      // Nothing to pan (or a touch/synthetic event with no client point):
      // fall back to the pre-Phase-2 behaviour of deselecting on press.
      selectPlacement(null);
      return;
    }
    panRef.current = {
      x: pointer.clientX,
      y: pointer.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  }

  useEffect(() => {
    function handleMove(event: PointerEvent): void {
      const start = panRef.current;
      const container = panContainerRef?.current;
      if (start === null || container == null) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!pannedRef.current && Math.hypot(dx, dy) < PAN_CLICK_SLOP_PX) return;
      pannedRef.current = true;
      container.scrollLeft = start.scrollLeft - dx;
      container.scrollTop = start.scrollTop - dy;
    }

    function handleUp(): void {
      if (panRef.current === null) return;
      panRef.current = null;
      // A press on empty ground that never became a pan is a click.
      if (!pannedRef.current) selectPlacement(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [panContainerRef, selectPlacement]);

  /** A placed plant's own drag (moving it within the plot) — Konva's job, not dnd-kit's; see the module doc. */
  function handlePlantDragEnd(placementId: string, event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    movePlacement(placementId, pxToCm({ x: node.x(), y: node.y() }, region, pxPerCm));
  }

  /** An outline corner's own drag, while editing. Same conversion, different destination. */
  function handleCornerDragMove(index: number, event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    outlineEditing?.moveCorner(index, pxToCm({ x: node.x(), y: node.y() }, region, pxPerCm));
  }

  /**
   * Delete/Backspace removes what is selected and the arrow keys move it —
   * Workplan Stage 6.2's keyboard-operable alternative to Konva's pointer-only
   * `draggable`, extended in UI redesign Phase 2 to the outline's corners.
   *
   * **Which "it" depends on the mode**, and that is the design: in arrange
   * mode the keys act on the selected *plant*, in edit-shape mode on the
   * selected *corner*. One set of keys, one mental model, and the corner
   * editor stops being the pointer-only hole `docs/accessibility.md` §5 had
   * recorded since Stage 6.2. Both need a selection first; the toolbar gives
   * keyboard users two ways to get one (Previous/Next placement, Previous/Next
   * corner), since Konva shapes aren't independently focusable/tabbable the
   * way DOM elements are.
   */
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const step = event.shiftKey ? NUDGE_STEP_CM_FAST : NUDGE_STEP_CM;
    const direction = NUDGE_DIRECTIONS[event.key];
    const isDelete = event.key === 'Delete' || event.key === 'Backspace';

    if (editing && outlineEditing !== undefined) {
      const index = outlineEditing.selectedCornerIndex;
      if (index === null) return;
      if (isDelete) {
        event.preventDefault();
        outlineEditing.removeCorner(index);
        return;
      }
      if (direction === undefined) return;
      event.preventDefault();
      outlineEditing.nudgeSelectedCorner(direction.dx * step, direction.dy * step);
      return;
    }

    if (selectedId === null) {
      return;
    }
    if (isDelete) {
      event.preventDefault();
      removePlacement(selectedId);
      return;
    }
    if (direction === undefined) {
      return;
    }
    event.preventDefault();
    const current = placements.find((placement) => placement.id === selectedId);
    if (current === undefined) {
      return;
    }
    const next = clampToBounds(
      { x: current.x + direction.dx * step, y: current.y + direction.dy * step },
      region,
    );
    movePlacement(selectedId, next);
  }

  return (
    <div
      ref={setNodeRef}
      // Anchor target for `PlotDefinitionPage.tsx`'s "Skip to plot canvas"
      // link (Workplan Stage 6.2) — a keyboard user placing a crop via the
      // palette's "Add to plot" button would otherwise have to tab through
      // every remaining filtered palette row *and* the whole "Add your own
      // crop" form to reach the canvas and nudge the plant into place; the
      // walkthrough in `docs/accessibility.md` measured that at 20+ tab
      // presses for a six-crop search match.
      id="plot-canvas"
      tabIndex={0}
      // `role="group"` (Workplan Stage 6.2): a plain `<div>` with no ARIA
      // role has an implicit role that doesn't support `aria-label` at all
      // (axe's `aria-prohibited-attr` rule). "group" is the honest fit — a
      // labelled, keyboard-focusable container for the placed-plant markers
      // and the drop target, not a specific ARIA widget this doesn't behave
      // like.
      role="group"
      onKeyDown={handleKeyDown}
      // The label changes with the mode, because the keys do. A user who
      // turned on "Edit shape" and heard the arrange-mode instructions read
      // back would be told the wrong thing about the only controls they have.
      aria-label={
        editing
          ? 'plot canvas, editing the plot shape — select a corner with the Previous/Next corner buttons (or click one) and use the arrow keys to move it (hold Shift to move further); press Delete or Backspace to remove the selected corner, or click a small blue handle to add one'
          : 'plot canvas — drag plants here to place them, or select one and use the arrow keys (hold Shift to move further) to nudge it; click a placed plant to select it'
      }
      className={styles.stage}
      // Whether dragging empty ground pans, which is what the `grab` cursor in
      // `PlotCanvas.module.css` promises. False while editing: there, dragging
      // is for corners.
      data-pannable={!editing && panContainerRef != null}
      // Size stays inline: it's computed from the plot's own dimensions and
      // the live scale, and changes with both (`geometry.ts#canvasSizePx`).
      style={{ width: size.width, height: size.height }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleStageBackgroundPress}
        onTouchStart={handleStageBackgroundPress}
      >
        <Layer>
          {/* The ground outside the plot. Painted here rather than left to the
              viewport's CSS background so an exported PNG shows the same
              scene the app does, instead of the plot floating on white. */}
          <Rect
            width={size.width}
            height={size.height}
            fill={SCENE_COLORS['soil-100']}
            listening={false}
          />

          {/* The plot itself. The drop tint lives *here* now, on the interior,
              rather than as a dashed border on the container element — the
              review's point being that the thing lighting up should be the
              thing you are dropping onto. */}
          <Line
            points={outlinePoints}
            closed
            fill={
              isOver
                ? withAlpha(SCENE_COLORS['green-500'], 0.45)
                : withAlpha(SCENE_COLORS['green-100'], 0.95)
            }
            stroke={
              outlineInvalid
                ? SCENE_COLORS.danger
                : isOver
                  ? SCENE_COLORS['green-500']
                  : SCENE_COLORS['green-700']
            }
            strokeWidth={2}
            dash={isOver ? [8, 6] : undefined}
            // A soft drop shadow rather than the review's "1px inner shadow":
            // Konva has no inset shadow, and lifting the bed off the soil
            // reads better than a hairline inside it anyway.
            shadowColor={SCENE_COLORS['green-700']}
            shadowBlur={12}
            shadowOpacity={0.18}
            shadowOffsetY={2}
            listening={false}
          />

          {/* The grid, clipped to the outline so an L-shaped plot's notch stays
              bare ground. `clipFunc` gets Konva's context and draws the same
              polygon; it constructs no Konva node, which is what keeps this
              file importable under Vitest (ADR 0017). */}
          <Group
            listening={false}
            clipFunc={(ctx: Konva.Context) => {
              ctx.beginPath();
              region.vertices.forEach((vertex, index) => {
                const px = toPx(vertex);
                if (index === 0) ctx.moveTo(px.x, px.y);
                else ctx.lineTo(px.x, px.y);
              });
              ctx.closePath();
            }}
          >
            {(
              [
                [minorGridLinesCm(bounds), GRID_MINOR_ALPHA, 'minor'],
                [majorGridLinesCm(bounds), GRID_MAJOR_ALPHA, 'major'],
              ] as const
            ).map(([lines, alpha, kind]) => (
              <Group key={kind}>
                {lines.xs.map((x) => (
                  <Line
                    key={`${kind}-x-${x}`}
                    points={[toPx({ x, y: 0 }).x, 0, toPx({ x, y: 0 }).x, size.height]}
                    stroke={withAlpha(SCENE_COLORS['green-700'], alpha)}
                    strokeWidth={1}
                  />
                ))}
                {lines.ys.map((y) => (
                  <Line
                    key={`${kind}-y-${y}`}
                    points={[0, toPx({ x: 0, y }).y, size.width, toPx({ x: 0, y }).y]}
                    stroke={withAlpha(SCENE_COLORS['green-700'], alpha)}
                    strokeWidth={1}
                  />
                ))}
              </Group>
            ))}
          </Group>

          {/* Overall dimensions, in the padding band outside the outline —
              "for a tool about space, the space itself is unlabelled" was the
              review's complaint, and this is the caption it was missing. */}
          <Text
            text={metresLabel(bounds.width)}
            x={0}
            y={
              toPx({ x: 0, y: bounds.maxY }).y +
              (CANVAS_PADDING_CM * pxPerCm) / 2 -
              LABEL_FONT_SIZE_PX / 2
            }
            width={size.width}
            align="center"
            fontSize={LABEL_FONT_SIZE_PX}
            fill={SCENE_COLORS['soil-700']}
            listening={false}
          />
          <Text
            text={metresLabel(bounds.height)}
            x={(CANVAS_PADDING_CM * pxPerCm) / 2 - LABEL_FONT_SIZE_PX / 2}
            y={size.height}
            rotation={-90}
            width={size.height}
            align="center"
            fontSize={LABEL_FONT_SIZE_PX}
            fill={SCENE_COLORS['soil-700']}
            listening={false}
          />

          {/* Every placement's canopy **fill**, clipped to the outline —
              post-review fix A1. A tree-scale crop's footprint can exceed the
              plot itself (an Apple's 360×450 cm spacing dwarfs the default
              3×2 m bed); drawn per-marker at true scale with no clip, that
              fill floods the whole canvas — plot, soil surround, every other
              marker — in translucent colour, reading as an error rather than
              one plant's footprint. Clipping the *fill* to the same outline
              polygon the grid clips to (`clipFunc`, above) contains the
              flood; `PlacementMarker` still draws each canopy's *ring*
              unclipped, so a marker whose footprint genuinely doesn't fit
              still visibly says so at the plot's edge. Drawn as one shared,
              non-listening group *before* the markers below, so every core is
              always on top of every fill regardless of draw order or overlap
              — clicking a marker never hits a neighbour's canopy fill
              instead. */}
          <Group
            listening={false}
            clipFunc={(ctx: Konva.Context) => {
              ctx.beginPath();
              region.vertices.forEach((vertex, index) => {
                const px = toPx(vertex);
                if (index === 0) ctx.moveTo(px.x, px.y);
                else ctx.lineTo(px.x, px.y);
              });
              ctx.closePath();
            }}
          >
            {placements.map((placement) => {
              const centre = toPx(placement);
              return (
                <Circle
                  key={placement.id}
                  x={centre.x}
                  y={centre.y}
                  radius={canopyRadiusPx(placement.plant, pxPerCm)}
                  fill={withAlpha(CATEGORY_COLORS[placement.plant.category], 0.22)}
                />
              );
            })}
          </Group>

          {placements.map((placement) => (
            <PlacementMarker
              key={placement.id}
              placement={placement}
              px={toPx(placement)}
              pxPerCm={pxPerCm}
              isSelected={placement.id === selectedId}
              showLabel={shownLabelIds.has(placement.id)}
              reduceMotion={reduceMotion}
              severityByPlacementId={severityByPlacementId}
              onDragEnd={(event) => handlePlantDragEnd(placement.id, event)}
              onSelect={() => selectPlacement(placement.id)}
              onRemove={() => removePlacement(placement.id)}
              onHoverChange={(isHovered) =>
                setHoveredId(
                  isHovered
                    ? placement.id
                    : (current) => (current === placement.id ? null : current),
                )
              }
            />
          ))}

          {/* Hover tooltip: what this is and how much room it wants. Drawn
              last so it sits above every marker, and `listening={false}` so it
              can never steal the pointer from the marker it describes (which
              would make it flicker as the pointer moved onto it). */}
          {hovered !== null && (
            <PlantTooltip
              anchor={toPx(hovered)}
              radiusPx={canopyRadiusPx(hovered.plant, pxPerCm)}
              lines={[hovered.plant.commonName, spacingLabel(hovered.plant)]}
            />
          )}

          {editing && outlineEditing !== undefined && (
            <OutlineHandles
              editing={outlineEditing}
              toPx={toPx}
              onCornerDragMove={handleCornerDragMove}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}

/** A two-line label floating above a marker: the crop's name, and the spacing it wants. */
function PlantTooltip({
  anchor,
  radiusPx,
  lines,
}: {
  readonly anchor: { x: number; y: number };
  readonly radiusPx: number;
  readonly lines: readonly string[];
}) {
  // Konva can measure text, but only from a constructed node — which this
  // module cannot build (ADR 0017). An estimate from the longest line is
  // enough for a background panel: too wide by a few pixels is invisible, and
  // the text is centred in it either way.
  const widest = Math.max(...lines.map((line) => line.length));
  const width = widest * TOOLTIP_FONT_SIZE_PX * 0.58 + 16;
  const height = lines.length * (TOOLTIP_FONT_SIZE_PX + 4) + 10;

  return (
    <Group x={anchor.x} y={anchor.y - radiusPx - height - 8} listening={false}>
      <Rect
        x={-width / 2}
        width={width}
        height={height}
        cornerRadius={6}
        fill={SCENE_COLORS['surface-card']}
        stroke={withAlpha(SCENE_COLORS['soil-700'], 0.35)}
        strokeWidth={1}
        shadowColor={SCENE_COLORS['soil-700']}
        shadowBlur={8}
        shadowOpacity={0.25}
      />
      <Text
        text={lines.join('\n')}
        x={-width / 2}
        y={5}
        width={width}
        align="center"
        lineHeight={1.35}
        fontSize={TOOLTIP_FONT_SIZE_PX}
        fill={SCENE_COLORS['text-strong']}
      />
    </Group>
  );
}

/**
 * The outline's corner and midpoint handles, drawn only in edit mode.
 *
 * A direct port of `PlotOutlineEditor.tsx`'s SVG handles, with two
 * differences. The drag is Konva's own `draggable`/`onDragMove` rather than
 * hand-tracked `pointermove` deltas — that hand-tracking existed because the
 * SVG editor had to convert screen pixels to centimetres without
 * `getScreenCTM` (unimplemented in jsdom), and a Konva node reports its
 * position in stage coordinates directly, which `pxToCm` converts with the
 * same arithmetic as everything else on this canvas. And a corner now has a
 * *selected* state, because that is what the arrow keys act on.
 */
function OutlineHandles({
  editing,
  toPx,
  onCornerDragMove,
}: {
  readonly editing: OutlineEditing;
  readonly toPx: (point: { x: number; y: number }) => { x: number; y: number };
  readonly onCornerDragMove: (index: number, event: Konva.KonvaEventObject<DragEvent>) => void;
}) {
  return (
    <Group>
      {editing.vertices.map((vertex, index) => {
        const next = editing.vertices[(index + 1) % editing.vertices.length];
        const midpoint = toPx({ x: (vertex.x + next.x) / 2, y: (vertex.y + next.y) / 2 });
        const corner = toPx(vertex);
        const isSelected = editing.selectedCornerIndex === index;
        return (
          <Group key={index}>
            {/* "Add a corner here". Same `--sky-500` this affordance had as an
                SVG circle, so the gesture looks like the one it replaced. */}
            <Circle
              x={midpoint.x}
              y={midpoint.y}
              radius={MIDPOINT_HANDLE_RADIUS_PX}
              fill={SCENE_COLORS['sky-500']}
              stroke={SCENE_COLORS['surface-card']}
              strokeWidth={1.5}
              onClick={() => editing.addCornerAfter(index)}
              onTap={() => editing.addCornerAfter(index)}
              onMouseEnter={(event: Konva.KonvaEventObject<MouseEvent>) =>
                setStageCursor(event, 'copy')
              }
              onMouseLeave={(event: Konva.KonvaEventObject<MouseEvent>) =>
                setStageCursor(event, '')
              }
            />
            <Circle
              x={corner.x}
              y={corner.y}
              radius={CORNER_HANDLE_RADIUS_PX}
              fill={SCENE_COLORS['green-500']}
              stroke={isSelected ? SCENE_COLORS['text-strong'] : SCENE_COLORS['surface-card']}
              strokeWidth={isSelected ? 3 : 1.5}
              draggable
              onDragMove={(event: Konva.KonvaEventObject<DragEvent>) =>
                onCornerDragMove(index, event)
              }
              // Dragging a corner selects it, so the arrow keys carry on from
              // wherever the pointer left off rather than acting on some other
              // corner selected earlier.
              onMouseDown={() => editing.selectCorner(index)}
              onClick={() => editing.selectCorner(index)}
              onTap={() => editing.selectCorner(index)}
              onDblClick={() => editing.removeCorner(index)}
              onDblTap={() => editing.removeCorner(index)}
              onMouseEnter={(event: Konva.KonvaEventObject<MouseEvent>) =>
                setStageCursor(event, 'grab')
              }
              onMouseLeave={(event: Konva.KonvaEventObject<MouseEvent>) =>
                setStageCursor(event, '')
              }
            />
          </Group>
        );
      })}
    </Group>
  );
}
