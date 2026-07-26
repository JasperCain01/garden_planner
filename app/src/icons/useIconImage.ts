/**
 * Load a bundled icon URL into an HTMLImageElement for use with Konva's Image
 * component. Since all icons are build-time bundled assets (no network round
 * trip), this resolves near-instantly, but is still async.
 *
 * Returns the HTMLImageElement once loaded, or undefined while loading or if
 * load fails. Callers should typically render a fallback (e.g. a colored circle)
 * until this resolves.
 */

import { useEffect, useState } from 'react';

export function useIconImage(url: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>();

  useEffect(() => {
    const img = new Image();
    img.src = url;

    img.onload = () => setImage(img);
    // If load fails, leave image undefined so the fallback renders instead of a broken image.
    img.onerror = () => {
      /* silent — fallback renders */
    };

    // Cleanup: if the component unmounts before load completes, don't update state.
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return image;
}
