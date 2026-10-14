/**
 * The 2D home's tub, in two layers with the Blobbi between them: the BACK
 * (the whole shell seen from the front, its rim, the water's far surface)
 * stands behind the Blobbi; the FRONT (the near wall from the rim's front
 * edge down to the feet, with the water lapping its edge) stands in front
 * of it, so the Blobbi's lower body is in the water and the rim crosses it.
 * Both are anchored at the tub's feet like any piece of furniture
 * (`FurnitureLayer`: canvas coordinates, width in canvas units, a little
 * smaller toward the back), with the z-indexes the home gives them around
 * the Blobbi's own.
 *
 * Procedural SVG, no asset: the water shows foam while the soap is on and
 * ripples under the shower (the stylesheet animates them; reduced motion
 * stills them). The home's classic `/furniture/tub.svg` (the medicine's
 * tub) is drawn from the same shapes.
 */
import type { CSSProperties } from 'react';
import { depthScale } from '@/features/home/scene/geometry';
import { floorFromRoom, roomToCss } from '@/features/home/space/room-space';
import { furnitureById, type Placement } from '@/features/home/rooms';
import type { BathStage } from './bath-machine';
import './bath.css';

export type BathTubPart = 'back' | 'front';
export type BathTubPhase = 'in' | 'using' | 'out';

interface BathTub2DProps {
  placement: Placement;
  part: BathTubPart;
  zIndex: number;
  phase: BathTubPhase;
  stage: BathStage | null;
  reducedMotion: boolean;
}

/** The tub's drawing box (the classic asset's), and where its rim's front edge crosses. */
export const TUB_ART = { width: 160, height: 110, rimY: 40, rimRy: 14, waterY: 44 } as const;

export function BathTub2D({ placement, part, zIndex, phase, stage, reducedMotion }: BathTub2DProps) {
  const def = furnitureById(placement.id);
  const css = roomToCss(placement);
  const baseWidth = def?.baseWidth ?? 0.34;
  const aspect = def?.aspectRatio ?? TUB_ART.width / TUB_ART.height;
  const width = baseWidth * (placement.scale ?? 1);
  const scale = depthScale(floorFromRoom({ x: placement.x, y: placement.y }).y);
  const style = {
    left: css.left,
    top: css.top,
    zIndex,
    '--object-width': `${(width * 100).toFixed(3)}%`,
    '--object-scale': String(scale),
    '--object-aspect': String(aspect),
  } as CSSProperties;
  return (
    <div className="bath-tub" data-testid="bath-tub" data-tub-part={part} data-phase={phase} data-stage={stage ?? ''} data-reduced={reducedMotion ? 'true' : undefined} style={style} aria-hidden>
      <svg viewBox={`0 0 ${TUB_ART.width} ${TUB_ART.height}`} className="bath-tub__art" focusable="false">
        {part === 'back' ? <TubBack stage={stage} /> : <TubFront stage={stage} />}
      </svg>
    </div>
  );
}

const SHELL = '#f6f9fc';
const SHELL_SHADE = '#d7e1ec';
const SHELL_LINE = '#9fb3c8';
const WATER = '#8fd3f4';
const WATER_DEEP = '#5fb8e8';

/** The outer shell: from the rim's left end down round the bottom and up to its right end. */
const SHELL_PATH = 'M 10 40 C 10 64, 16 86, 36 94 C 52 100, 108 100, 124 94 C 144 86, 150 64, 150 40 Z';

function TubBack({ stage }: { stage: BathStage | null }) {
  const foamy = stage === 'soap' || stage === 'rinse';
  return (
    <g>
      <defs>
        <linearGradient id="bath-tub-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SHELL} />
          <stop offset="1" stopColor={SHELL_SHADE} />
        </linearGradient>
        <linearGradient id="bath-tub-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={WATER} />
          <stop offset="1" stopColor={WATER_DEEP} />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="102" rx="68" ry="6" fill="#000" opacity="0.14" />
      {/* The shell, the far inner wall and the rim */}
      <path d={SHELL_PATH} fill="url(#bath-tub-shell)" stroke={SHELL_LINE} strokeWidth="2.5" />
      <ellipse cx="80" cy={TUB_ART.rimY} rx="70" ry={TUB_ART.rimRy} fill="#e8eff6" stroke={SHELL_LINE} strokeWidth="2.5" />
      <ellipse cx="80" cy={TUB_ART.rimY + 3} rx="62" ry="10" fill="#c3d2e2" />
      {/* The water's surface, with its light and a few bubbles while it is soapy */}
      <ellipse cx="80" cy={TUB_ART.waterY} rx="60" ry="9" fill="url(#bath-tub-water)" />
      <path d="M 34 44 C 46 38, 62 38, 74 43 C 86 48, 102 48, 116 43" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75" className="bath-tub__wave" />
      {foamy && (
        <g className="bath-tub__suds" data-testid="bath-tub-suds">
          <circle cx="40" cy="42" r="5" fill="#fff" opacity="0.95" />
          <circle cx="50" cy="39" r="3.5" fill="#fff" opacity="0.9" />
          <circle cx="112" cy="41" r="4.5" fill="#fff" opacity="0.95" />
          <circle cx="122" cy="44" r="3" fill="#fff" opacity="0.9" />
          <circle cx="98" cy="37" r="2.6" fill="#fff" opacity="0.85" />
        </g>
      )}
      {/* The tap and its spout, on the far rim */}
      <rect x="126" y="12" width="6" height="22" rx="3" fill="#b8c4d1" stroke="#8a9bad" strokeWidth="1" />
      <path d="M129 14 C 129 6, 118 6, 114 11" fill="none" stroke="#b8c4d1" strokeWidth="5" strokeLinecap="round" />
      <circle cx="129" cy="10" r="2" fill="#dbe4ee" />
      <rect x="110" y="11" width="6" height="4" rx="1.5" fill="#8a9bad" />
    </g>
  );
}

function TubFront({ stage }: { stage: BathStage | null }) {
  const rippling = stage === 'rinse';
  return (
    <g>
      <defs>
        <linearGradient id="bath-tub-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SHELL} />
          <stop offset="1" stopColor={SHELL_SHADE} />
        </linearGradient>
        <clipPath id="bath-tub-front-clip">
          {/* The near wall: everything of the shell below the rim's front edge */}
          <path d={`M 10 40 A 70 ${TUB_ART.rimRy} 0 0 0 150 40 C 150 64, 144 86, 124 94 C 108 100, 52 100, 36 94 C 16 86, 10 64, 10 40 Z`} />
        </clipPath>
      </defs>
      {/* The water lapping the near edge: a thin band just inside the rim's front edge */}
      <path d={`M 20 ${TUB_ART.waterY} A 60 9 0 0 0 140 ${TUB_ART.waterY} A 60 ${TUB_ART.rimRy - 2} 0 0 1 20 ${TUB_ART.waterY} Z`} fill={WATER_DEEP} opacity="0.95" className={rippling ? 'bath-tub__lap bath-tub__lap--rippling' : 'bath-tub__lap'} />
      <g clipPath="url(#bath-tub-front-clip)">
        <path d={SHELL_PATH} fill="url(#bath-tub-front)" />
        <path d="M 22 60 C 30 82, 60 92, 80 92 C 100 92, 130 82, 138 60" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      </g>
      <path d={`M 10 40 A 70 ${TUB_ART.rimRy} 0 0 0 150 40`} fill="none" stroke={SHELL_LINE} strokeWidth="2.5" />
      <path d="M 10 40 C 10 64, 16 86, 36 94 C 52 100, 108 100, 124 94 C 144 86, 150 64, 150 40" fill="none" stroke={SHELL_LINE} strokeWidth="2.5" />
      {/* The feet */}
      <path d="M 30 93 q -4 8 -6 12 h 12 q -2 -6 -2 -12 z" fill="#c3d2e2" stroke={SHELL_LINE} strokeWidth="1.5" />
      <path d="M 130 93 q 4 8 6 12 h -12 q 2 -6 2 -12 z" fill="#c3d2e2" stroke={SHELL_LINE} strokeWidth="1.5" />
    </g>
  );
}
