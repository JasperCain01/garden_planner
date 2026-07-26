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
import { severityColor } from '../warnings/severity.ts';
import { CANVAS_DROPPABLE_ID } from './drop.ts';
import { canvasSizePx, cmToPx, pxToCm } from './geometry.ts';

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
 */
const CATEGORY_COLORS: Readonly<Record<EdibleCategory, string>> = {
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
              text="!"
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

  /** Delete/Backspace removes the selected plant — the keyboard-accessible half of "remove"; the toolbar button (`PlotCanvasSection.tsx`) is the pointer half. */
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId !== null) {
      event.preventDefault();
      removePlacement(selectedId);
    }
  }

  return (
    <div
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="plot canvas — drag plants here to place them; click a placed plant to select it"
      style={{
        width: size.width,
        height: size.height,
        border: isOver ? '2px dashed #2e7d32' : '1px solid #ccc',
        outline: 'none',
      }}
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
