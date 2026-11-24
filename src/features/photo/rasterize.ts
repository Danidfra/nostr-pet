/**
 * From strings and URLs to things a canvas can draw.
 *
 * The Blobbi's portrait is an SVG string (the kit's); a browser draws an
 * SVG onto a canvas through an `<img>`, and only reliably when the SVG
 * states its own pixel size (Safari draws a `width="100%"` one at nothing,
 * or at 150 px). So the root is given the size it will be drawn at, which
 * also makes the picture sharp: the vector is rasterised once, at its
 * final size. The kit's still drawings carry no stylesheet, no external
 * image and no `foreignObject`, so such an image never taints a canvas.
 *
 * An accessory's artwork is an ordinary image URL. It is asked for with
 * CORS (`crossOrigin = 'anonymous'`): a host that does not allow it fails
 * to LOAD, here, where that can be handled, instead of loading and then
 * poisoning the canvas so that the export throws.
 */

/** The SVG with its root sized to `size` px square, as a data URL an `<img>` can load. */
export function svgDataUrl(svg: string, size: number): string {
  const px = String(Math.max(1, Math.round(size)));
  const body = svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
  const sized = body.replace(/<svg\b([^>]*)>/i, (_open, attrs: string) => {
    const kept = attrs.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    const xmlns = /\sxmlns\s*=/.test(kept) ? '' : ' xmlns="http://www.w3.org/2000/svg"';
    return `<svg${kept}${xmlns} width="${px}" height="${px}">`;
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
}

export interface LoadImageOptions {
  /** Ask with CORS, so a refusal is a load failure and never a tainted canvas. */
  cors?: boolean;
  timeoutMs?: number;
}

/** Load an image, or reject: on an error, on a timeout, or where there are no images at all. */
export function loadImage(src: string, { cors = false, timeoutMs = 6_000 }: LoadImageOptions = {}): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('no images here'));
      return;
    }
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = image.onerror = null;
      reject(new Error('the image took too long'));
    }, timeoutMs);
    image.onload = () => {
      clearTimeout(timer);
      if (image.naturalWidth > 0 || src.startsWith('data:image/svg+xml')) resolve(image);
      else reject(new Error('the image is empty'));
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('the image could not be loaded'));
    };
    if (cors) image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.src = src;
  });
}

/** Whether a URL may be asked for as an accessory's artwork: this origin's own, or plain https. */
export function isLoadableArtwork(url: string, origin: string = typeof location !== 'undefined' ? location.origin : 'https://blobbi.invalid'): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
