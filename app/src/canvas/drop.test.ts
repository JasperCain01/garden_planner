import { describe, expect, it } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import { CANVAS_PADDING_CM, PX_PER_CM } from './geometry.ts';
import { CANVAS_DROPPABLE_ID, resolveDrop } from './drop.ts';

const REGION: PlotRegion = rectangleRegion(300, 200);

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
}): DragEndEvent {
  const overId = overrides.overId === undefined ? CANVAS_DROPPABLE_ID : overrides.overId;
  const overRect = overrides.overRect ?? { left: 0, top: 0 };
  const translated =
    overrides.translated === undefined
      ? { left: 100, top: 100, width: 40, height: 40 }
      : overrides.translated;

  return {
    activatorEvent: new Event('pointerdown'),
    collisions: null,
    delta: { x: 0, y: 0 },
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
    expect(resolveDrop(dragEndEvent({ overId: null }), REGION)).toBeNull();
  });

  it('resolves to null when the drag ended over a different droppable', () => {
    expect(resolveDrop(dragEndEvent({ overId: 'some-other-drop-zone' }), REGION)).toBeNull();
  });

  it('resolves to null when the dragged element carries no palette data', () => {
    expect(resolveDrop(dragEndEvent({ noData: true }), REGION)).toBeNull();
  });

  it('resolves to null when dnd-kit never measured the dragged element', () => {
    expect(resolveDrop(dragEndEvent({ translated: null }), REGION)).toBeNull();
  });

  it('converts the dragged card centre, relative to the droppable, into plot centimetres', () => {
    // Card centre at (120, 120) in viewport px; droppable's own top-left at (0, 0);
    // so the local px point is (120, 120) too.
    const event = dragEndEvent({ translated: { left: 100, top: 100, width: 40, height: 40 } });

    const drop = resolveDrop(event, REGION);

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

    const drop = resolveDrop(event, REGION);

    // Card centre (320, 320) minus droppable origin (200, 200) = local (120, 120) — same as above.
    const expectedCm = 120 / PX_PER_CM - CANVAS_PADDING_CM;
    expect(drop?.position.x).toBeCloseTo(expectedCm, 9);
    expect(drop?.position.y).toBeCloseTo(expectedCm, 9);
  });

  it('clamps a drop far outside the canvas to the region bounding box', () => {
    const event = dragEndEvent({
      translated: { left: -100_000, top: -100_000, width: 40, height: 40 },
    });

    const drop = resolveDrop(event, REGION);

    expect(drop?.position).toEqual({ x: 0, y: 0 });
  });
});
