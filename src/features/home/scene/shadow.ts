import type { CSSProperties } from 'react';

/** How flat the ground shadow is: its height over its width. */
const SHADOW_FLATNESS = 0.17;

/**
 * Where the ground shadow goes for a drawing whose footprint the renderer
 * measured, as CSS variables in percent of the actor's box: centred under
 * the footprint, on the ground line, as wide as the footprint. Null when the
 * artwork carries no footprint.
 */
export function shadowFor(anchors: { groundY: number; footprint?: { centerX: number; width: number } }): CSSProperties | null {
  const { footprint, groundY } = anchors;
  if (!footprint) return null;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const height = footprint.width * SHADOW_FLATNESS;
  return { '--shadow-left': pct(footprint.centerX), '--shadow-top': pct(groundY - height / 2), '--shadow-width': pct(footprint.width), '--shadow-height': pct(height) } as CSSProperties;
}
