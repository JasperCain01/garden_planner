import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLinks } from './SkipLinks.tsx';
import styles from './SkipLinks.module.css';

describe('SkipLinks', () => {
  it('points at the plot canvas and the plot settings anchors', () => {
    render(<SkipLinks />);
    expect(screen.getByText(/skip to plot canvas/i).getAttribute('href')).toBe('#plot-canvas');
    expect(screen.getByText(/skip to plot settings/i).getAttribute('href')).toBe('#plot-settings');
  });

  /**
   * The visually-hidden-until-focused behaviour itself is two CSS rules
   * (`SkipLinks.module.css`), not component state — UI redesign Phase 0
   * replaced the `useState`/`onFocus` toggle Stage 6.2 had to write when this
   * app still had no stylesheet. jsdom doesn't apply a stylesheet's `:focus`
   * rule, so what's assertable here is that each link carries the class those
   * rules are attached to. That the links are reachable and do their job is
   * checked where it can be — in a real browser, by `keyboard-walkthrough.mjs`
   * step 0.
   */
  it('carries the visually-hidden-until-focused class on both links', () => {
    render(<SkipLinks />);
    expect(screen.getByText(/skip to plot canvas/i).className).toBe(styles.skipLink);
    expect(screen.getByText(/skip to plot settings/i).className).toBe(styles.skipLink);
  });
});
