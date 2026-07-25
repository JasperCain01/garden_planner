import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { rectangleRegion, validatePlotRegion, type PlotRegion } from '@garden-planner/engine';
import { PlotOutlineEditor, PX_PER_CM } from './PlotOutlineEditor.tsx';

/**
 * jsdom has no global `PointerEvent`, so `@testing-library`'s
 * `fireEvent.pointerMove` shorthand (which asks for one) silently falls back
 * to a plain `Event` that drops `clientX`/`clientY` entirely. Dispatching a
 * real `MouseEvent` under the `pointer*` type name sidesteps that — listeners
 * match on `event.type`, not the constructor, and `MouseEvent` is the one
 * jsdom event class that does carry `clientX`/`clientY` through faithfully.
 * Wrapped in `act` because the editor's drag listeners are attached by a
 * `useEffect` (not by the synthetic React prop the pointerdown itself uses),
 * so the next dispatched event needs that effect flushed first — the
 * dispatch happening outside `@testing-library`'s own `fireEvent` wrapper
 * means nothing else guarantees that ordering.
 */
function firePointerEvent(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
): void {
  act(() => {
    target.dispatchEvent(
      new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true }),
    );
  });
}

/** Drag a corner handle by `(dxCm, dyCm)`, in one pointerdown/move/up sequence. */
function dragCorner(testId: string, dxCm: number, dyCm: number): void {
  firePointerEvent(screen.getByTestId(testId), 'pointerdown', 0, 0);
  firePointerEvent(window, 'pointermove', dxCm * PX_PER_CM, dyCm * PX_PER_CM);
  firePointerEvent(window, 'pointerup', dxCm * PX_PER_CM, dyCm * PX_PER_CM);
}

describe('PlotOutlineEditor', () => {
  it('renders one corner handle per vertex', () => {
    render(<PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={() => {}} />);
    expect(screen.getByTestId('plot-corner-0')).toBeTruthy();
    expect(screen.getByTestId('plot-corner-3')).toBeTruthy();
    expect(screen.queryByTestId('plot-corner-4')).toBeNull();
  });

  it('commits a valid drag, calling onChange with a region the engine accepts', () => {
    const handleChange = vi.fn();
    render(<PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={handleChange} />);

    dragCorner('plot-corner-1', 20, 0);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const next = handleChange.mock.calls[0][0] as PlotRegion;
    expect(() => validatePlotRegion(next)).not.toThrow();
    expect(next.vertices[1]).toEqual({ x: 120, y: 0 });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects a drag that folds the outline into a self-intersecting bowtie, showing a message and never calling onChange', () => {
    const handleChange = vi.fn();
    // A 100x100 square: (0,0) (100,0) (100,100) (0,100). Swapping corners 1
    // and 2 (via two drags) lands on exactly the bowtie
    // `packages/engine/src/spacing/region.test.ts` itself rejects.
    render(<PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={handleChange} />);

    dragCorner('plot-corner-1', 0, 100); // (100,0) -> (100,100), now coincides with corner 2
    dragCorner('plot-corner-2', 0, -100); // (100,100) -> (100,0)

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/crosses itself/i);
  });

  it('adds a corner at an edge midpoint on click', () => {
    const handleChange = vi.fn();
    render(<PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={handleChange} />);

    fireEvent.click(screen.getByTestId('plot-corner-add-0'));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const next = handleChange.mock.calls[0][0] as PlotRegion;
    expect(next.vertices).toHaveLength(5);
    expect(next.vertices[1]).toEqual({ x: 50, y: 0 });
  });

  it('removes a corner on double-click, staying valid down to a triangle', () => {
    const handleChange = vi.fn();
    render(<PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={handleChange} />);

    fireEvent.doubleClick(screen.getByTestId('plot-corner-0'));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const next = handleChange.mock.calls[0][0] as PlotRegion;
    expect(next.vertices).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a message instead of silently accepting fewer than three corners', () => {
    render(<PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={() => {}} />);

    fireEvent.doubleClick(screen.getByTestId('plot-corner-0')); // 4 -> 3, still valid
    fireEvent.doubleClick(screen.getByTestId('plot-corner-0')); // 3 -> 2, invalid

    expect(screen.getByRole('alert').textContent).toMatch(/at least 3 corners/i);
  });

  it('resets the draft outline when a new region prop arrives (e.g. a preset applied elsewhere)', () => {
    const { rerender } = render(
      <PlotOutlineEditor region={rectangleRegion(100, 100)} onChange={() => {}} />,
    );
    expect(screen.queryByTestId('plot-corner-4')).toBeNull();

    rerender(<PlotOutlineEditor region={rectangleRegion(200, 50)} onChange={() => {}} />);

    expect(screen.getByTestId('plot-corner-3')).toBeTruthy();
    expect(screen.queryByTestId('plot-corner-4')).toBeNull();
  });
});
