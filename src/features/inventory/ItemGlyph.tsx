import { useEffect, useState } from 'react';
import { Apple, Bath, Coins, Gamepad2, HelpCircle, Pill, Shirt, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import type { ItemGlyph as Glyph } from './item-model';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: Apple,
  toy: Gamepad2,
  hygiene: Bath,
  medicine: Pill,
  energy: Zap,
  currency: Coins,
  cosmetic: Shirt,
  effect: Sparkles,
  care: Apple,
  unknown: HelpCircle,
};

interface ItemGlyphProps {
  glyph: Glyph;
  /** CSS size, e.g. "2.5rem". Ignored when `fill` is set. */
  size?: string;
  /** Fill the parent box; the parent's CSS decides the size (the item in the room). */
  fill?: boolean;
  className?: string;
}

/**
 * An item's picture, safely: a raster image from an allow-listed https host
 * (already vetted by `resolveHomeItem`), or the definition's emoji, or a
 * category icon. An image that fails to load falls back the same way, so a
 * dead link never shows the browser's broken-image placeholder. Never remote
 * markup. Decorative: the name is text beside it.
 */
export function ItemGlyph({ glyph, size = '2.5rem', fill = false, className = '' }: ItemGlyphProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  useEffect(() => setFailedUrl(null), [glyph]);
  const box = fill ? { width: '100%', height: '100%' } : { width: size, height: size };

  if (glyph.type === 'image' && failedUrl !== glyph.url) {
    return (
      <img
        src={glyph.url}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailedUrl(glyph.url)}
        className={`item-glyph item-glyph--image ${className}`}
        style={box}
      />
    );
  }
  if (glyph.type === 'emoji') {
    return (
      <span aria-hidden className={`item-glyph item-glyph--emoji ${className}`} style={fill ? box : { ...box, fontSize: `calc(${size} * 0.62)` }}>
        {glyph.text}
      </span>
    );
  }
  const category = glyph.type === 'category' ? glyph.category : 'unknown';
  const Icon = CATEGORY_ICONS[category] ?? HelpCircle;
  return (
    <span aria-hidden className={`item-glyph item-glyph--icon ${className}`} style={box}>
      <Icon style={fill ? { width: '55%', height: '55%' } : { width: `calc(${size} * 0.55)`, height: `calc(${size} * 0.55)` }} />
    </span>
  );
}
