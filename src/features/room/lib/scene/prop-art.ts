/**
 * The pictures the room's props are made of, drawn on canvases the scene
 * turns into textures: the food on a dish (the item's own emoji or image,
 * with bites taken out of it), and the ball's skin. Paper-toned, like the
 * furniture; nothing here touches three.js, and every function returns
 * null when the browser gives the canvas no 2D context (the scene then
 * draws a plain shape instead, as it does for the paper surfaces).
 */
import type { PropGlyph } from '../room-props';

/** The side of a food picture, px. */
export const FOOD_PX = 192;

/** The emoji fonts, in the order the platforms have them. */
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

/** Where each bite is taken from the picture (fractions of its side, from the centre) and how big it is. */
const BITES: readonly { x: number; y: number; r: number }[] = [
  { x: 0.34, y: -0.22, r: 0.27 },
  { x: -0.36, y: -0.28, r: 0.25 },
  { x: 0.3, y: 0.3, r: 0.26 },
  { x: -0.3, y: 0.3, r: 0.24 },
  { x: 0, y: -0.38, r: 0.26 },
  { x: 0.02, y: 0.4, r: 0.26 },
];

/** A plain shape in a category's colour, for an item with neither emoji nor picture. */
const CATEGORY_TONE: Record<string, string> = { food: '#e4a35a', energy: '#8ec9f0', toy: '#f2a4c5', hygiene: '#9fd8e8', medicine: '#c6b7f0', unknown: '#cfc7ba' };

function context(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** The food, whole: the emoji large in the middle, or the image, or a round shape in the category's colour. */
export function drawFood(glyph: PropGlyph, image: HTMLImageElement | null = null): HTMLCanvasElement | null {
  const ctx = context(FOOD_PX, FOOD_PX);
  if (!ctx) return null;
  const c = ctx.canvas;
  const s = FOOD_PX;
  if (image && image.naturalWidth > 0) {
    const scale = Math.min((s * 0.84) / image.naturalWidth, (s * 0.84) / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    try {
      ctx.drawImage(image, (s - w) / 2, (s - h) / 2, w, h);
      return c;
    } catch {
      ctx.clearRect(0, 0, s, s);
    }
  }
  if (glyph.emoji) {
    ctx.font = `${Math.round(s * 0.76)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(glyph.emoji, s / 2, s * 0.55);
    return c;
  }
  const tone = CATEGORY_TONE[glyph.category ?? 'unknown'] ?? CATEGORY_TONE.unknown;
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.55, s * 0.3, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(s * 0.42, s * 0.46, s * 0.1, s * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/**
 * Bites out of the food: `taken` of `of` crescents cleared from the picture,
 * each where a mouth would reach, so the apple is plainly being eaten and
 * the last bite leaves nothing. Draws into a copy, so the whole food stays
 * for the next dish.
 */
export function biteFood(whole: HTMLCanvasElement, taken: number, of: number): HTMLCanvasElement | null {
  const ctx = context(whole.width, whole.height);
  if (!ctx) return null;
  const s = whole.width;
  if (taken >= of) return ctx.canvas; // eaten up: nothing left on the dish
  ctx.drawImage(whole, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  const share = Math.min(1, taken / Math.max(1, of));
  // Fewer bites than a food takes: each bite is bigger, so the food still goes down by the end
  const grow = 1 + (1 - Math.min(1, of / BITES.length)) * 0.5;
  for (let i = 0; i < Math.min(taken, BITES.length); i++) {
    const b = BITES[i];
    ctx.beginPath();
    ctx.arc(s / 2 + b.x * s, s * 0.55 + b.y * s, b.r * s * grow, 0, Math.PI * 2);
    ctx.fill();
  }
  // Past the pictured bites: the rest of the food goes in shrinking rings from the outside in
  if (taken > BITES.length) {
    const left = 1 - (taken - BITES.length) / Math.max(1, of - BITES.length);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.55, s * 0.5 * Math.max(0.1, left), 0, Math.PI * 2);
    ctx.fill();
  }
  void share;
  return ctx.canvas;
}

/**
 * The ball's skin: cream paper with two soft bands of colour round it, so
 * the roll shows. Wrapped round a sphere: the texture's x is the way round,
 * its y pole to pole.
 */
export function drawBallSkin(): HTMLCanvasElement | null {
  const w = 256;
  const h = 128;
  const ctx = context(w, h);
  if (!ctx) return null;
  ctx.fillStyle = '#f6efe2';
  ctx.fillRect(0, 0, w, h);
  // Two bands, a coral and a blue, round the ball, with a soft edge
  const band = (y: number, height: number, color: string) => {
    const g = ctx.createLinearGradient(0, y - height / 2, 0, y + height / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.18, color);
    g.addColorStop(0.82, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - height / 2, w, height);
  };
  band(h * 0.36, h * 0.2, '#e8705f');
  band(h * 0.66, h * 0.17, '#5b93d6');
  // Pentagons' worth of darker spots, few, so it reads as a ball turning without being a pattern
  ctx.fillStyle = 'rgba(60,40,30,0.16)';
  for (const [x, y, r] of [[0.12, 0.5, 0.045], [0.5, 0.5, 0.05], [0.86, 0.5, 0.045], [0.3, 0.15, 0.04], [0.7, 0.85, 0.04]] as const) {
    ctx.beginPath();
    ctx.ellipse(x * w, y * h, r * w, r * w * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Paper grain
  for (let i = 0; i < 260; i++) {
    const x = ((i * 7919) % 997) / 997 * w;
    const y = ((i * 104729) % 991) / 991 * h;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  return ctx.canvas;
}

/** Load a vetted image for a food picture; resolves null when it cannot be had (a dead link, a host that forbids it). */
export function loadFoodImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
