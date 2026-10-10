/**
 * Room surfaces derived from the app's live theme: "Match my theme" in the
 * decorator's wallpaper and flooring tabs. Reads the HSL custom properties
 * the environment sets on the document (`--background`, `--foreground`,
 * `--primary`, `--accent`) and gives each room a look of its own that still
 * belongs to the theme. Ditto's generator as it is, over this app's rooms;
 * without a document (tests) the registry's surfaces are returned.
 */
import type { RoomId } from '@/features/home/rooms/rooms';
import { ROOM_ORDER } from '@/features/home/rooms/rooms';
import type { RoomLayout } from './room-layout';
import { roomLayoutFor } from './room-layout';

type Hsl = [number, number, number];

/** Parse a CSS HSL variable value like "220 14% 96%" into [h, s, l] */
function parseHsl(raw: string): Hsl | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]);
  const l = parseFloat(parts[2]);
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function mixHsl(a: Hsl, b: Hsl, t: number): string {
  return hslToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

function adjustLightness(c: Hsl, delta: number): Hsl {
  return [c[0], c[1], Math.max(0, Math.min(100, c[2] + delta))];
}

function readThemeColors(): { background: Hsl; foreground: Hsl; primary: Hsl; accent: Hsl | null } | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null;
  const style = getComputedStyle(document.documentElement);
  const background = parseHsl(style.getPropertyValue('--background'));
  const foreground = parseHsl(style.getPropertyValue('--foreground'));
  const primary = parseHsl(style.getPropertyValue('--primary'));
  if (!background || !foreground || !primary) return null;
  return { background, foreground, primary, accent: parseHsl(style.getPropertyValue('--accent')) };
}

/** The registry's surfaces for every room: what "match my theme" falls back to without a theme to read. */
function registryLayouts(): Record<RoomId, RoomLayout> {
  return Object.fromEntries(ROOM_ORDER.map((id) => [id, roomLayoutFor(id)])) as Record<RoomId, RoomLayout>;
}

/** Theme-aware room surfaces from the active CSS theme, or the registry's when the theme cannot be read. */
export function getThemeRoomDefaults(): Record<RoomId, RoomLayout> {
  const theme = readThemeColors();
  if (!theme) return registryLayouts();
  const { background: bg, foreground: fg, primary: pr } = theme;
  const ac: Hsl = theme.accent ?? [bg[0] + (pr[0] - bg[0]) * 0.5, bg[1] + (pr[1] - bg[1]) * 0.5, bg[2] + (pr[2] - bg[2]) * 0.5];
  const wallBase = hslToHex(bg[0], bg[1], bg[2]);
  return {
    home: {
      wall: { style: 'gradient', palette: [wallBase, mixHsl(bg, pr, 0.08)] },
      floor: { style: 'wood', palette: [mixHsl(pr, fg, 0.3), mixHsl(pr, fg, 0.45)], variant: 'wide' },
    },
    kitchen: {
      wall: { style: 'solid', palette: [wallBase, mixHsl(bg, fg, 0.06)] },
      floor: { style: 'tile', palette: [mixHsl(bg, fg, 0.03), mixHsl(bg, fg, 0.1)] },
    },
    care: {
      wall: { style: 'solid', palette: [mixHsl(bg, pr, 0.05), mixHsl(bg, pr, 0.1)] },
      floor: { style: 'tile', palette: [mixHsl(bg, ac, 0.06), mixHsl(bg, pr, 0.12)], angle: 45 },
    },
    rest: {
      wall: { style: 'gradient', palette: [wallBase, mixHsl(bg, pr, 0.15)] },
      floor: { style: 'carpet', palette: [mixHsl(pr, bg, 0.55), mixHsl(pr, bg, 0.65)], variant: 'soft' },
    },
    closet: {
      wall: { style: 'solid', palette: [wallBase, mixHsl(bg, fg, 0.08)] },
      floor: { style: 'wood', palette: [hslToHex(...adjustLightness(pr, -8)), hslToHex(...adjustLightness(pr, -18))], variant: 'medium' },
    },
  };
}
