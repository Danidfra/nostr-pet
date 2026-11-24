/**
 * The composer without a browser: a canvas that records what is drawn on it. What the picture LOOKS like is checked
 * by eye (the Dev Lab's Polaroid lab); here, what is drawn, in which order, and that nothing worn can break the export.
 */
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedAccessoryPlacement } from '@blobbi-kit/renderer';
import { PhotoError, composePolaroid, type ComposeEnv, type PolaroidInput } from './compose-polaroid';
import { POLAROID_HEIGHT, POLAROID_WIDTH, polaroidLayout } from './polaroid-layout';
import { isLoadableArtwork, svgDataUrl } from './rasterize';

interface Call {
  method: string;
  args: unknown[];
}

function fakeCanvas(options: { toBlob?: 'ok' | 'throws' | 'null' } = {}) {
  const calls: Call[] = [];
  const context = new Proxy(
    {},
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        if (prop === 'measureText') return (text: string) => ({ width: Array.from(text).length * 10 });
        if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
        };
      },
      set(target: Record<string, unknown>, prop: string, value: unknown) {
        target[prop] = value;
        return true;
      },
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob(done: (blob: Blob | null) => void) {
      if (options.toBlob === 'throws') throw Object.assign(new Error('tainted'), { name: 'SecurityError' });
      done(options.toBlob === 'null' ? null : new Blob(['png'], { type: 'image/png' }));
    },
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, calls };
}

const image = (tag: string) => ({ tag, width: 100, height: 50, naturalWidth: 100, naturalHeight: 50 }) as unknown as HTMLImageElement;

function env(overrides: Partial<ComposeEnv> = {}, canvases = [fakeCanvas()]) {
  let made = 0;
  const loadImage = vi.fn(async (src: string) => image(src.startsWith('data:') ? 'body' : src));
  const full: ComposeEnv = {
    createCanvas: (width, height) => {
      const next = canvases[made++];
      if (!next) return null;
      next.canvas.width = width;
      next.canvas.height = height;
      return next.canvas;
    },
    loadImage,
    fontsReady: async () => undefined,
    ...overrides,
  };
  return { env: full, canvases, loadImage: (overrides.loadImage ?? loadImage) as typeof loadImage };
}

const INPUT: PolaroidInput = { portrait: { stage: 'adult', facing: 'front', expression: 'happy', instanceId: 'polaroid' }, frame: 'classic', name: 'Dotado', caption: '', date: null };

function hat(overrides: Partial<NormalizedAccessoryPlacement> = {}): NormalizedAccessoryPlacement {
  return { id: 'hat', code: 'hat', slot: 'headwear', layer: 'front', layerRank: 4, xPercent: 50, yPercent: 20, scale: 1, rotationDeg: 0, flipX: false, imageUrl: 'https://cdn.example/hat.webp', sources: ['https://cdn.example/hat.webp'], ...overrides };
}

const texts = (calls: Call[]) => calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
const drawn = (calls: Call[]) => calls.filter((c) => c.method === 'drawImage').map((c) => (c.args[0] as { tag: string }).tag);

describe('the Polaroid composed', () => {
  it('is one full-size canvas with the Blobbi in its box and the name under it', async () => {
    const { env: e, canvases, loadImage } = env();
    const result = await composePolaroid(INPUT, e);
    expect(result.blob.type).toBe('image/png');
    expect([result.width, result.height]).toEqual([POLAROID_WIDTH, POLAROID_HEIGHT]);
    expect([canvases[0].canvas.width, canvases[0].canvas.height]).toEqual([POLAROID_WIDTH, POLAROID_HEIGHT]);
    expect(result.skippedAccessories).toBe(0);
    // The portrait is asked for as a sized SVG, with no CORS (it is this page's own data)
    const [src, options] = loadImage.mock.calls[0] as unknown as [string, { cors?: boolean } | undefined];
    expect(src.startsWith('data:image/svg+xml')).toBe(true);
    expect(options?.cors).toBeFalsy();
    const body = canvases[0].calls.find((c) => c.method === 'drawImage')!;
    const box = polaroidLayout().blobbi;
    expect(body.args.slice(1)).toEqual([box.x, box.y, box.width, box.height]);
    expect(texts(canvases[0].calls)).toEqual(['Dotado']);
  });

  it('writes the caption and the date only when there are any', async () => {
    const { env: e, canvases } = env();
    await composePolaroid({ ...INPUT, caption: '  our first  day ', date: 'Nov 9, 2026' }, e);
    expect(texts(canvases[0].calls)).toEqual(['Dotado', 'our first day', 'Nov 9, 2026']);
  });

  it('an unnamed Blobbi is still named on its picture', async () => {
    const { env: e, canvases } = env();
    await composePolaroid({ ...INPUT, name: '' }, e);
    expect(texts(canvases[0].calls)).toEqual(['Blobbi']);
  });

  it('every frame composes', async () => {
    for (const frame of ['classic', 'pastel', 'playful'] as const) {
      const { env: e } = env();
      await expect(composePolaroid({ ...INPUT, frame }, e)).resolves.toMatchObject({ skippedAccessories: 0 });
    }
  });

  it('waits for the font before a word is written', async () => {
    const order: string[] = [];
    const canvas = fakeCanvas();
    const { env: e } = env({ fontsReady: async () => void order.push('fonts') }, [canvas]);
    await composePolaroid(INPUT, e);
    expect(order).toEqual(['fonts']);
    expect(texts(canvas.calls)).toHaveLength(1);
  });
});

describe('what it wears', () => {
  it('is asked for with CORS and drawn behind or in front of the body, as the renderer layers it', async () => {
    const { env: e, canvases, loadImage } = env();
    const wings = hat({ id: 'wings', code: 'wings', slot: 'back', layer: 'behind', layerRank: -1, imageUrl: 'https://cdn.example/wings.webp', sources: ['https://cdn.example/wings.webp'] });
    const result = await composePolaroid({ ...INPUT, accessories: [wings, hat()] }, e);
    expect(result.skippedAccessories).toBe(0);
    expect(drawn(canvases[0].calls)).toEqual(['https://cdn.example/wings.webp', 'body', 'https://cdn.example/hat.webp']);
    for (const call of loadImage.mock.calls.slice(1)) expect((call as unknown as [string, { cors: boolean }])[1].cors).toBe(true);
  });

  it('sits where the renderer puts it: centred on its percent of the art box, at the base ratio times its scale, fitted whole', async () => {
    const { env: e, canvases } = env();
    await composePolaroid({ ...INPUT, accessories: [hat({ xPercent: 25, yPercent: 10, scale: 2, rotationDeg: 90, flipX: true })] }, e);
    const calls = canvases[0].calls;
    const at = calls.findIndex((c) => c.method === 'drawImage' && (c.args[0] as { tag: string }).tag !== 'body');
    const box = polaroidLayout().blobbi;
    const before = calls.slice(0, at);
    const translate = before.filter((c) => c.method === 'translate').pop()!;
    expect(translate.args).toEqual([box.x + box.width * 0.25, box.y + box.height * 0.1]);
    expect(before.filter((c) => c.method === 'rotate').pop()!.args[0]).toBeCloseTo(Math.PI / 2);
    expect(before.filter((c) => c.method === 'scale').pop()!.args).toEqual([-1, 1]);
    // A 100 x 50 image in a square of 46.875% of the box, twice: as wide as the square, half as tall
    const side = box.width * 0.46875 * 2;
    const [, x, y, w, h] = calls[at].args as [unknown, number, number, number, number];
    expect(w).toBeCloseTo(side);
    expect(h).toBeCloseTo(side / 2);
    expect(x).toBeCloseTo(-side / 2);
    expect(y).toBeCloseTo(-side / 4);
  });

  it('tries the next candidate image when the first cannot be loaded', async () => {
    const loadImage = vi.fn(async (src: string) => {
      if (src.includes('first')) throw new Error('no CORS');
      return image(src.startsWith('data:') ? 'body' : src);
    });
    const { env: e, canvases } = env({ loadImage });
    const result = await composePolaroid({ ...INPUT, accessories: [hat({ imageUrl: 'https://a.example/first.png', sources: ['https://a.example/first.png', 'https://b.example/second.png'] })] }, e);
    expect(result.skippedAccessories).toBe(0);
    expect(drawn(canvases[0].calls)).toEqual(['body', 'https://b.example/second.png']);
  });

  it('an image that cannot be loaded safely is left out and counted; the picture is still made', async () => {
    const loadImage = vi.fn(async (src: string) => {
      if (!src.startsWith('data:')) throw new Error('blocked by CORS');
      return image('body');
    });
    const { env: e, canvases } = env({ loadImage });
    const result = await composePolaroid({ ...INPUT, accessories: [hat(), hat({ id: 'scarf', code: 'scarf' })] }, e);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.skippedAccessories).toBe(2);
    expect(drawn(canvases[0].calls)).toEqual(['body']);
  });

  it('an address that is not plain https (or this origin’s own) is never even asked for', async () => {
    const { env: e, loadImage } = env();
    const result = await composePolaroid({ ...INPUT, accessories: [hat({ imageUrl: 'http://insecure.example/hat.png', sources: ['http://insecure.example/hat.png', 'javascript:alert(1)', 'file:///etc/passwd'] })] }, e);
    expect(result.skippedAccessories).toBe(1);
    expect(loadImage).toHaveBeenCalledTimes(1); // the body alone
    expect(isLoadableArtwork('/furniture/hat.png', 'https://www.blobbi.pet')).toBe(true);
    expect(isLoadableArtwork('https://blossom.example/hat.webp', 'https://www.blobbi.pet')).toBe(true);
    expect(isLoadableArtwork('http://blossom.example/hat.webp', 'https://www.blobbi.pet')).toBe(false);
    expect(isLoadableArtwork('data:image/png;base64,AAAA', 'https://www.blobbi.pet')).toBe(false);
  });

  it('should the export refuse anyway (a canvas made unreadable), the picture is drawn again with nothing worn', async () => {
    const tainted = fakeCanvas({ toBlob: 'throws' });
    const clean = fakeCanvas();
    const { env: e } = env({}, [tainted, clean]);
    const result = await composePolaroid({ ...INPUT, accessories: [hat()] }, e);
    expect(result.skippedAccessories).toBe(1);
    expect(drawn(tainted.calls)).toEqual(['body', 'https://cdn.example/hat.webp']);
    expect(drawn(clean.calls)).toEqual(['body']);
    expect(texts(clean.calls)).toEqual(['Dotado']);
  });
});

describe('when no picture can be made', () => {
  it('says so, as a PhotoError: no canvas, no portrait, no PNG', async () => {
    await expect(composePolaroid(INPUT, env({ createCanvas: () => null }).env)).rejects.toBeInstanceOf(PhotoError);
    await expect(composePolaroid(INPUT, env({ loadImage: async () => Promise.reject(new Error('no images')) }).env)).rejects.toBeInstanceOf(PhotoError);
    await expect(composePolaroid(INPUT, env({}, [fakeCanvas({ toBlob: 'null' })]).env)).rejects.toBeInstanceOf(PhotoError);
    await expect(composePolaroid(INPUT, env({}, [fakeCanvas({ toBlob: 'throws' })]).env)).rejects.toBeInstanceOf(PhotoError);
  });
});

describe('the portrait as an image address', () => {
  const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(',') + 1));

  it('states its size in pixels (Safari draws a percent-sized SVG at nothing) and drops the XML prolog', () => {
    const url = svgDataUrl('<?xml version="1.0" encoding="UTF-8"?>\n<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><g/></svg>', 711.4);
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decode(url)).toBe('<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="711" height="711"><g/></svg>');
  });

  it('adds the namespace when the drawing has none, and leaves inner sizes alone', () => {
    const svg = decode(svgDataUrl("<svg viewBox='0 0 10 10' width='5' height='5'><rect width=\"3\" height=\"3\"/></svg>", 64));
    expect(svg).toBe('<svg viewBox=\'0 0 10 10\' xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="3" height="3"/></svg>');
  });
});
