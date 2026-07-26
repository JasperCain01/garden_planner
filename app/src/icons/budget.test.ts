import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Enforces the size budget recorded in `docs/icon-style-guide.md`: the whole
 * icon set (160 crop icons + 1 fallback) must stay comfortably small, since
 * it ships bundled with every page load (WORKPLAN.md §0.1 — no runtime
 * fetch). CI is deferred (WORKPLAN.md §1.4), so this test *is* the recorded,
 * automatically-checked budget rather than a one-off manual note.
 *
 * Budgets: 4 KB per icon (the optimized set averages well under 1 KB; 4 KB
 * gives headroom for a contributor's hand-drawn replacement) and 250 KB total
 * (the optimized set is ~121 KB today).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const cropsDir = path.join(here, 'crops');
const genericPath = path.join(here, 'generic.svg');

const MAX_BYTES_PER_ICON = 4096;
const MAX_TOTAL_BYTES = 250 * 1024;

describe('icon size budget', () => {
  it('keeps every individual icon under the per-icon budget', () => {
    const files = readdirSync(cropsDir).filter((f) => f.endsWith('.svg'));
    expect(files.length).toBeGreaterThan(0);

    const oversized = files
      .map((f) => ({ f, bytes: statSync(path.join(cropsDir, f)).size }))
      .filter(({ bytes }) => bytes > MAX_BYTES_PER_ICON);

    expect(oversized).toEqual([]);
    expect(statSync(genericPath).size).toBeLessThanOrEqual(MAX_BYTES_PER_ICON);
  });

  it('keeps the whole set under the total payload budget', () => {
    const files = readdirSync(cropsDir).filter((f) => f.endsWith('.svg'));
    const total =
      files.reduce((sum, f) => sum + statSync(path.join(cropsDir, f)).size, 0) +
      statSync(genericPath).size;

    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });
});
