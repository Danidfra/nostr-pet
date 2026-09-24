/**
 * Room surfaces: a wall and a floor described as data, never as CSS.
 *
 * The schema is Ditto's (`room_layouts` v1: style, a palette of validated
 * hex colours, a variant, an angle), so a surface a player designed there
 * could be read here one day. Only the generator turns it into a CSS
 * background string; nothing accepts raw CSS, class names or markup.
 */

export const WALL_STYLES = ['solid', 'stripes', 'dots', 'gradient'] as const;
export type WallStyle = (typeof WALL_STYLES)[number];

export const FLOOR_STYLES = ['solid', 'wood', 'tile', 'carpet'] as const;
export type FloorStyle = (typeof FLOOR_STYLES)[number];

export const SURFACE_VARIANTS = ['soft', 'medium', 'bold', 'wide', 'narrow'] as const;
export type SurfaceVariant = (typeof SURFACE_VARIANTS)[number];

export interface SurfaceLayout {
  style: WallStyle | FloorStyle;
  /** One to four validated hex colours (`#rgb`, `#rrggbb`, `#rrggbbaa`). */
  palette: string[];
  variant?: SurfaceVariant;
  /** Pattern rotation in degrees, 0–359. */
  angle?: number;
}

export interface RoomSurfaces {
  wall: SurfaceLayout;
  floor: SurfaceLayout;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

/** A surface from untrusted data, or `undefined`: never throws, never keeps a field it did not validate. */
export function parseSurface(raw: unknown, kind: 'wall' | 'floor'): SurfaceLayout | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const styles: readonly string[] = kind === 'wall' ? WALL_STYLES : FLOOR_STYLES;
  if (typeof r.style !== 'string' || !styles.includes(r.style)) return undefined;
  if (!Array.isArray(r.palette)) return undefined;
  const palette = r.palette.filter(isHexColor).slice(0, 4);
  if (palette.length === 0) return undefined;
  const surface: SurfaceLayout = { style: r.style as WallStyle | FloorStyle, palette };
  if (typeof r.variant === 'string' && (SURFACE_VARIANTS as readonly string[]).includes(r.variant)) surface.variant = r.variant as SurfaceVariant;
  if (typeof r.angle === 'number' && Number.isFinite(r.angle)) surface.angle = ((Math.round(r.angle) % 360) + 360) % 360;
  return surface;
}

function angleDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

/**
 * The CSS `background` for a surface. Pattern sizes are in pixels on
 * purpose: a plank is a texture, not a coordinate, and reads the same at
 * every canvas size. `scale` shrinks patterns for small previews.
 */
export function surfaceBackground(surface: SurfaceLayout, scale = 1): string {
  const [c1, c2] = surface.palette;
  if (!c1) return '#ccc';
  const angle = surface.angle ?? 0;
  switch (surface.style) {
    case 'solid':
      return c1;
    case 'gradient':
      return c2 ? `linear-gradient(${angle || 180}deg, ${c1} 0%, ${c2} 100%)` : c1;
    case 'stripes': {
      const baseSize = surface.variant === 'narrow' ? 8 : surface.variant === 'wide' ? 24 : 14;
      const size = Math.round(baseSize * scale);
      const accentAlpha = surface.variant === 'soft' ? '90' : surface.variant === 'bold' ? '' : 'cc';
      const accent = c2 ? `${c2}${accentAlpha}` : c1;
      return `repeating-linear-gradient(${angle || 180}deg, ${c1} 0px, ${c1} ${size}px, ${accent} ${size}px, ${accent} ${size * 2}px)`;
    }
    case 'dots': {
      const dotSize = Math.round(20 * scale);
      const radius = Math.max(1.5, 3 * scale);
      const rad = (angle * Math.PI) / 180;
      const offsetX = Math.round(Math.cos(rad) * dotSize * 0.4);
      const offsetY = Math.round(Math.sin(rad) * dotSize * 0.4);
      return c2 ? `radial-gradient(circle ${radius}px at ${dotSize / 2}px ${dotSize / 2}px, ${c2} ${radius * 0.7}px, transparent ${radius}px) ${offsetX}px ${offsetY}px / ${dotSize}px ${dotSize}px, ${c1}` : c1;
    }
    case 'wood': {
      const baseWidth = surface.variant === 'narrow' ? 8 : surface.variant === 'wide' ? 22 : 14;
      const grainWidth = surface.variant === 'bold' ? 4 : surface.variant === 'soft' ? 1 : 2;
      const plank = Math.round(baseWidth * scale);
      const grain = Math.max(1, Math.round(grainWidth * scale));
      return c2 ? `repeating-linear-gradient(${angle || 90}deg, ${c1} 0px, ${c1} ${plank}px, ${c2} ${plank}px, ${c2} ${plank + grain}px)` : c1;
    }
    case 'tile': {
      const tile = Math.round(28 * scale);
      const grout = Math.max(1, Math.round(2 * scale));
      const groutColor = c2 ? `${c2}60` : '#00000020';
      const norm = ((angle % 360) + 360) % 360;
      const diagonal = [45, 135, 225, 315].some((d) => angleDistance(norm, d) <= 10);
      if (diagonal) {
        const diag = Math.round(tile * 0.707);
        return [
          `repeating-linear-gradient(45deg, ${groutColor} 0px, ${groutColor} ${grout}px, transparent ${grout}px, transparent ${diag}px)`,
          `repeating-linear-gradient(-45deg, ${groutColor} 0px, ${groutColor} ${grout}px, transparent ${grout}px, transparent ${diag}px)`,
          c1,
        ].join(', ');
      }
      return [
        `repeating-linear-gradient(0deg, ${groutColor} 0px, ${groutColor} ${grout}px, transparent ${grout}px, transparent ${tile}px)`,
        `repeating-linear-gradient(90deg, ${groutColor} 0px, ${groutColor} ${grout}px, transparent ${grout}px, transparent ${tile}px)`,
        c1,
      ].join(', ');
    }
    case 'carpet':
      return c2 ? `linear-gradient(${angle || 135}deg, ${c1} 0%, ${c2} 100%)` : c1;
    default:
      return c1;
  }
}
