import { describe, expect, it } from 'vitest';
import { severityColor, worseSeverity } from './severity.ts';

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
});
