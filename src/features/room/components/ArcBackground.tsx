/**
 * Ditto's `ArcBackground` (`ditto/src/components/ArcBackground.tsx`), the
 * two variants the room uses: the dock's subtle upward arc and the header's
 * downward one. One SVG path each, a semi-transparent fill and a hairline
 * along the curve, stretched to the bar it sits behind.
 */
import type { CSSProperties } from 'react';
import { cx } from '../lib/cx';

/** Overhang of the header's downward arc, and of the dock's subtle upward arc. */
const ARC_OVERHANG_PX = 20;
const ARC_UP_SUBTLE_OVERHANG_PX = 12;

const ARC_DOWN_PATH = 'M0,0 L100,0 L100,44 Q50,64 0,44 Z';
const ARC_UP_SUBTLE_PATH = 'M0,12 Q50,2 100,12 L100,64 L0,64 Z';

const downStyle: CSSProperties = { height: `calc(100% + ${ARC_OVERHANG_PX}px)` };
const upSubtleStyle: CSSProperties = { height: `calc(100% + ${ARC_UP_SUBTLE_OVERHANG_PX}px)` };

export function ArcBackground({ variant, className }: { variant: 'down' | 'up-subtle'; className?: string }) {
  const up = variant === 'up-subtle';
  return (
    <svg
      className={cx(up ? 'absolute bottom-0 left-0 right-0' : 'absolute inset-0', 'w-full pointer-events-none', className)}
      viewBox="0 0 100 64"
      preserveAspectRatio="none"
      style={up ? upSubtleStyle : downStyle}
      aria-hidden
    >
      <path d={up ? ARC_UP_SUBTLE_PATH : ARC_DOWN_PATH} className="fill-background/85" />
      {up ? (
        <path d="M0,12 Q50,2 100,12" fill="none" className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ) : (
        <path d="M0,44 Q50,64 100,44" fill="none" className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
