/**
 * Which surface styles take an angle, and which take a detail variant (and
 * which variants): the choices the surface editor offers, as Ditto's.
 */
import type { SurfaceVariant } from '@/features/home/rooms/surfaces';

export function supportsAngle(style: string): boolean {
  return ['stripes', 'gradient', 'dots', 'wood', 'tile', 'carpet'].includes(style);
}

export function getStyleVariants(style: string): SurfaceVariant[] | null {
  switch (style) {
    case 'stripes':
    case 'wood':
      return ['narrow', 'medium', 'wide', 'soft', 'bold'];
    case 'carpet':
      return ['soft', 'medium', 'bold'];
    default:
      return null;
  }
}
