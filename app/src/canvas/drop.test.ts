import { describe, expect, it } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import { CANVAS_PADDING_CM } from './geometry.ts';
import { CANVAS_DROPPABLE_ID, resolveDrop } from './drop.ts';

const REGION: PlotRegion = rectangleRegion(300, 200);

/**
 * The scale these conversions are checked at.
 *
 * UI redesign Phase 2 made `resolveDrop`'s scale a required argument rather
 * than a constant it defaulted to — the canvas is fitted to its viewport now,
 * so there is no one right number, and a drop converted at a scale the stage
 * isn't drawn at lands the plant somewhere the user didn't put it. A
 * deliberately un-round value: at `1` a wrong-scale bug would be invisible
 * because dividing by it changes nothing.
 */
const PX_PER_CM = 0.6;

const ONION: Plant = validatePlant({
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  gbifId: null,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
  provenance: { sources: [{ source: 'hand-written test fixture' }] },
});

/** Build a minimal, structurally-valid `DragEndEvent` — only the fields `resolveDrop` reads. */
function dragEndEvent(overrides: {
  overId?: string | null;
  noData?: boolean;
  translated?: { left: number; top: number; width: number; height: number } | null;
  overRect?: { left: number; top: number };
  /** A pointer/touch drag's starting client point. Omitted means a keyboard drag — an activator with no client point at all. */
  activatorAt?: { x: number; y: number };
  /** dnd-kit's own "how far the pointer moved" for the drag. */
  delta?: { x: number; y: number };
}): DragEndEvent {
  const overId = overrides.overId === undefined ? CANVAS_DROPPABLE_ID : overrides.overId;
  const overRect = overrides.overRect ?? { left: 0, top: 0 };
  const translated =
    overrides.translated === undefined
      ? { left: 100, top: 100, width: 40, height: 40 }
      : overrides.translated;

  // A bare `Event` has no `clientX`/`clientY`, which is exactly the shape a
  // `KeyboardEvent` activator presents to `resolveDrop` — so the default here
  // is the keyboard path, and `activatorAt` opts a case into the pointer one.
  const activatorEvent =
    overrides.activatorAt === undefined
      ? new Event('keydown')
      : Object.assign(new Event('pointerdown'), {
          clientX: overrides.activatorAt.x,
          clientY: overrides.activatorAt.y,
        });

  return {
    activatorEvent,
    collisions: null,
    delta: overrides.delta ?? { x: 0, y: 0 },
    active: {
      id: 'onion',
      data: { current: overrides.noData === true ? undefined : { plant: ONION } },
      rect: { current: { initial: null, translated } },
    },
    over:
      overId === null
        ? null
        : {
            id: overId,
            disabled: false,
            data: { current: undefined },
            rect: {
              width: 999,
              height: 999,
              top: overRect.top,
              left: overRect.left,
              right: 0,
              bottom: 0,
            },
          },
  } as unknown as DragEndEvent;
}

describe('resolveDrop', () => {
  it('resolves to null when the drag did not end over the canvas', () => {
    expect(resolveDrop(dragEndEvent({ overId: null }), REGION, PX_PER_CM, null)).toBeNull();
  });

  it('resolves to null when the drag ended over a different droppable', () => {
    expect(
      resolveDrop(dragEndEvent({ overId: 'some-other-drop-zone' }), REGION, PX_PER_CM, null),
    ).toBeNull();
  });

  it('resolves to null when the dragged element carries no palette data', () => {
    expect(resolveDrop(dragEndEvent({ noData: true }), REGION, PX_PER_CM, null)).toBeNull();
  });

  it('resolves to null when a keyboard drag ended before dnd-kit measured the dragged element', () => {
    expect(resolveDrop(dragEndEvent({ translated: null }), REGION, PX_PER_CM, null)).toBeNull();
  });

  /**
   * UI redesign Phase 2: a pointer drag lands where the *pointer* is, not
   * where the dragged card's centre ended up.
   *
   * The card is translated by the pointer's delta, so its centre keeps
   * whatever offset it had from the grab point — and a palette row is ~320px
   * wide. That offset used to be flattened by the clamp, because at the old
   * fixed 0.6 px/cm it converted to a distance wider than the whole plot; at
   * the fitted scale it is a real number of centimetres in the wrong
   * direction. See `resolveDrop`'s doc comment for why the pointer is passed
   * in rather than recovered from the event's own `delta`.
   */
  describe('a pointer drag', () => {
    it('lands under the pointer, not under the dragged card', () => {
      const event = dragEndEvent({
        activatorAt: { x: 20, y: 20 },
        // Deliberately somewhere else entirely — if this rect were still what
        // decided the drop, the assertion below would come out elsewhere.
        translated: { left: 300, top: 300, width: 40, height: 40 },
      });

      const drop = resolveDrop(event, REGION, PX_PER_CM, { x: 120, y: 120 });

      // Droppable origin is (0, 0), so the local px point is (120, 120).
      const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
      expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
      expect(drop?.position.y).toBeCloseTo(expectedCm, 9);
    });

    it('treats a touch drag as a pointer drag', () => {
      const activatorEvent = Object.assign(new Event('touchstart'), {
        touches: [{ clientX: 20, clientY: 20 }],
      });
      const touchEvent = {
        ...dragEndEvent({ translated: { left: 300, top: 300, width: 40, height: 40 } }),
        activatorEvent,
      } as unknown as DragEndEvent;

      const drop = resolveDrop(touchEvent, REGION, PX_PER_CM, { x: 120, y: 120 });

      const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
      expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
    });

    it('falls back to the card centre if no pointer position was ever observed', () => {
      const event = dragEndEvent({
        activatorAt: { x: 20, y: 20 },
        translated: { left: 100, top: 100, width: 40, height: 40 },
      });

      const drop = resolveDrop(event, REGION, PX_PER_CM, null);

      const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
      expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
    });
  });

  it('ignores a stale pointer position for a keyboard drag, which never had one', () => {
    // The pointer position is tracked continuously (`useCanvasDropHandler`), so
    // by the time someone drags with the keyboard there is almost always a
    // leftover one from earlier mouse movement. Which path applies is decided
    // by the activator event's shape, not by whether a point is available.
    const event = dragEndEvent({ translated: { left: 100, top: 100, width: 40, height: 40 } });

    const drop = resolveDrop(event, REGION, PX_PER_CM, { x: 9_000, y: 9_000 });

    const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
    expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
  });

  it('falls back to the dragged card centre for a keyboard drag, which has no pointer at all', () => {
    // Card centre at (120, 120) in viewport px; droppable's own top-left at (0, 0);
    // so the local px point is (120, 120) too.
    const event = dragEndEvent({ translated: { left: 100, top: 100, width: 40, height: 40 } });

    const drop = resolveDrop(event, REGION, PX_PER_CM, null);

    expect(drop?.plant.id).toBe('onion');
    // cmToPx's inverse: (px / PX_PER_CM) + bounds.min - padding. Region's bounds
    // start at (0, 0), so cm = 120 / PX_PER_CM - CANVAS_PADDING_CM.
    const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
    expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
    expect(drop?.position.y).toBeCloseTo(expectedCm, 9);
  });

  it('accounts for the droppable rect not starting at the viewport origin', () => {
    const event = dragEndEvent({
      translated: { left: 300, top: 300, width: 40, height: 40 },
      overRect: { left: 200, top: 200 },
    });

    const drop = resolveDrop(event, REGION, PX_PER_CM, null);

    // Card centre (320, 320) minus droppable origin (200, 200) = local (120, 120) — same as above.
    const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
    expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
    expect(drop?.position.y).toBeCloseTo(expectedCm, 9);
  });

  it('clamps a drop far outside the canvas to the region bounding box', () => {
    const event = dragEndEvent({
      translated: { left: -100_000, top: -100_000, width: 40, height: 40 },
    });

    const drop = resolveDrop(event, REGION, PX_PER_CM, null);

    expect(drop?.position).toEqual({ x: 0, y: 0 });
  });
});
