import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLinks } from './SkipLinks.tsx';

describe('SkipLinks', () => {
  it('points at the plot canvas and the plot settings anchors', () => {
    render(<SkipLinks />);
    expect(screen.getByText(/skip to plot canvas/i).getAttribute('href')).toBe('#plot-canvas');
    expect(screen.getByText(/skip to plot settings/i).getAttribute('href')).toBe('#plot-settings');
  });
});
