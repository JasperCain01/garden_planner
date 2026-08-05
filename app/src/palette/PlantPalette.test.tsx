import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

/**
 * The palette's rows, in rendered (i.e. ranked) order, named by each row's
 * drag surface.
 *
 * This replaced `getAllByRole('heading', { level: 3 })` in UI redesign
 * Phase 3, which dropped the per-crop `<h3>` — 144 crop headings ahead of the
 * six that structure the app, and inside a `role="button"` element whose
 * subtree ARIA treats as presentational anyway (`PlantPalette.tsx`'s doc). The
 * drag surface is a better handle regardless: it is the row's own accessible
 * name, so a test that reads order can't drift from what a user hears.
 */
function rowNames(): string[] {
  return screen
    .getAllByRole('button', { name: /^drag / })
    .map((surface) => surface.getAttribute('aria-label') ?? '');
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

  /**
   * The tab-stop budget, as a test (UI redesign Phase 3,
   * `docs/accessibility.md` §8). 144 crops × 2 focusable controls is 288 tab
   * stops in the palette; a third control per row would make it 432, and the
   * keyboard walkthrough's own step 6 gives up after 320. Making the card
   * *itself* the disclosure — rather than adding a "why?" button beside it —
   * is what keeps this at two, so it is worth failing loudly if a fourth
   * affordance ever arrives as a third control.
   */
  it('spends exactly two tab stops per crop row (the card, then its ＋ button)', () => {
    addBothFixtures();
    render(<PlantPalette />);

    for (const row of screen.getAllByRole('listitem')) {
      const focusable = row.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      expect(focusable).toHaveLength(2);
      expect(focusable[0].getAttribute('aria-label')).toMatch(/^drag /);
      expect(focusable[1].getAttribute('aria-label')).toMatch(/to the plot, without dragging$/);
    }
  });

  /**
   * The phase's second acceptance criterion — "reasoning reachable in one
   * click" — at the component level. The e2e spec proves the *pointer* gets
   * there (a click on a drag surface with an activation constraint behind it
   * is a real-browser question); this proves the content is exactly what used
   * to be inlined, and that it isn't in the document until asked for.
   */
  it('opens the engine’s reasoning on the card’s first click, and closes it on the second', () => {
    addBothFixtures();
    render(<PlantPalette />);

    const card = screen.getByLabelText(/drag sun lover onto the plot to place it/i);
    const row = card.closest('li');
    if (row === null) throw new Error('the drag surface is not inside a row');

    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(within(row).queryByText(/confidence:/i)).toBeNull();

    fireEvent.click(card);

    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(within(row).getByText(/confidence:/i)).toBeTruthy();
    // The per-dimension reasoning the engine produced, not a summary of it.
    expect(within(row).getByText(/light:/i)).toBeTruthy();

    fireEvent.click(card);

    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(within(row).queryByText(/confidence:/i)).toBeNull();
  });

  /**
   * Enter, not Space: dnd-kit's `KeyboardSensor` keeps Space to start a
   * keyboard drag, and `PlotDefinitionPage` narrows the sensor's start keys to
   * exactly that so Enter is free for this (ADR 0032 §2). A `role="button"`
   * `<div>` doesn't synthesise a click from Enter the way a real `<button>`
   * does, so without this handler the disclosure would be pointer-only.
   */
  it('opens the reasoning from the keyboard too, on Enter', () => {
    addBothFixtures();
    render(<PlantPalette />);

    const card = screen.getByLabelText(/drag sun lover onto the plot to place it/i);
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps at most one crop’s reasoning open at a time', () => {
    addBothFixtures();
    render(<PlantPalette />);

    const sunLover = screen.getByLabelText(/drag sun lover onto the plot to place it/i);
    const shadeDweller = screen.getByLabelText(/drag shade dweller onto the plot to place it/i);

    fireEvent.click(sunLover);
    fireEvent.click(shadeDweller);

    expect(sunLover.getAttribute('aria-expanded')).toBe('false');
    expect(shadeDweller.getAttribute('aria-expanded')).toBe('true');
  });

  it('demotes a full-sun crop below a shade-tolerant one once the plot turns shady', () => {
    addBothFixtures();
    act(() => {
      usePlotStore.getState().setConditionsInput({ light: 'full-shade' });
    });

    render(<PlantPalette />);

    const names = rowNames();
    const shadeIndex = names.findIndex((name) => name.includes('Shade Dweller'));
    const sunIndex = names.findIndex((name) => name.includes('Sun Lover'));

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

  /**
   * The category filter is a chip — a radio in a group, visually hidden and
   * styled through its label — rather than the `<select>` it was before UI
   * redesign Phase 3. One tab stop for the whole group with arrow keys inside
   * it is the native behaviour a roving-tabindex widget would have to imitate,
   * and this palette counts its tab stops.
   */
  it('narrows the rendered list by category chip', () => {
    addBothFixtures();
    render(<PlantPalette />);

    fireEvent.click(screen.getByRole('radio', { name: 'Herb' }));

    expect(screen.getByText('Shade Dweller')).toBeTruthy();
    expect(screen.queryByText('Sun Lover')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText('Sun Lover')).toBeTruthy();
  });

  /**
   * "Great fits" = excellent + good (`filters.ts#matchesBand`, and the
   * review's own definition). On a shady plot the full-sun fixture is
   * unsuitable and the shade-tolerant one is not, so the chip should leave
   * exactly one standing.
   */
  it('narrows the rendered list to great fits', () => {
    addBothFixtures();
    act(() => {
      usePlotStore.getState().setConditionsInput({ light: 'full-shade' });
    });

    render(<PlantPalette />);
    expect(screen.getByText('Sun Lover')).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/great fits/i));

    expect(screen.queryByText('Sun Lover')).toBeNull();
    expect(screen.getByText('Shade Dweller')).toBeTruthy();
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

  /**
   * The icon's disc is tinted by category (UI redesign Phase 3), which is the
   * same mapping the canvas paints a marker's canopy with — so the tint is
   * driven by a `data-category` attribute reading the plant's own category,
   * never by a colour chosen per row. The colours themselves are
   * `styles/tokens.css`' `--category-*-bg`, guarded there.
   */
  it('tints each icon disc by the crop’s own category', () => {
    addBothFixtures();
    render(<PlantPalette />);

    const sunLoverRow = screen.getByText('Sun Lover').closest('li');
    const shadeDwellerRow = screen.getByText('Shade Dweller').closest('li');

    expect(sunLoverRow?.querySelector('[data-category]')?.getAttribute('data-category')).toBe(
      'vegetable',
    );
    expect(shadeDwellerRow?.querySelector('[data-category]')?.getAttribute('data-category')).toBe(
      'herb',
    );
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
