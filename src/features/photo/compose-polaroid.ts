/**
 * The Polaroid drawn: one offscreen 2D canvas, a PNG out.
 *
 * What is drawn is `polaroid-layout.ts` to the pixel: the paper, the photo
 * window with its backdrop, the Blobbi's portrait (`blobbi-portrait.ts`,
 * the kit's own drawing) on a soft shadow, whatever it wears that can be
 * drawn safely, the frame's decorations, and the words. No WebGL, no
 * screenshot of the page: the 3D room's context is never touched.
 *
 * What it wears: accessories are images from the Island's catalog. Each is
 * loaded with CORS and placed exactly as the kit's renderer places it (the
 * centre in percent of the art box, the base ratio times its own scale,
 * rotated, flipped). One that cannot be loaded that way is left out and
 * counted, never drawn: a picture missing a hat still exports, a tainted
 * canvas does not. Should the export refuse anyway, the picture is drawn
 * again with nothing worn.
 *
 * Everything the browser provides arrives through `ComposeEnv`, so the
 * whole run is testable without a canvas.
 */
import { ACCESSORY_BASE_RATIO, type NormalizedAccessoryPlacement, type RenderBlobbiSvgOptions } from '@blobbi-kit/renderer';
import { renderPortrait } from './blobbi-portrait';
import { chinText, frameStyle, polaroidLayout, type Decoration, type FrameStyle, type PolaroidFrame, type PolaroidLayout, type Rect } from './polaroid-layout';
import { isLoadableArtwork, loadImage, svgDataUrl } from './rasterize';

export const FONT_FAMILY = '"Comfortaa Variable", "Comfortaa", system-ui, -apple-system, "Segoe UI", sans-serif';

export interface PolaroidInput {
  /** The portrait, as `portraitOf` describes it. */
  portrait: RenderBlobbiSvgOptions;
  frame: PolaroidFrame;
  name: string | undefined;
  /** As typed; cleaned and wrapped here. */
  caption: string;
  /** The date as written, or null for none. */
  date: string | null;
  /** What it wears, for the front (the renderer's own placements). */
  accessories?: readonly NormalizedAccessoryPlacement[];
}

export interface PolaroidResult {
  blob: Blob;
  width: number;
  height: number;
  /** Accessories that could not be drawn safely and were left out. */
  skippedAccessories: number;
}

type Drawable = CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number };

export interface ComposeEnv {
  /** A canvas of this size, or null where there is none. */
  createCanvas: (width: number, height: number) => HTMLCanvasElement | null;
  loadImage: (src: string, options?: { cors?: boolean }) => Promise<Drawable>;
  /** Resolves when the app's font can be drawn (or cannot be waited for any longer). */
  fontsReady: () => Promise<void>;
}

/** Why a picture could not be made. */
export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}

export function browserEnv(): ComposeEnv {
  return {
    createCanvas(width, height) {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    loadImage: (src, options) => loadImage(src, options),
    async fontsReady() {
      const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
      if (!fonts?.load) return;
      const wanted = Promise.all([fonts.load(`700 68px ${FONT_FAMILY}`), fonts.load(`500 38px ${FONT_FAMILY}`)]).then(() => undefined, () => undefined);
      await Promise.race([wanted, new Promise<void>((resolve) => setTimeout(resolve, 1_500))]);
    },
  };
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

function roundedRect(ctx: CanvasRenderingContext2D, { x, y, width, height }: Rect, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function vertical(ctx: CanvasRenderingContext2D, rect: Rect, [from, to]: readonly [string, string]): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
}

function star(ctx: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawDecoration(ctx: CanvasRenderingContext2D, d: Decoration) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rotation);
  ctx.fillStyle = d.color;
  const s = d.size;
  if (d.kind === 'dot') {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'star') {
    // A plump sticker: a white rim under a rounded star
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.34;
    star(ctx, 5, s, s * 0.52);
    ctx.stroke();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = s * 0.16;
    ctx.stroke();
    ctx.fill();
  } else if (d.kind === 'sparkle') {
    star(ctx, 4, s, s * 0.3);
    ctx.fill();
  } else if (d.kind === 'heart') {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s * 1.5, -s * 0.15, -s * 0.75, -s * 1.15, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.75, -s * 1.15, s * 1.5, -s * 0.15, 0, s * 0.85);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.3;
    path();
    ctx.stroke();
    ctx.fill();
  } else {
    // Tape: a translucent strip with a lighter stripe
    const h = s * 0.3;
    ctx.fillRect(-s / 2, -h / 2, s, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-s / 2, -h / 2, s, h * 0.28);
  }
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, layout: PolaroidLayout, style: FrameStyle) {
  const { photo } = layout;
  ctx.fillStyle = vertical(ctx, photo, style.backdrop);
  ctx.fillRect(photo.x, photo.y, photo.width, photo.height);
  if (style.backdropPattern === 'dots') {
    ctx.fillStyle = style.patternColor;
    const step = 78;
    for (let row = 0, y = photo.y + step / 2; y < photo.y + photo.height; y += step, row++) {
      for (let x = photo.x + (row % 2 ? step : step / 2); x < photo.x + photo.width; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style.backdropPattern === 'rays') {
    const cx = photo.x + photo.width / 2;
    const cy = photo.y + photo.height * 0.56;
    const reach = photo.width;
    ctx.fillStyle = style.patternColor;
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a0 = (Math.PI * 2 * i) / rays;
      const a1 = a0 + Math.PI / rays;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach);
      ctx.lineTo(cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
      ctx.closePath();
      ctx.fill();
    }
  }
  // The floor: a soft rise of light at the bottom of the photo, so the Blobbi stands on something
  ctx.fillStyle = style.floor;
  ctx.beginPath();
  ctx.ellipse(photo.x + photo.width / 2, photo.y + photo.height + photo.height * 0.1, photo.width * 0.85, photo.height * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAccessory(ctx: CanvasRenderingContext2D, box: Rect, placement: NormalizedAccessoryPlacement, image: Drawable) {
  const side = box.width * ACCESSORY_BASE_RATIO * placement.scale;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!(side > 0) || !(iw > 0) || !(ih > 0)) return;
  // object-fit: contain, in the accessory's square
  const fit = Math.min(side / iw, side / ih);
  const w = iw * fit;
  const h = ih * fit;
  ctx.save();
  ctx.translate(box.x + (box.width * placement.xPercent) / 100, box.y + (box.height * placement.yPercent) / 100);
  ctx.rotate((placement.rotationDeg * Math.PI) / 180);
  if (placement.flipX) ctx.scale(-1, 1);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** The first of an accessory's candidate images that loads with CORS, or null. */
async function loadAccessory(env: ComposeEnv, placement: NormalizedAccessoryPlacement): Promise<Drawable | null> {
  const sources = placement.sources.length ? placement.sources : [placement.imageUrl];
  for (const src of sources) {
    if (!src || !isLoadableArtwork(src)) continue;
    try {
      return await env.loadImage(src, { cors: true });
    } catch {
      /* the next candidate */
    }
  }
  return null;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError('The picture could not be saved as an image.'))), 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

interface Loaded {
  placement: NormalizedAccessoryPlacement;
  image: Drawable;
}

function draw(canvas: HTMLCanvasElement, input: PolaroidInput, body: Drawable, ground: { y: number; centerX: number; width: number }, worn: readonly Loaded[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('This browser cannot draw the picture.');
  const layout = polaroidLayout();
  const style = frameStyle(input.frame);
  const paper: Rect = { x: 0, y: 0, width: layout.width, height: layout.height };
  ctx.clearRect(0, 0, layout.width, layout.height);

  // The paper, with rounded corners (transparent outside them)
  ctx.save();
  roundedRect(ctx, paper, layout.radius);
  ctx.clip();
  ctx.fillStyle = vertical(ctx, paper, style.paper);
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.restore();

  // The photo
  ctx.save();
  roundedRect(ctx, layout.photo, 12);
  ctx.clip();
  drawBackdrop(ctx, layout, style);
  const box = layout.blobbi;
  // Its shadow on the floor, where its own drawing says it stands
  ctx.fillStyle = 'rgba(59, 47, 88, 0.16)';
  ctx.beginPath();
  ctx.ellipse(box.x + box.width * ground.centerX, box.y + box.height * ground.y, (box.width * ground.width) / 2 + box.width * 0.06, box.height * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const { placement, image } of worn) if (placement.layer === 'behind') drawAccessory(ctx, box, placement, image);
  ctx.drawImage(body, box.x, box.y, box.width, box.height);
  for (const { placement, image } of worn) if (placement.layer !== 'behind') drawAccessory(ctx, box, placement, image);
  ctx.restore();

  // The window's edge
  ctx.save();
  roundedRect(ctx, layout.photo, 12);
  ctx.strokeStyle = style.photoEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  for (const decoration of style.decorations) drawDecoration(ctx, decoration);

  // The words
  const measureAt = (size: number, weight: number) => (text: string) => {
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  };
  const words = chinText({ name: input.name, caption: input.caption, date: input.date }, measureAt);
  const centre = layout.width / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = style.ink;
  ctx.font = `700 ${words.name.size}px ${FONT_FAMILY}`;
  ctx.fillText(words.name.text, centre, words.name.baseline);
  ctx.font = `500 ${words.caption.size}px ${FONT_FAMILY}`;
  words.caption.lines.forEach((line, i) => ctx.fillText(line, centre, words.caption.baselines[i]));
  if (words.date) {
    ctx.fillStyle = style.inkSoft;
    ctx.font = `500 ${words.date.size}px ${FONT_FAMILY}`;
    ctx.fillText(words.date.text, centre, words.date.baseline);
  }
}

/** Draw the Polaroid and hand back its PNG. Rejects with `PhotoError` where no picture can be made. */
export async function composePolaroid(input: PolaroidInput, env: ComposeEnv = browserEnv()): Promise<PolaroidResult> {
  const layout = polaroidLayout();
  const canvas = env.createCanvas(layout.width, layout.height);
  if (!canvas) throw new PhotoError('This browser cannot draw the picture.');

  const portrait = renderPortrait(input.portrait);
  let body: Drawable;
  try {
    body = await env.loadImage(svgDataUrl(portrait.svg, layout.blobbi.width));
  } catch {
    throw new PhotoError('The Blobbi could not be drawn for the picture.');
  }

  const wanted = input.accessories ?? [];
  const loaded = await Promise.all(wanted.map(async (placement) => ({ placement, image: await loadAccessory(env, placement) })));
  const worn = loaded.filter((entry): entry is Loaded => entry.image !== null);
  await env.fontsReady();

  draw(canvas, input, body, portrait.ground, worn);
  try {
    return { blob: await toBlob(canvas), width: layout.width, height: layout.height, skippedAccessories: wanted.length - worn.length };
  } catch (error) {
    if (error instanceof PhotoError || worn.length === 0) throw error instanceof PhotoError ? error : new PhotoError('The picture could not be saved as an image.');
    // Something worn made the canvas unreadable after all: the picture again, on a fresh canvas, with nothing worn
    const clean = env.createCanvas(layout.width, layout.height);
    if (!clean) throw new PhotoError('This browser cannot draw the picture.');
    draw(clean, input, body, portrait.ground, []);
    try {
      return { blob: await toBlob(clean), width: layout.width, height: layout.height, skippedAccessories: wanted.length };
    } catch {
      throw new PhotoError('The picture could not be saved as an image.');
    }
  }
}
