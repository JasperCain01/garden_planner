import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rectangleRegion } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { resetHistory } from '../state/design-history.ts';
import { restoreDesigns, useDesignsStore } from '../state/designs-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { DesignChrome } from './DesignChrome.tsx';

/**
 * The header's design controls (UI redesign Phase 5).
 *
 * Rendered through a router, because two of this component's decisions are
 * about routing: it draws nothing on `NotFound` (which shares the shell), and
 * the shortcut hook binds regardless. The rest is about **names** — an Undo
 * button that says what it will undo is what replaced the "Clear all"
 * confirmation dialog, so the label is the feature and not a nicety.
 */

const ONION = SHIPPED_PLANTS.find((plant) => plant.id === 'onion');
if (ONION === undefined) throw new Error('the shipped dataset has no onion to test with');

function renderChrome(path = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <DesignChrome /> },
      { path: '*', element: <DesignChrome /> },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe('DesignChrome', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
    usePlacementsStore.setState({ placements: [], selectedId: null });
    restoreDesigns();
    resetHistory();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows undo and redo disabled until there is something to undo', () => {
    renderChrome();

    expect(
      screen.getByRole('button', { name: /undo \(nothing to undo\)/i }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: /redo \(nothing to redo\)/i }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('names the edit it will undo, which is the affordance that replaced the clear-all dialog', () => {
    renderChrome();
    act(() => {
      usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    });

    const undo = screen.getByRole('button', { name: 'Undo planting Onion' });
    fireEvent.click(undo);

    expect(usePlacementsStore.getState().placements).toEqual([]);
    expect(screen.getByRole('button', { name: 'Redo planting Onion' })).toBeTruthy();
  });

  it('names the open design on the switcher button, in full', () => {
    renderChrome();
    const button = screen.getByRole('button', { name: /designs:/i });

    expect(button.textContent).toContain('My garden');
  });

  it('opens the switcher, which lists the designs and can start a new one', () => {
    renderChrome();
    fireEvent.click(screen.getByRole('button', { name: /designs:/i }));

    expect(screen.getByRole('heading', { name: /your designs/i })).toBeTruthy();
    // The row says which design is open, and the rename field holds its name —
    // hence the list-scoped query rather than a page-wide one.
    expect(screen.getByRole('listitem').textContent).toContain('My garden — open');

    fireEvent.click(screen.getByRole('button', { name: /new design/i }));
    expect(useDesignsStore.getState().designs).toHaveLength(2);
  });

  it('confirms before deleting a design, because that is the part undo cannot reach', () => {
    renderChrome();
    act(() => {
      useDesignsStore.getState().newDesign();
    });
    fireEvent.click(screen.getByRole('button', { name: /designs:/i }));

    fireEvent.click(screen.getByRole('button', { name: /delete my garden/i }));
    expect(useDesignsStore.getState().designs).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(useDesignsStore.getState().designs).toHaveLength(1);
  });

  it('draws nothing on a route with no design open', () => {
    renderChrome('/somewhere-that-does-not-exist');

    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /designs:/i })).toBeNull();
  });
});
