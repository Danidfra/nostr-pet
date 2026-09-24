import type { CSSProperties } from 'react';
import type { RoomDefinition } from './rooms';
import { surfaceBackground } from './surfaces';

/**
 * The room behind everything: the wall down to the horizon and the floor
 * below it, painted from the room's surface data across the whole viewport
 * (bleed included), with decor and lighting in canvas coordinates. The
 * horizon is `--horizon`, where the canvas's floor line lands; a phase tint
 * on top keeps every room on the Island clock. Nothing here is interactive.
 */
export function RoomBackdrop({ room }: { room: RoomDefinition }) {
  return (
    <div className="scene-layer scene-backdrop" aria-hidden data-testid="scene-backdrop" data-room={room.id}>
      <div className="backdrop-wall" style={{ background: surfaceBackground(room.surfaces.wall) }} />
      <div className="backdrop-floor" style={{ top: 'var(--horizon)', background: surfaceBackground(room.surfaces.floor) }}>
        <div className="backdrop-floor-edge" />
      </div>
      <div className="backdrop-canvas">
        {room.decor.includes('tiles-band') && <div className="decor-tiles-band" />}
        {(room.decor.includes('window') || room.decor.includes('window-small')) && <Window small={!room.decor.includes('window')} />}
        {room.decor.includes('lamp-glow') && <div className="decor-lamp-glow" />}
        {room.decor.includes('wardrobe') && <Wardrobe />}
      </div>
      <div className="backdrop-lighting" />
    </div>
  );
}

function Window({ small }: { small: boolean }) {
  const style: CSSProperties = small ? { left: '64%', top: '12%', width: '20%' } : { left: '60%', top: '12%', width: '26%' };
  return (
    <div className={`decor-window ${small ? 'decor-window--small' : ''}`} style={style}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={`window-sky-${small ? 's' : 'l'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--sky-top)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--sky-bottom)' }} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={`url(#window-sky-${small ? 's' : 'l'})`} />
        <g style={{ opacity: 'var(--stars)' } as CSSProperties} fill="#fff">
          <circle cx="18" cy="22" r="1.2" />
          <circle cx="42" cy="12" r="0.9" />
          <circle cx="70" cy="28" r="1.4" />
          <circle cx="86" cy="14" r="0.8" />
          <circle cx="58" cy="44" r="0.7" />
          <circle cx="30" cy="52" r="1" />
        </g>
        <rect x="49" y="0" width="2" height="100" fill="hsl(0 0% 100% / 0.7)" />
        {!small && <rect x="0" y="49" width="100" height="2" fill="hsl(0 0% 100% / 0.7)" />}
      </svg>
      <div className="decor-window__frame" />
      <div className="decor-window__light" />
    </div>
  );
}

function Wardrobe() {
  return (
    <svg viewBox="0 0 120 150" className="decor-wardrobe" style={{ left: '22%', top: '18%', width: '30%' }}>
      <rect x="4" y="4" width="112" height="142" rx="6" fill="#8b5e3c" />
      <rect x="10" y="10" width="48" height="118" rx="3" fill="#a9734a" />
      <rect x="62" y="10" width="48" height="118" rx="3" fill="#a9734a" />
      <circle cx="52" cy="70" r="3" fill="#f5e6c8" />
      <circle cx="68" cy="70" r="3" fill="#f5e6c8" />
      <rect x="10" y="132" width="100" height="10" rx="2" fill="#6b4425" />
    </svg>
  );
}
