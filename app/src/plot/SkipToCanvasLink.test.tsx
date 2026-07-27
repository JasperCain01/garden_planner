import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipToCanvasLink } from './SkipToCanvasLink.tsx';

describe('SkipToCanvasLink', () => {
  it('points at the plot canvas anchor', () => {
    render(<SkipToCanvasLink />);
    expect(screen.getByText(/skip to plot canvas/i).getAttribute('href')).toBe('#plot-canvas');
  });

  it('is visually hidden until it receives focus, then becomes visible', () => {
    render(<SkipToCanvasLink />);
    const link = screen.getByText(/skip to plot canvas/i);

    expect(link.style.clip).toBe('rect(0px, 0px, 0px, 0px)');

    fireEvent.focus(link);
    expect(link.style.position).toBe('fixed');
    expect(link.style.clip).toBe('');

    fireEvent.blur(link);
    expect(link.style.clip).toBe('rect(0px, 0px, 0px, 0px)');
  });
});
