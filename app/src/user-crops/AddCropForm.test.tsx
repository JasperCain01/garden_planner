import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createUserPlant, type UserPlantInput } from '@garden-planner/engine';
import { AddCropForm } from './AddCropForm.tsx';

/** Fill in exactly the required fields (name, category, light, row spacing). */
function fillRequiredFields(name = "Radish 'Cherry Belle'") {
  fireEvent.change(screen.getByLabelText(/name \(from the packet\)/i), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: 'vegetable' } });
  fireEvent.change(screen.getByLabelText(/light requirement/i), {
    target: { value: 'full-sun' },
  });
  fireEvent.change(screen.getByLabelText(/in-row spacing/i), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/between-row spacing/i), { target: { value: '20' } });
}

describe('AddCropForm', () => {
  it('previews the id it is about to mint as the name is typed', () => {
    render(<AddCropForm existingIds={[]} onSubmit={() => {}} />);

    fireEvent.change(screen.getByLabelText(/name \(from the packet\)/i), {
      target: { value: "Radish 'Cherry Belle'" },
    });

    expect(screen.getByText(/user-radish-cherry-belle/)).toBeTruthy();
  });

  it('submits a UserPlantInput that the engine accepts as a full Plant, for a valid packet', () => {
    const handleSubmit = vi.fn();
    render(<AddCropForm existingIds={[]} onSubmit={handleSubmit} />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /add crop/i }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const submitted = handleSubmit.mock.calls[0][0] as UserPlantInput;
    expect(submitted.commonName).toBe("Radish 'Cherry Belle'");
    expect(submitted.spacing).toEqual({ row: { inRowCm: 3, betweenRowCm: 20 } });

    // The deliverable: the engine's own upcast accepts it end to end.
    const plant = createUserPlant(submitted);
    expect(plant.id).toBe('user-radish-cherry-belle');
  });

  it('clears the form after a successful add (not in edit mode)', () => {
    render(<AddCropForm existingIds={[]} onSubmit={() => {}} />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /add crop/i }));

    expect(screen.getByLabelText(/name \(from the packet\)/i)).toHaveProperty('value', '');
  });

  it('shows a field-addressed error for a missing required field, and does not submit', () => {
    const handleSubmit = vi.fn();
    render(<AddCropForm existingIds={[]} onSubmit={handleSubmit} />);

    // Fill everything except category.
    fireEvent.change(screen.getByLabelText(/name \(from the packet\)/i), {
      target: { value: 'Cherry Belle' },
    });
    fireEvent.change(screen.getByLabelText(/light requirement/i), {
      target: { value: 'full-sun' },
    });
    fireEvent.change(screen.getByLabelText(/in-row spacing/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/between-row spacing/i), { target: { value: '20' } });

    fireEvent.click(screen.getByRole('button', { name: /add crop/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
    // The error renders right next to the category field it concerns.
    const categoryField = screen.getByLabelText(/^category$/i).closest('div');
    expect(categoryField?.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('supports intensive spacing as the alternative to row spacing', () => {
    const handleSubmit = vi.fn();
    render(<AddCropForm existingIds={[]} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText(/name \(from the packet\)/i), {
      target: { value: 'Cherry Belle' },
    });
    fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: 'vegetable' } });
    fireEvent.change(screen.getByLabelText(/light requirement/i), {
      target: { value: 'full-sun' },
    });
    fireEvent.click(screen.getByLabelText(/intensive \/ square-foot bed/i));
    fireEvent.change(screen.getByLabelText(/plants per m/i), { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: /add crop/i }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const submitted = handleSubmit.mock.calls[0][0] as UserPlantInput;
    expect(submitted.spacing).toEqual({ intensive: { perSquareMetre: 9 } });
  });

  describe('id-collision check', () => {
    it('blocks submission when the derived id collides with an existing user crop, until a custom id is set', () => {
      const handleSubmit = vi.fn();
      render(<AddCropForm existingIds={['user-radish-cherry-belle']} onSubmit={handleSubmit} />);

      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /add crop/i }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveProperty(
        'textContent',
        expect.stringContaining('already exists'),
      );

      // Resolve it via the custom-id escape hatch.
      fireEvent.change(screen.getByLabelText(/custom id/i), {
        target: { value: 'user-radish-cherry-belle-2' },
      });
      fireEvent.click(screen.getByRole('button', { name: /add crop/i }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      const submitted = handleSubmit.mock.calls[0][0] as UserPlantInput;
      expect(submitted.id).toBe('user-radish-cherry-belle-2');
    });

    it('does not treat editing a crop as colliding with its own existing id', () => {
      const handleSubmit = vi.fn();
      const initialInput: UserPlantInput = {
        id: 'user-radish-cherry-belle',
        commonName: "Radish 'Cherry Belle'",
        category: 'vegetable',
        light: 'full-sun',
        spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
      };
      render(
        <AddCropForm
          existingIds={['user-radish-cherry-belle']}
          onSubmit={handleSubmit}
          initialInput={initialInput}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      const submitted = handleSubmit.mock.calls[0][0] as UserPlantInput;
      expect(submitted.id).toBe('user-radish-cherry-belle');
    });

    it('calls onCancel from edit mode without submitting', () => {
      const handleSubmit = vi.fn();
      const handleCancel = vi.fn();
      const initialInput: UserPlantInput = {
        id: 'user-radish-cherry-belle',
        commonName: "Radish 'Cherry Belle'",
        category: 'vegetable',
        light: 'full-sun',
        spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
      };
      render(
        <AddCropForm
          existingIds={['user-radish-cherry-belle']}
          onSubmit={handleSubmit}
          initialInput={initialInput}
          onCancel={handleCancel}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(handleCancel).toHaveBeenCalledTimes(1);
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });
});
