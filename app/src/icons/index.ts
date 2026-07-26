/**
 * Public entry point for the icon set (Workplan Stage 4.1). Stage 4.2 (and
 * anything else that needs a plant's icon) should import from here rather
 * than reaching into `resolveIcon.ts` or `crops/` directly.
 */
export {
  resolveIcon,
  GENERIC_ICON_KEY,
  GENERIC_ICON_URL,
  bundledCropIconCount,
} from './resolveIcon';
export type { IconAsset } from './resolveIcon';
