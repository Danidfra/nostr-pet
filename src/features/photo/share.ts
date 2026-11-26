/**
 * Taking the picture out of the app: the device's own share sheet where it
 * can carry an image, a plain download everywhere else.
 *
 * Nothing leaves the device unless the player chooses where: the share
 * sheet is the system's, the download is a file. No upload, no relay, no
 * event.
 *
 *   canSharePhoto   whether the share sheet takes a PNG file here (it is
 *                   asked with a real file, as the platform requires)
 *   sharePhoto      share; a share the player closes is `cancelled` and is
 *                   not an error; one the browser refuses for any other
 *                   reason falls back to the download
 *   downloadPhoto   an `<a download>` on a short-lived object URL
 *
 * Where neither works (an installed iPhone app saves no downloads), the
 * preview itself is a real `<img>`: a long press saves it. The sheet says so.
 */

export const PHOTO_MIME = 'image/png';

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded' | 'unavailable';

type ShareNavigator = Pick<Navigator, 'share' | 'canShare'>;

function navigatorOrNull(): Partial<ShareNavigator> | null {
  return typeof navigator !== 'undefined' ? navigator : null;
}

export function photoFile(blob: Blob, filename: string): File | null {
  try {
    return new File([blob], filename, { type: PHOTO_MIME });
  } catch {
    return null;
  }
}

/** Whether the system share sheet takes this picture here. */
export function canSharePhoto(blob: Blob, filename: string, nav: Partial<ShareNavigator> | null = navigatorOrNull()): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  const file = photoFile(blob, filename);
  if (!file) return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Hand the picture to the browser as a download. False where that cannot be done. */
export function downloadPhoto(blob: Blob, filename: string, doc: Document | null = typeof document !== 'undefined' ? document : null): boolean {
  const url = globalThis.URL;
  if (!doc || typeof url?.createObjectURL !== 'function') return false;
  try {
    const href = url.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = href;
    a.download = filename;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(() => url.revokeObjectURL?.(href), 1_000);
    return true;
  } catch {
    return false;
  }
}

export interface SharePhotoOptions {
  blob: Blob;
  filename: string;
  /** The share sheet's title (the Blobbi's name). */
  title?: string;
  nav?: Partial<ShareNavigator> | null;
  doc?: Document | null;
}

/**
 * Share the picture; download it where sharing is not possible or is
 * refused. Must be called from the player's own tap (the platform's rule
 * for both).
 */
export async function sharePhoto({ blob, filename, title, nav = navigatorOrNull(), doc }: SharePhotoOptions): Promise<ShareOutcome> {
  if (canSharePhoto(blob, filename, nav)) {
    const file = photoFile(blob, filename)!;
    try {
      await nav!.share!({ files: [file], title });
      return 'shared';
    } catch (error) {
      // The player closed the sheet: their choice, nothing to fall back to
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
    }
  }
  return downloadPhoto(blob, filename, doc) ? 'downloaded' : 'unavailable';
}
