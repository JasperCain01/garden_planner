import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOpenFarmCache, refreshOpenFarmCache, saveOpenFarmCache } from './cache.ts';
import type { OpenFarmTransport } from './transport.ts';
import type { OpenFarmCropRaw } from './types.ts';

// Mirrors resolve/gbif-cache.test.ts: real file I/O against a throwaway temp
// directory, never the committed cache/openfarm-crops.json. The network
// boundary itself is covered separately in transport.test.ts.
describe('openfarm cache', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'openfarm-cache-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const onion: OpenFarmCropRaw = {
    slug: 'onion',
    name: 'Onion',
    binomialName: 'Allium cepa',
    sun: 'Full Sun',
    spreadCm: 8,
    rowSpacingCm: 30,
    source: {
      origin: 'OpenFarm.cc',
      license: 'CC0-1.0',
      waybackUrl: 'https://web.archive.org/web/20250101000000/https://openfarm.cc/en/crops/onion',
      captured: '20250101',
    },
  };

  describe('loadOpenFarmCache', () => {
    it('returns an empty array when the file does not exist yet', () => {
      expect(loadOpenFarmCache(join(dir, 'missing.json'))).toEqual([]);
    });

    it('round-trips records written by saveOpenFarmCache', () => {
      const path = join(dir, 'crops.json');
      saveOpenFarmCache(path, [onion]);
      expect(loadOpenFarmCache(path)).toEqual([onion]);
    });
  });

  describe('saveOpenFarmCache', () => {
    it('writes records sorted by slug for stable diffs', () => {
      const path = join(dir, 'crops.json');
      const tomato: OpenFarmCropRaw = { ...onion, slug: 'tomato', name: 'Tomato' };
      const carrot: OpenFarmCropRaw = { ...onion, slug: 'carrot', name: 'Carrot' };

      saveOpenFarmCache(path, [tomato, onion, carrot]);

      expect(loadOpenFarmCache(path).map((r) => r.slug)).toEqual(['carrot', 'onion', 'tomato']);
    });

    it('creates the parent directory if it does not exist', () => {
      const path = join(dir, 'nested', 'crops.json');
      saveOpenFarmCache(path, [onion]);
      expect(loadOpenFarmCache(path)).toEqual([onion]);
    });
  });

  describe('refreshOpenFarmCache', () => {
    it('fetches via the injected transport and writes the result to disk', async () => {
      const path = join(dir, 'crops.json');
      const transport: OpenFarmTransport = {
        fetchDump: vi.fn(async () => [onion]),
      };

      await refreshOpenFarmCache(path, transport);

      expect(transport.fetchDump).toHaveBeenCalledTimes(1);
      expect(loadOpenFarmCache(path)).toEqual([onion]);
    });
  });
});
