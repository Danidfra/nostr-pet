import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_MIME, canSharePhoto, downloadPhoto, photoFile, sharePhoto } from './share';

const blob = new Blob(['png'], { type: PHOTO_MIME });
const NAME = 'blobbi-dotado-polaroid.png';

function abort(): Error {
  const error = new Error('closed');
  error.name = 'AbortError';
  return error;
}

function objectUrls() {
  const create = vi.fn(() => 'blob:mock');
  const revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
  return { create, revoke };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('whether the share sheet takes the picture', () => {
  it('asks with a real PNG file', () => {
    const canShare = vi.fn(() => true);
    expect(canSharePhoto(blob, NAME, { share: vi.fn(), canShare })).toBe(true);
    const asked = (canShare.mock.calls[0] as unknown as [ShareData])[0];
    expect(asked.files).toHaveLength(1);
    expect(asked.files![0].name).toBe(NAME);
    expect(asked.files![0].type).toBe(PHOTO_MIME);
  });

  it('is no without the API, without file sharing, or when asking throws', () => {
    expect(canSharePhoto(blob, NAME, null)).toBe(false);
    expect(canSharePhoto(blob, NAME, {})).toBe(false);
    expect(canSharePhoto(blob, NAME, { share: vi.fn() })).toBe(false);
    expect(canSharePhoto(blob, NAME, { share: vi.fn(), canShare: () => false })).toBe(false);
    expect(
      canSharePhoto(blob, NAME, {
        share: vi.fn(),
        canShare: () => {
          throw new Error('no');
        },
      }),
    ).toBe(false);
  });

  it('the file carries the picture', () => {
    expect(photoFile(blob, NAME)?.size).toBe(blob.size);
  });
});

describe('sharing', () => {
  it('shares the file where it can, with the Blobbi’s name, and downloads nothing', async () => {
    const urls = objectUrls();
    const share = vi.fn(async () => undefined);
    const outcome = await sharePhoto({ blob, filename: NAME, title: 'Dotado', nav: { share, canShare: () => true } });
    expect(outcome).toBe('shared');
    const shared = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(shared.title).toBe('Dotado');
    expect(shared.files![0].name).toBe(NAME);
    // Only the picture: no text, no link
    expect(shared.url).toBeUndefined();
    expect(shared.text).toBeUndefined();
    expect(urls.create).not.toHaveBeenCalled();
  });

  it('a sheet the player closes is cancelled: no error, no download behind their back', async () => {
    const urls = objectUrls();
    const outcome = await sharePhoto({ blob, filename: NAME, nav: { share: vi.fn(async () => Promise.reject(abort())), canShare: () => true } });
    expect(outcome).toBe('cancelled');
    expect(urls.create).not.toHaveBeenCalled();
  });

  it('a share the browser refuses falls back to the download', async () => {
    const urls = objectUrls();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const refused = Object.assign(new Error('not allowed'), { name: 'NotAllowedError' });
    const outcome = await sharePhoto({ blob, filename: NAME, nav: { share: vi.fn(async () => Promise.reject(refused)), canShare: () => true } });
    expect(outcome).toBe('downloaded');
    expect(urls.create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloads where there is no share sheet', async () => {
    objectUrls();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await sharePhoto({ blob, filename: NAME, nav: null })).toBe('downloaded');
    expect(await sharePhoto({ blob, filename: NAME, nav: { share: vi.fn(), canShare: () => false } })).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('says so when neither is possible', async () => {
    expect(await sharePhoto({ blob, filename: NAME, nav: null, doc: null })).toBe('unavailable');
  });
});

describe('the download', () => {
  it('is a named PNG on a short-lived object URL, and leaves nothing in the page', () => {
    vi.useFakeTimers();
    const urls = objectUrls();
    const seen: { download: string; href: string | null; attached: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ download: this.download, href: this.getAttribute('href'), attached: document.body.contains(this) });
    });
    expect(downloadPhoto(blob, NAME)).toBe(true);
    expect(seen).toEqual([{ download: NAME, href: 'blob:mock', attached: true }]);
    expect(document.body.querySelector('a[download]')).toBeNull();
    expect(urls.revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(urls.revoke).toHaveBeenCalledWith('blob:mock');
    vi.useRealTimers();
  });

  it('is refused, not thrown, where it cannot be done', () => {
    expect(downloadPhoto(blob, NAME, null)).toBe(false);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => { throw new Error('quota'); } }));
    expect(downloadPhoto(blob, NAME)).toBe(false);
  });
});
