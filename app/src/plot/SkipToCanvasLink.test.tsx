import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipToCanvasLink } from './SkipToCanvasLink.tsx';
import styles from './SkipToCanvasLink.module.css';

describe('SkipToCanvasLink', () => {
  it('points at the plot canvas anchor', () => {
    render(<SkipToCanvasLink />);
    expect(screen.getByText(/skip to plot canvas/i).getAttribute('href')).toBe('#plot-canvas');
  });

  /**
   * The visually-hidden-until-focused behaviour itself is now two CSS rules
   * (`SkipToCanvasLink.module.css`), not component state — UI redesign Phase 0
   * replaced the `useState`/`onFocus` toggle Stage 6.2 had to write when this
   * app still had no stylesheet. jsdom doesn't apply a stylesheet's `:focus`
   * rule, so what's assertable here is that the link carries the class those
   * rules are attached to. That the link is reachable and does its job is
   * checked where it can be — in a real browser, by `keyboard-walkthrough.mjs`
   * step 0, which tabs to it and follows it to the canvas.
   */
  it('carries the visually-hidden-until-focused class', () => {
    render(<SkipToCanvasLink />);
    expect(screen.getByText(/skip to plot canvas/i).className).toBe(styles.skipLink);
  });
});
