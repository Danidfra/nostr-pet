import { FLOOR_BAND } from '../scene/geometry';
import { SceneBackdrop } from '../scene/SceneBackdrop';
import type { RoomId } from './rooms';

/**
 * The room behind everything, per room. Every colour is a phase token set by
 * the environment (`--wall`, `--sky-top`, `--grass`, ...), so each room is
 * dawn, day, sunset and night with the same markup. Nothing here is
 * interactive; furniture is placed by the overview as scene objects.
 *
 *   home      the living room: wall, window onto the Island sky, lamp, floor, rug
 *   bedroom   a dimmer wall, a small high window, the lamp always on, a bigger rug
 *   garden    the sky itself, far hills, a fence at the horizon, grass for a floor
 */
export function RoomBackdrop({ room }: { room: RoomId }) {
  if (room === 'home') return <SceneBackdrop />;
  const floorTop = FLOOR_BAND.top * 100;
  if (room === 'bedroom') {
    return (
      <div className="scene-layer scene-backdrop" aria-hidden data-testid="scene-backdrop" data-room="bedroom">
        <div className="backdrop-wall backdrop-wall--bedroom" />
        <div className="backdrop-window backdrop-window--small">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="bedroom-window-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--sky-top)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--sky-bottom)' }} />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="url(#bedroom-window-sky)" />
            <g style={{ opacity: 'var(--stars)' } as React.CSSProperties} fill="#fff">
              <circle cx="24" cy="30" r="1.3" />
              <circle cx="66" cy="18" r="1" />
              <circle cx="78" cy="52" r="1.4" />
              <circle cx="40" cy="62" r="0.8" />
            </g>
            <rect x="49" y="0" width="2" height="100" fill="var(--wall-shade)" />
          </svg>
          <div className="backdrop-window-frame" />
        </div>
        <div className="backdrop-lamp backdrop-lamp--always" />
        <div className="backdrop-picture" />
        <div className="backdrop-floor" style={{ top: `${floorTop}%` }}>
          <div className="backdrop-floor-edge" />
          <div className="backdrop-rug backdrop-rug--wide" />
        </div>
      </div>
    );
  }
  return (
    <div className="scene-layer scene-backdrop" aria-hidden data-testid="scene-backdrop" data-room="garden">
      <div className="backdrop-sky">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="backdrop-stars">
          <g style={{ opacity: 'var(--stars)' } as React.CSSProperties} fill="#fff">
            <circle cx="8" cy="12" r="0.5" />
            <circle cx="22" cy="28" r="0.4" />
            <circle cx="35" cy="8" r="0.6" />
            <circle cx="52" cy="20" r="0.4" />
            <circle cx="64" cy="6" r="0.5" />
            <circle cx="78" cy="24" r="0.6" />
            <circle cx="90" cy="10" r="0.4" />
            <circle cx="45" cy="34" r="0.3" />
            <circle cx="72" cy="38" r="0.4" />
          </g>
        </svg>
        <div className="backdrop-sun" />
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="backdrop-hills" style={{ top: `calc(${floorTop}% - 9rem)` }}>
        <path d="M0 40 C 12 22, 26 20, 40 30 C 52 38, 60 18, 76 24 C 88 28, 94 22, 100 26 L 100 40 Z" fill="var(--hill)" />
        <path d="M0 40 C 18 34, 30 26, 48 34 C 62 40, 74 30, 100 36 L 100 40 Z" fill="var(--hill)" opacity="0.8" />
      </svg>
      <div className="backdrop-fence" style={{ top: `calc(${floorTop}% - 2.6rem)` }}>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="backdrop-fence__post" />
        ))}
      </div>
      <div className="backdrop-floor backdrop-floor--grass" style={{ top: `${floorTop}%` }}>
        <div className="backdrop-floor-edge" />
        <div className="backdrop-rug backdrop-rug--patch" />
      </div>
    </div>
  );
}
