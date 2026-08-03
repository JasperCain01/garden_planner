import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { rectangleRegion, type UserPlantInput } from '@garden-planner/engine';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { useUserPlantsStore } from '../state/user-plants-store.ts';
import { PlantPalette } from './PlantPalette.tsx';

/**
 * Two synthetic, deterministic crops added to the session's user-crop overlay
 * for these tests, rather than relying on the shipped dataset's current
 * contents (which happens to have zero full-shade crops today, see
 * `docs/stage-3.3-brief.md`) — this keeps the "shady plot demotes full-sun
 * crops" case exact and independent of the dataset's own evolution.
 */
const SUN_LOVER: UserPlantInput = {
  commonName: 'Sun Lover',
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 10, betweenRowCm: 20 } },
};

const SHADE_DWELLER: UserPlantInput = {
  commonName: 'Shade Dweller',
  category: 'herb',
  light: 'full-shade',
  spacing: { row: { inRowCm: 10, betweenRowCm: 20 } },
};

function addBothFixtures(): void {
  act(() => {
    useUserPlantsStore.getState().addUserPlant(SUN_LOVER);
    useUserPlantsStore.getState().addUserPlant(SHADE_DWELLER);
  });
}

describe('PlantPalette', () => {
  beforeEach(() => {
    // Reset both singleton stores between tests (mirrors plot-store.test.ts /
    // user-plants-store.test.ts).
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
    useUserPlantsStore.setState({ userPlants: {} });
    usePlacementsStore.setState({ placements: [], selectedId: null });
  });

  it('places a plant on the plot and selects it when its "Add to plot" button is pressed, with no drag at all (Workplan Stage 6.2)', () => {
    addBothFixtures();
    render(<PlantPalette />);

    fireEvent.click(
      screen.getByRole('button', { name: /add sun lover to the plot, without dragging/i }),
    );

    const { placements, selectedId } = usePlacementsStore.getState();
    expect(placements).toHaveLength(1);
    expect(placements[0].plant.commonName).toBe('Sun Lover');
    // rectangleRegion(300, 200) has vertices (0,0) (300,0) (300,200) (0,200) —
    // centre (150, 100). The first crop onto an empty plot still lands there:
    // `firstFreePosition` searches outward *from* the centre, so with nothing
    // in the way the centre is the answer (`canvas/geometry.test.ts`).
    expect(placements[0].x).toBe(150);
    expect(placements[0].y).toBe(100);
    expect(selectedId).toBe(placements[0].id);
  });

  /**
   * The review's third finding, as a test: "adding three crops produces **one
   * visible marker** — three markers stacked in the same spot (verified live)
   * … you add plants and the plot appears to eat them."
   *
   * Asserted on the store rather than on pixels because that is where the bug
   * was — every press resolved to `regionCentre`, the same point every time.
   * The search's own arithmetic is pinned in `canvas/geometry.test.ts`; what
   * this covers is that the palette button actually calls it, with the
   * placements already down and with the crop's own footprint as the spacing.
   */
  it('scatters repeated "Add to plot" presses instead of stacking them all at the centre (UI redesign Phase 2)', () => {
    addBothFixtures();
    render(<PlantPalette />);

    const addSunLover = screen.getByRole('button', {
      name: /add sun lover to the plot, without dragging/i,
    });
    fireEvent.click(addSunLover);
    fireEvent.click(addSunLover);
    fireEvent.click(addSunLover);

    const { placements } = usePlacementsStore.getState();
    expect(placements).toHaveLength(3);
    const distinct = new Set(placements.map(({ x, y }) => `${x},${y}`));
    expect(distinct.size).toBe(3);
  });

  it('keeps the "Add to plot" button a sibling of the draggable card, not nested inside it (axe’s nested-interactive rule)', () => {
    addBothFixtures();
    render(<PlantPalette />);

    const button = screen.getByRole('button', { name: /add sun lover to the plot/i });
    const draggableCard = screen.getByLabelText(/drag sun lover onto the plot to place it/i);
    // The button must not be a descendant of the element wearing dnd-kit's
    // own `role="button"` — that's exactly the "control nested inside
    // another control" shape axe's nested-interactive check flags.
    expect(draggableCard.contains(button)).toBe(false);
  });

  it('demotes a full-sun crop below a shade-tolerant one once the plot turns shady', () => {
    addBothFixtures();
    act(() => {
      usePlotStore.getState().setConditionsInput({ light: 'full-shade' });
    });

    render(<PlantPalette />);

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent ?? '');
    const shadeIndex = headings.findIndex((text) => text.includes('Shade Dweller'));
    const sunIndex = headings.findIndex((text) => text.includes('Sun Lover'));

    expect(shadeIndex).toBeGreaterThanOrEqual(0);
    expect(sunIndex).toBeGreaterThanOrEqual(0);
    expect(shadeIndex).toBeLessThan(sunIndex);

    // The full-sun crop hits a hard light mismatch (two shade steps short) and
    // bands as unsuitable; the shade-tolerant crop, a clean light match, does not.
    expect(screen.getByText('Sun Lover').closest('li')?.textContent).toMatch(/unsuitable/i);
    expect(screen.getByText('Shade Dweller').closest('li')?.textContent).not.toMatch(/unsuitable/i);
  });

  it('re-ranks live as the plot store changes after the initial render', () => {
    addBothFixtures();
    render(<PlantPalette />);

    // Starts full-sun (the default plot store value): the sun-lover is not
    // demoted to unsuitable.
    expect(screen.getByText('Sun Lover').closest('li')?.textContent).not.toMatch(/unsuitable/i);

    act(() => {
      usePlotStore.getState().setConditionsInput({ light: 'full-shade' });
    });

    // Same rendered component, no remount: the plot turning shady demotes it.
    expect(screen.getByText('Sun Lover').closest('li')?.textContent).toMatch(/unsuitable/i);
  });

  it('hides unsuitable crops once the toggle is checked, and shows them again once unchecked', () => {
    addBothFixtures();
    act(() => {
      usePlotStore.getState().setConditionsInput({ light: 'full-shade' });
    });

    render(<PlantPalette />);
    expect(screen.getByText('Sun Lover')).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/hide unsuitable/i));
    expect(screen.queryByText('Sun Lover')).toBeNull();
    expect(screen.getByText('Shade Dweller')).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/hide unsuitable/i));
    expect(screen.getByText('Sun Lover')).toBeTruthy();
  });

  it('narrows the rendered list by search', () => {
    addBothFixtures();
    render(<PlantPalette />);

    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'shade dweller' } });

    expect(screen.getByText('Shade Dweller')).toBeTruthy();
    expect(screen.queryByText('Sun Lover')).toBeNull();
  });

  it('narrows the rendered list by category', () => {
    addBothFixtures();
    render(<PlantPalette />);

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'herb' } });

    expect(screen.getByText('Shade Dweller')).toBeTruthy();
    expect(screen.queryByText('Sun Lover')).toBeNull();
  });

  it('shows an inline alert instead of a list when the plot conditions are invalid', () => {
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      // A value the plot form would never itself produce (soil present but
      // empty) — exercises the resolve-and-catch fallback the same way a
      // corrupted upstream store value would.
      conditionsInput: { light: 'full-sun', soil: {} },
    });

    render(<PlantPalette />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders an icon image for each palette entry (Stage 4.2)', () => {
    addBothFixtures();
    const { container } = render(<PlantPalette />);

    // Each entry should have an img element for its icon.
    // Note: aria-hidden="true" makes the img not findable by getAllByRole('img'),
    // so query by tag name instead.
    const images = container.querySelectorAll('img');
    // Expect at least 2 images (one per fixture plant).
    expect(images.length).toBeGreaterThanOrEqual(2);
    images.forEach((img) => {
      // Each image should have a src (the resolved icon URL).
      expect(img.getAttribute('src')).toBeTruthy();
      // img should have empty alt text (it's decorative, aria-hidden).
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('renders the generic fallback icon for a user-defined crop with no icon', () => {
    const userCrop: UserPlantInput = {
      commonName: 'Custom Crop',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 10, betweenRowCm: 20 } },
      // No icon field, so resolveIcon should fall back to generic.
    };

    act(() => {
      useUserPlantsStore.getState().addUserPlant(userCrop);
    });

    render(<PlantPalette />);

    // The custom crop should appear with an icon img.
    const customCropEntry = screen.getByText('Custom Crop').closest('li');
    expect(customCropEntry).toBeTruthy();
    const img = customCropEntry?.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBeTruthy();
  });
});
