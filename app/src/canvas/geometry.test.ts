import { describe, expect, it } from 'vitest';
import { rectangleRegion, type PlotRegion } from '@garden-planner/engine';
import {
  CANVAS_PADDING_CM,
  canvasSizePx,
  clampToBounds,
  cmToPx,
  pxToCm,
  regionBounds,
} from './geometry.ts';

// A 300 x 200 cm rectangle at the origin: vertices (0,0) (300,0) (300,200) (0,200).
const REGION: PlotRegion = rectangleRegion(300, 200);

describe('regionBounds', () => {
  it('reads the axis-aligned bounds off a rectangle region', () => {
    expect(regionBounds(REGION)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 300,
      maxY: 200,
      width: 300,
      height: 200,
    });
  });

  it('handles a region translated away from the origin', () => {
    const shifted: PlotRegion = {
      vertices: REGION.vertices.map((v) => ({ x: v.x + 500, y: v.y - 100 })),
    };
    expect(regionBounds(shifted)).toEqual({
      minX: 500,
      minY: -100,
      maxX: 800,
      maxY: 100,
      width: 300,
      height: 200,
    });
  });
});

describe('canvasSizePx', () => {
  it('scales the padded bounding box by the given px-per-cm ratio', () => {
    const size = canvasSizePx(REGION, 2);
    expect(size).toEqual({
      width: (300 + CANVAS_PADDING_CM * 2) * 2,
      height: (200 + CANVAS_PADDING_CM * 2) * 2,
    });
  });
});

describe('cmToPx / pxToCm', () => {
  it('round-trips a centimetre point through pixels and back', () => {
    const original = { x: 123.4, y: 56.7 };
    const px = cmToPx(original, REGION, 2);
    const back = pxToCm(px, REGION, 2);
    expect(back.x).toBeCloseTo(original.x, 9);
    expect(back.y).toBeCloseTo(original.y, 9);
  });

  it('places the region origin at (padding * pxPerCm, padding * pxPerCm)', () => {
    const px = cmToPx({ x: 0, y: 0 }, REGION, 3);
    expect(px).toEqual({ x: CANVAS_PADDING_CM * 3, y: CANVAS_PADDING_CM * 3 });
  });

  it('places a pixel point at the canvas origin back at the padded-out corner', () => {
    const cm = pxToCm({ x: 0, y: 0 }, REGION, 3);
    expect(cm).toEqual({ x: -CANVAS_PADDING_CM, y: -CANVAS_PADDING_CM });
  });
});

describe('clampToBounds', () => {
  it('leaves a point already inside the bounding box untouched', () => {
    expect(clampToBounds({ x: 150, y: 100 }, REGION)).toEqual({ x: 150, y: 100 });
  });

  it('clamps a point outside the bounding box to its nearest edge', () => {
    expect(clampToBounds({ x: -50, y: 5000 }, REGION)).toEqual({ x: 0, y: 200 });
  });
});
