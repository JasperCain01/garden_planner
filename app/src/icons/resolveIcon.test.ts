import { describe, expect, it } from 'vitest';

import { SHIPPED_PLANTS } from '../dataset/shipped-plants';
import { bundledCropIconCount, GENERIC_ICON_URL, resolveIcon } from './resolveIcon';

describe('resolveIcon', () => {
  it('resolves a plant with no icon key via its id', () => {
    const onion = SHIPPED_PLANTS.find((p) => p.id === 'onion');
    expect(onion).toBeDefined();
    expect(onion?.icon).toBeUndefined();

    const asset = resolveIcon(onion!);

    expect(asset.isFallback).toBe(false);
    expect(asset.key).toBe('onion');
    expect(asset.url).toBeTruthy();
  });

  it('prefers plant.icon over plant.id when both are set', () => {
    const asset = resolveIcon({ id: 'not-a-real-id', icon: 'carrot' });

    expect(asset.isFallback).toBe(false);
    expect(asset.key).toBe('carrot');
  });

  it('falls back to the generic icon when neither icon nor id resolves', () => {
    // Mirrors a user-defined crop (Stage 3.6): a `user-`-namespaced id with no
    // icon set, since AddCropForm deliberately leaves `icon` unset today.
    const asset = resolveIcon({ id: 'user-my-mystery-crop', icon: undefined });

    expect(asset.isFallback).toBe(true);
    expect(asset.key).toBe('generic');
    expect(asset.url).toBe(GENERIC_ICON_URL);
  });

  it('falls back when an explicit icon key does not match any bundled asset', () => {
    const asset = resolveIcon({ id: 'onion', icon: 'not-a-bundled-icon' });

    expect(asset.isFallback).toBe(true);
    expect(asset.url).toBe(GENERIC_ICON_URL);
  });

  it('never returns an empty url, fallback or not', () => {
    for (const plant of SHIPPED_PLANTS) {
      expect(resolveIcon(plant).url.length).toBeGreaterThan(0);
    }
  });

  it('resolves every shipped crop to its own icon, not the fallback', () => {
    // The whole point of shipping 160 icons: no shipped crop should silently
    // land on the generic icon just because its id was mistyped somewhere in
    // classification.ts (tools/icons) or the file failed to generate.
    const fallenBack = SHIPPED_PLANTS.filter((plant) => resolveIcon(plant).isFallback);

    expect(fallenBack.map((p) => p.id)).toEqual([]);
  });

  it('bundles exactly one icon per shipped crop', () => {
    expect(bundledCropIconCount()).toBe(SHIPPED_PLANTS.length);
  });
});
