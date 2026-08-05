import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rectangleRegion, validatePlant, type Plant } from '@garden-planner/engine';
import { useCanvasViewStore } from '../state/canvas-view-store.ts';
import { resetHistory, useDesignHistory } from '../state/design-history.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { exportPlotImage } from './export.ts';
import { FALLBACK_PX_PER_CM } from './geometry.ts';
import { PlotCanvasSection } from './PlotCanvasSection.tsx';

// The Konva scene itself is untested here (ADR 0017) — this only verifies the
// Export button wires up to `export.ts`'s pipeline. Its own logic (the legend
// builder) is covered directly in `export.test.ts`; the full rasterise-and-
// download flow needs a real browser and is covered by the E2E export spec.
vi.mock('./export.ts', () => ({
  exportPlotImage: vi.fn().mockResolvedValue(undefined),
}));

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

describe('PlotCanvasSection export button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
    usePlacementsStore.setState({ placements: [], selectedId: null });
    // The canvas-view store is a singleton too (UI redesign Phase 2), and it
    // carries the zoom and the edit-shape mode across tests if not reset.
    useCanvasViewStore.setState({
      viewportPx: { width: 0, height: 0 },
      zoomFactor: 1,
      editingOutline: false,
      selectedCornerIndex: null,
      outlineError: null,
      draftVertices: null,
    });
    // The design history subscribes to both design stores at module load (UI
    // redesign Phase 5), so the `setState` calls above leave steps on its stack
    // — which is exactly what the two tests that assert on `undoLabel` would
    // otherwise be reading.
    resetHistory();
  });

  it('renders an export button', () => {
    render(<PlotCanvasSection canvasWarnings={null} />);

    expect(screen.getByRole('button', { name: /export image/i })).toBeTruthy();
  });

  it("clicking it triggers export.ts's pipeline with the current placements and resolved conditions", async () => {
    usePlacementsStore.setState({
      placements: [{ id: 'placement-1', plant: ONION, x: 10, y: 10 }],
      selectedId: null,
    });

    render(<PlotCanvasSection canvasWarnings={null} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export image/i }));
    });

    expect(exportPlotImage).toHaveBeenCalledTimes(1);
    const [, placements, conditions, pxPerCm] = vi.mocked(exportPlotImage).mock.calls[0];
    expect(placements).toEqual([{ id: 'placement-1', plant: ONION, x: 10, y: 10 }]);
    expect(conditions?.light).toBe('full-sun');
    // The live scale goes with it (UI redesign Phase 2): without it the export
    // would rasterise at whatever the window happened to make the stage, so
    // the same plot would come out a different size every time. jsdom has no
    // layout, so this is the unmeasured fallback.
    expect(pxPerCm).toBe(FALLBACK_PX_PER_CM);
  });

  it('selects placements in order with the Previous/Next placement buttons, wrapping around (Workplan Stage 6.2)', () => {
    const OTHER: Plant = validatePlant({
      id: 'lettuce',
      commonName: 'Lettuce',
      scientificName: 'Lactuca sativa',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
      provenance: { sources: [{ source: 'hand-written test fixture' }] },
    });
    usePlacementsStore.setState({
      placements: [
        { id: 'placement-1', plant: ONION, x: 10, y: 10 },
        { id: 'placement-2', plant: OTHER, x: 20, y: 20 },
      ],
      selectedId: null,
    });

    render(<PlotCanvasSection canvasWarnings={null} />);

    // Nothing selected yet: "Next" starts at the first placement.
    fireEvent.click(screen.getByRole('button', { name: /next placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-1');

    fireEvent.click(screen.getByRole('button', { name: /next placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-2');

    // Wraps back around to the first.
    fireEvent.click(screen.getByRole('button', { name: /next placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-1');

    // Previous wraps the other way.
    fireEvent.click(screen.getByRole('button', { name: /previous placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-2');
  });

  it('does not render the Previous/Next placement buttons when nothing is placed', () => {
    render(<PlotCanvasSection canvasWarnings={null} />);
    expect(screen.queryByRole('button', { name: /next placement/i })).toBeNull();
  });

  /**
   * UI redesign Phase 2's toolbar. Every one of these is a real `<button>`
   * rather than a pointer gesture, which is what makes zoom, edit-shape and
   * clear-all keyboard-operable at all (ADR 0026 makes that contractual) —
   * so asserting they exist and act is asserting the keyboard path exists.
   */
  describe('canvas toolbar (UI redesign Phase 2)', () => {
    it('zooms in and out, and reports the current zoom back', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);

      expect(screen.getByText('100%')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
      expect(useCanvasViewStore.getState().zoomFactor).toBeGreaterThan(1);
      expect(screen.getByText('125%')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
      expect(screen.getByText('100%')).toBeTruthy();
    });

    it('returns to a fitted plot with the Fit button', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);

      fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
      fireEvent.click(screen.getByRole('button', { name: /fit the plot to the screen/i }));

      expect(useCanvasViewStore.getState().zoomFactor).toBe(1);
      expect(screen.getByText('100%')).toBeTruthy();
    });

    it('toggles outline editing, and selects a corner so the arrow keys have something to act on', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);

      fireEvent.click(screen.getByRole('button', { name: /^edit shape$/i }));

      expect(useCanvasViewStore.getState().editingOutline).toBe(true);
      expect(useCanvasViewStore.getState().selectedCornerIndex).toBe(0);
      // The corner controls replace the placement ones, because that is what
      // the canvas's arrow keys are now aimed at.
      expect(screen.getByRole('button', { name: /next corner/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /next placement/i })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /done editing shape/i }));
      expect(useCanvasViewStore.getState().editingOutline).toBe(false);
    });

    it('adds and removes outline corners, keeping the region valid', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);
      fireEvent.click(screen.getByRole('button', { name: /^edit shape$/i }));

      fireEvent.click(screen.getByRole('button', { name: /^add corner$/i }));
      expect(usePlotStore.getState().region.vertices).toHaveLength(5);

      fireEvent.click(screen.getByRole('button', { name: /^remove corner$/i }));
      expect(usePlotStore.getState().region.vertices).toHaveLength(4);
    });

    it('refuses an outline edit that does not validate, and says why without committing it', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);
      fireEvent.click(screen.getByRole('button', { name: /^edit shape$/i }));

      // Down to three corners is fine; the fourth removal leaves two, which
      // `safeValidatePlotRegion` rejects.
      fireEvent.click(screen.getByRole('button', { name: /^remove corner$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^remove corner$/i }));

      expect(usePlotStore.getState().region.vertices).toHaveLength(3);
      expect(screen.getByRole('alert').textContent).toBeTruthy();
    });

    // UI redesign Phase 5 retired the confirmation this used to assert on. The
    // test is rewritten rather than deleted, because what it was really
    // guarding — that "Clear all" is not a click you can lose your plot to — is
    // still true and is now the history's job (ADR 0034 §5). It clears
    // immediately, *and* the way back exists and is named.
    it('clears the plot at once, and leaves a named undo behind it', () => {
      usePlacementsStore.setState({
        placements: [{ id: 'placement-1', plant: ONION, x: 10, y: 10 }],
        selectedId: null,
      });
      render(<PlotCanvasSection canvasWarnings={null} />);

      fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
      expect(usePlacementsStore.getState().placements).toEqual([]);
      expect(screen.queryByRole('button', { name: /keep them/i })).toBeNull();

      expect(useDesignHistory.getState().undoLabel).toBe('removing Onion');
      act(() => useDesignHistory.getState().undo());
      expect(usePlacementsStore.getState().placements).toHaveLength(1);
    });

    it('offers no Clear all at all when there is nothing to clear', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);
      expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
    });

    // The starter bed (UI redesign Phase 5). Offered on the toolbar rather than
    // in a first-run modal — see `designs/example-bed.ts` — so "when is it
    // offered" is a rendering question this test can ask directly.
    it('offers the example bed only while the plot is empty, and undoes as one step', () => {
      render(<PlotCanvasSection canvasWarnings={null} />);

      fireEvent.click(screen.getByRole('button', { name: /start with an example bed/i }));
      expect(usePlacementsStore.getState().placements.length).toBeGreaterThan(1);
      expect(screen.queryByRole('button', { name: /start with an example bed/i })).toBeNull();

      expect(useDesignHistory.getState().undoLabel).toBe('starting from the example bed');
      act(() => useDesignHistory.getState().undo());
      expect(usePlacementsStore.getState().placements).toEqual([]);
    });
  });

  it('reports conditions as null to the pipeline when they fail to resolve', async () => {
    // A soil block with every facet cleared fails `PlotSoilSchema`'s refine rule.
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun', soil: {} },
    });

    render(<PlotCanvasSection canvasWarnings={null} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export image/i }));
    });

    const [, , conditions] = vi.mocked(exportPlotImage).mock.calls[0];
    expect(conditions).toBeNull();
  });
});
