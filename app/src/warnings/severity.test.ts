import { describe, expect, it } from 'vitest';
import { severityColor, severityGlyph, worseSeverity } from './severity.ts';

/** Relative luminance of an sRGB hex colour (WCAG 2.x contrast formula). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two sRGB hex colours (always ≥ 1). */
function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('worseSeverity', () => {
  it('picks severe over warning or info', () => {
    expect(worseSeverity('severe', 'info')).toBe('severe');
    expect(worseSeverity('info', 'severe')).toBe('severe');
    expect(worseSeverity('severe', 'warning')).toBe('severe');
  });

  it('picks warning over info', () => {
    expect(worseSeverity('warning', 'info')).toBe('warning');
    expect(worseSeverity('info', 'warning')).toBe('warning');
  });

  it('is a no-op when both sides match', () => {
    expect(worseSeverity('info', 'info')).toBe('info');
    expect(worseSeverity('warning', 'warning')).toBe('warning');
    expect(worseSeverity('severe', 'severe')).toBe('severe');
  });
});

describe('severityColor', () => {
  it('gives every severity its own colour', () => {
    const colors = new Set(
      (['info', 'warning', 'severe'] as const).map((severity) => severityColor(severity)),
    );
    expect(colors.size).toBe(3);
  });

  it('meets WCAG AA normal-text contrast (4.5:1) against a white background — Workplan Stage 6.2', () => {
    for (const severity of ['info', 'warning', 'severe'] as const) {
      expect(contrastRatio(severityColor(severity), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('severityGlyph', () => {
  it('gives every severity its own glyph, so a colour-blind reader can tell them apart on the canvas badge', () => {
    const glyphs = new Set(
      (['info', 'warning', 'severe'] as const).map((severity) => severityGlyph(severity)),
    );
    expect(glyphs.size).toBe(3);
  });
});
