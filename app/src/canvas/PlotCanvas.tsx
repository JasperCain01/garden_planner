/**
 * The plot canvas (Workplan Stage 3.4 ⭐ signature feature) — `DESIGN.md`
 * §1 step 3: draws the plot outline and every placed plant, and owns
 * select/move/remove once a plant has landed on it.
 *
 * **The first real react-konva work in this codebase.** ADR 0016 deferred
 * Konva to exactly this stage: a handful of draggable polygon corners
 * (`PlotOutlineEditor.tsx`) didn't need a retained-canvas scene, but "dozens
 * of plant markers, placed, dragged, layered, redrawn on every density
 * recalculation" (that ADR's own description of this stage's job) does. See
 * `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` for the fuller reasoning,
 * including why this component is not component-tested the way
 * `PlotOutlineEditor.test.tsx` is (a Konva `<Stage>` renders to `<canvas>`,
 * which jsdom can't query — the pure logic this component leans on
 * (`geometry.ts`, `drop.ts`, `feedback.ts`, `state/placements-store.ts`) is
 * tested instead, and this component itself is covered by the Playwright
 * E2E journey per the ADR).
 *
 * **Where dnd-kit's job ends and Konva's begins:** this component is the
 * *drop target* (`useDroppable`, matched against `drop.ts`'s
 * `CANVAS_DROPPABLE_ID` — the palette's `useDraggable` entries are the drag
 * source, wired up in `PlotDefinitionPage.tsx`). Once a plant is on the
 * canvas, dnd-kit is out of the picture entirely: Konva's own `draggable`
 * prop and `onDragEnd` handle moving a placed plant, because that is a
 * continuous in-scene coordinate update, not another drop-zone handoff.
 *
 * **Coordinate conversion** reuses `PlotOutlineEditor`'s fixed-scale trick
 * (ADR 0016) via `geometry.ts`'s `cmToPx`/`pxToCm`, with its own scale and
 * padding rather than PlotOutlineEditor's — plant markers need to stay
 * legible at a size a handful of corner handles never had to justify.
 *
 * **Warning badges (Workplan Stage 3.5).** A small severity-coloured circle
 * at a marker's top-right corner, present only for a placement `evaluate-
 * canvas.ts` flagged. This component does no warning logic itself — it only
 * looks up `severityByPlacementId` (computed by `warnings/evaluate-canvas.ts`
 * and threaded down from `PlotDefinitionPage.tsx` via `PlotCanvasSection.tsx`)
 * and asks `warnings/severity.ts` for that severity's colour, keeping this
 * file's own job exactly what it was before — a thin, untested render of
 * already-computed data (see `docs/adr/0017` for why `PlotCanvas.tsx` has no
 * dedicated component test, and `docs/adr/0018` for the warnings-derivation
 * decision behind the map this reads).
 *
 * **Stage ref (Workplan Stage 3.7).** The optional `stageRef` prop is forwarded
 * straight onto react-konva's `<Stage>`, so `PlotCanvasSection.tsx` can hand
 * the mounted Konva `Stage` instance to `canvas/export.ts`'s `exportPlotImage`
 * for rasterisation. This component still does nothing export-related itself —
 * it only exposes the ref.
 */

import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type Konva from 'konva';
import { useDroppable } from '@dnd-kit/core';
import { Circle, Group, Image, Layer, Line, Stage, Text } from 'react-konva';
import type { EdibleCategory, PlotRegion, WarningSeverity } from '@garden-planner/engine';
import { resolveIcon } from '../icons/index.ts';
import { useIconImage } from '../icons/useIconImage.ts';
import { usePlacementsStore, type PlacedPlant } from '../state/placements-store.ts';
import { severityColor, severityGlyph } from '../warnings/severity.ts';
import { CANVAS_DROPPABLE_ID } from './drop.ts';
import { canvasSizePx, clampToBounds, cmToPx, pxToCm } from './geometry.ts';
import styles from './PlotCanvas.module.css';

/** How far one arrow-key press nudges the selected placement, in plot centimetres — the keyboard-operable alternative to Konva's pointer-only `draggable` (Workplan Stage 6.2, ADR 0026). */
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

/** Radius of a placed-plant marker, in canvas pixels. */
const MARKER_RADIUS_PX = 16;

/** Radius of a warning badge, in canvas pixels — small enough to read as a corner accent, not a second marker. */
const BADGE_RADIUS_PX = 7;

/** No warnings for anyone — the default so callers that haven't computed warnings yet (or whose conditions don't currently resolve) can pass nothing rather than build an empty map themselves. */
const NO_SEVERITIES: ReadonlyMap<string, WarningSeverity> = new Map();

/**
 * A colour per edible category, rendered as the background circle behind each
 * icon (Stage 4.2). Provides immediate, at-a-glance category indication even
 * while the icon image is loading. Not a suitability cue — unrelated to the
 * palette's band colours.
 *
 * **Held here as literal strings, and mirrored in CSS (UI redesign Phase 0).**
 * Konva paints a `<canvas>`, so it cannot read a CSS custom property — this
 * map has to be TypeScript. The DOM side of the same idea (a category chip in
 * the palette, a legend) reads `--category-*` from `styles/tokens.css`
 * instead, so the values exist twice; `styles/tokens.test.ts` imports this map
 * and fails if the two copies ever disagree. Exported for that test.
 */
export const CATEGORY_COLORS: Readonly<Record<EdibleCategory, string>> = {
  vegetable: '#4c8c2b',
  herb: '#00796b',
  fruit: '#c0392b',
};

export interface PlotCanvasProps {
  /** The outline to draw and place plants within — `usePlotStore`'s current `region`. */
  readonly region: PlotRegion;
  /** Worst severity per placement id (`warnings/evaluate-canvas.ts`'s `CanvasWarnings.severityByPlacementId`), for the badge each marker shows. Defaults to no warnings for anyone. */
  readonly severityByPlacementId?: ReadonlyMap<string, WarningSeverity>;
  /** Forwarded onto the underlying Konva `Stage` (Workplan Stage 3.7) so `PlotCanvasSection` can rasterise it for export (`canvas/export.ts`) without this component knowing anything about exporting. */
  readonly stageRef?: RefObject<Konva.Stage | null>;
}

/**
 * A placed-plant marker: a colored background circle with an icon rendered on
 * top (once loaded), plus a warning badge if present. The icon is loaded async,
 * so the background renders immediately for instant visual feedback.
 */
interface PlacementMarkerProps {
  readonly placement: PlacedPlant;
  readonly px: { x: number; y: number };
  readonly isSelected: boolean;
  readonly severityByPlacementId: ReadonlyMap<string, WarningSeverity>;
  readonly onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  readonly onSelect: () => void;
  readonly onRemove: () => void;
}

function PlacementMarker({
  placement,
  px,
  isSelected,
  severityByPlacementId,
  onDragEnd,
  onSelect,
  onRemove,
}: PlacementMarkerProps) {
  const icon = resolveIcon(placement.plant);
  const iconImage = useIconImage(icon.url);

  return (
    <Group
      x={px.x}
      y={px.y}
      draggable
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onRemove}
      onDblTap={onRemove}
    >
      {/* Background circle, always visible for immediate category feedback */}
      <Circle
        radius={MARKER_RADIUS_PX}
        fill={CATEGORY_COLORS[placement.plant.category]}
        stroke={isSelected ? '#111827' : '#ffffff'}
        strokeWidth={isSelected ? 3 : 1.5}
      />
      {/* Icon image, rendered once loaded */}
      {iconImage && (
        <Image
          image={iconImage}
          x={-MARKER_RADIUS_PX}
          y={-MARKER_RADIUS_PX}
          width={MARKER_RADIUS_PX * 2}
          height={MARKER_RADIUS_PX * 2}
          listening={false}
        />
      )}
      {/* Warning badge, if present */}
      {(() => {
        const severity = severityByPlacementId.get(placement.id);
        if (severity === undefined) return null;
        const badgeOffset = MARKER_RADIUS_PX * 0.75;
        return (
          <Group x={badgeOffset} y={-badgeOffset} listening={false}>
            <Circle
              radius={BADGE_RADIUS_PX}
              fill={severityColor(severity)}
              stroke="#ffffff"
              strokeWidth={1}
            />
            <Text
              text={severityGlyph(severity)}
              fontStyle="bold"
              fontSize={10}
              fill="#ffffff"
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

export function PlotCanvas({
  region,
  severityByPlacementId = NO_SEVERITIES,
  stageRef,
}: PlotCanvasProps) {
  const placements = usePlacementsStore((state) => state.placements);
  const selectedId = usePlacementsStore((state) => state.selectedId);
  const movePlacement = usePlacementsStore((state) => state.movePlacement);
  const removePlacement = usePlacementsStore((state) => state.removePlacement);
  const selectPlacement = usePlacementsStore((state) => state.selectPlacement);

  // Registers this element as the drop target `drop.ts`'s `resolveDrop` looks
  // for — the palette→canvas handoff half of this stage's drag-and-drop.
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const size = canvasSizePx(region);
  const outlinePoints = region.vertices.flatMap((vertex) => {
    const px = cmToPx(vertex, region);
    return [px.x, px.y];
  });

  /** Clicking (or tapping) empty canvas — as opposed to a plant marker — deselects. */
  function handleStageBackgroundPress(event: Konva.KonvaEventObject<Event>): void {
    if (event.target === event.target.getStage()) {
      selectPlacement(null);
    }
  }

  /** A placed plant's own drag (moving it within the plot) — Konva's job, not dnd-kit's; see the module doc. */
  function handlePlantDragEnd(placementId: string, event: Konva.KonvaEventObject<DragEvent>): void {
    const node = event.target;
    movePlacement(placementId, pxToCm({ x: node.x(), y: node.y() }, region));
  }

  /**
   * Delete/Backspace removes the selected plant (the keyboard-accessible
   * half of "remove"; the toolbar button in `PlotCanvasSection.tsx` is the
   * pointer half), and the arrow keys nudge it — Workplan Stage 6.2's
   * keyboard-operable alternative to Konva's pointer-only `draggable` on
   * `PlacementMarker` above. Both need a selection first; `PlotCanvasSection`
   * gives keyboard users two ways to get one (the "Previous/next placement"
   * buttons, or clicking a marker), since Konva shapes aren't independently
   * focusable/tabbable the way DOM elements are.
   */
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (selectedId === null) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removePlacement(selectedId);
      return;
    }
    const direction = NUDGE_DIRECTIONS[event.key];
    if (direction === undefined) {
      return;
    }
    event.preventDefault();
    const current = placements.find((placement) => placement.id === selectedId);
    if (current === undefined) {
      return;
    }
    const step = event.shiftKey ? NUDGE_STEP_CM_FAST : NUDGE_STEP_CM;
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
      aria-label="plot canvas — drag plants here to place them, or select one and use the arrow keys (hold Shift to move further) to nudge it; click a placed plant to select it"
      className={styles.stage}
      data-drop-target={isOver}
      // Size stays inline: it's computed from the plot's own dimensions and
      // changes whenever the outline does (`geometry.ts#canvasSizePx`).
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
          <Line
            points={outlinePoints}
            closed
            fill="rgba(76, 175, 80, 0.15)"
            stroke="#2e7d32"
            strokeWidth={2}
          />
          {placements.map((placement) => {
            const px = cmToPx(placement, region);
            const isSelected = placement.id === selectedId;
            return (
              <PlacementMarker
                key={placement.id}
                placement={placement}
                px={px}
                isSelected={isSelected}
                severityByPlacementId={severityByPlacementId}
                onDragEnd={(event) => handlePlantDragEnd(placement.id, event)}
                onSelect={() => selectPlacement(placement.id)}
                onRemove={() => removePlacement(placement.id)}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
