import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Enforces the size budget recorded in `docs/icon-style-guide.md`: the whole
 * icon set (one crop icon per shipped plant, plus 1 fallback) must stay
 * comfortably small, since it ships bundled with every page load
 * (WORKPLAN.md §0.1 — no runtime fetch). CI is deferred (WORKPLAN.md §1.4),
 * so this test *is* the recorded, automatically-checked budget rather than a
 * one-off manual note.
 *
 * Budgets: 4 KB per icon (the optimized set averages well under 1 KB; 4 KB
 * gives headroom for a contributor's hand-drawn replacement) and 250 KB total
 * (the optimized set is ~122 KB today).
 *
 * ### What this measures, and what it does not
 *
 * These are the **source `.svg` files on disk**, not the bytes a user
 * downloads. Every icon is under Vite's `assetsInlineLimit`, so none is
 * emitted as a separate file: they inline into the JS bundle as base64
 * `data:` URIs, which costs roughly 4/3 of the figures asserted here (see
 * `app/vite.config.ts` and ADR 0022). The per-icon cap is what keeps that
 * true — an icon crossing 4 KB is also roughly where Vite would start
 * emitting it separately — so this remains the right thing to guard.
 *
 * It is **not** a budget on the shipped bundle. That belongs to the build,
 * where Vite's own `chunkSizeWarningLimit` reports it, and it is tracked
 * separately (`docs/review-pre-deployment.md` §3.6). A green run here does
 * not mean the download stayed small; it means no single icon went rogue.
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
