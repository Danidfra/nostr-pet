import { FLOOR_BAND } from './geometry';

/**
 * The room, in layers behind everything that stands on the floor:
 *
 *   wall          the back wall, lit by the phase (`--wall`, `--wall-shade`)
 *   window        a window onto the Island sky (`--sky-top`, `--sky-bottom`, `--stars`)
 *   lamp          a warm pool of light at night (`--lamp`)
 *   floor         the floor band from the horizon down (`--floor`, `--floor-edge`)
 *   rug           a round rug where the Blobbi usually stands (`--rug`)
 *
 * Every colour is a CSS custom property set by the environment, so the same
 * markup is dawn, day, sunset or night. Nothing here is interactive.
 */
export function SceneBackdrop() {
  const floorTop = FLOOR_BAND.top * 100;
  return (
    <div className="scene-layer scene-backdrop" aria-hidden data-testid="scene-backdrop">
      <div className="backdrop-wall" />
      <div className="backdrop-window">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="home-window-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--sky-top)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--sky-bottom)' }} />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#home-window-sky)" />
          <g style={{ opacity: 'var(--stars)' } as React.CSSProperties} fill="#fff">
            <circle cx="18" cy="22" r="1.2" />
            <circle cx="42" cy="12" r="0.9" />
            <circle cx="70" cy="28" r="1.4" />
            <circle cx="86" cy="14" r="0.8" />
            <circle cx="58" cy="44" r="0.7" />
            <circle cx="30" cy="52" r="1" />
          </g>
          <rect x="49" y="0" width="2" height="100" fill="var(--wall-shade)" />
          <rect x="0" y="49" width="100" height="2" fill="var(--wall-shade)" />
        </svg>
        <div className="backdrop-window-frame" />
        <div className="backdrop-window-light" />
      </div>
      <div className="backdrop-lamp" />
      <div className="backdrop-floor" style={{ top: `${floorTop}%` }}>
        <div className="backdrop-floor-edge" />
        <div className="backdrop-rug" />
      </div>
    </div>
  );
}
