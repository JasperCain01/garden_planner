import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalDialog } from './ModalDialog.tsx';

/**
 * What this can and can't check. jsdom 25 has no `HTMLDialogElement` — no
 * `showModal`, no `close`, no top layer — so the browser-owned half of this
 * component (the focus trap, Esc, returning focus to the trigger) is not
 * observable here and is covered by `e2e/add-custom-crop.spec.ts` and the axe
 * run instead. What *is* checkable, and is exactly what the rest of the app
 * depends on, is the contract around it: children exist only while open, the
 * element carries the open state, and every close route reports back.
 */
describe('ModalDialog', () => {
  it('renders no content while closed, so a shut dialog puts nothing in the accessibility tree', () => {
    render(
      <ModalDialog open={false} onClose={() => {}} title="Add your own crop">
        <p>form goes here</p>
      </ModalDialog>,
    );

    expect(screen.queryByText('form goes here')).toBeNull();
    expect(screen.queryByRole('heading', { name: /add your own crop/i })).toBeNull();
  });

  it('renders its title and children while open, and marks the element open', () => {
    const { container } = render(
      <ModalDialog open onClose={() => {}} title="Add your own crop">
        <p>form goes here</p>
      </ModalDialog>,
    );

    expect(screen.getByRole('heading', { name: /add your own crop/i })).toBeTruthy();
    expect(screen.getByText('form goes here')).toBeTruthy();
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });

  it('names the dialog by its title, so a screen reader announces which dialog opened', () => {
    const { container } = render(
      <ModalDialog open onClose={() => {}} title="Add your own crop">
        <p>form goes here</p>
      </ModalDialog>,
    );

    const dialog = container.querySelector('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Add your own crop');
  });

  it('reports a close when the close button is pressed', () => {
    const onClose = vi.fn();
    render(
      <ModalDialog open onClose={onClose} title="Add your own crop">
        <p>form goes here</p>
      </ModalDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: /close add your own crop/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
