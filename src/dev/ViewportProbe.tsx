/**
 * A live readout of the viewport (M15, dev only): what a phone really shows
 * when "the page zoomed by itself". `visualViewport.scale` is the pinch or
 * focus zoom the browser applied (1 is none); its width against
 * `innerWidth` and the document's `clientWidth` tells a layout wider than
 * the device (the browser then zooms OUT to fit) from a zoom IN; the device
 * pixel ratio and the safe areas complete the picture. Refreshed on every
 * resize and scroll of the visual viewport, so a focus zoom is caught as it
 * happens. Numbers only, nothing of the player's.
 */
import { useEffect, useState } from 'react';

interface ViewportReading {
  scale: number | null;
  visualWidth: number | null;
  visualHeight: number | null;
  innerWidth: number;
  innerHeight: number;
  clientWidth: number;
  scrollWidth: number;
  dpr: number;
  safeArea: string;
  activeElement: string;
}

function read(): ViewportReading {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const safe = ['top', 'right', 'bottom', 'left'].map((side) => style.getPropertyValue(`--probe-safe-${side}`).trim() || '?').join(' ');
  const active = document.activeElement;
  return {
    scale: vv ? Math.round(vv.scale * 1000) / 1000 : null,
    visualWidth: vv ? Math.round(vv.width) : null,
    visualHeight: vv ? Math.round(vv.height) : null,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    dpr: window.devicePixelRatio,
    safeArea: safe,
    activeElement: active && active !== document.body ? `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''}` : 'none',
  };
}

export function ViewportProbe() {
  const [reading, setReading] = useState<ViewportReading | null>(null);
  useEffect(() => {
    // The safe areas as CSS sees them, read back through custom properties on the root
    const root = document.documentElement;
    for (const side of ['top', 'right', 'bottom', 'left']) root.style.setProperty(`--probe-safe-${side}`, `env(safe-area-inset-${side}, 0px)`);
    const update = () => setReading(read());
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      for (const side of ['top', 'right', 'bottom', 'left']) root.style.removeProperty(`--probe-safe-${side}`);
    };
  }, []);
  if (!reading) return null;
  const zoomedIn = reading.scale !== null && reading.scale > 1.001;
  const wider = reading.scrollWidth > reading.clientWidth;
  const rows: Array<[string, string]> = [
    ['visualViewport.scale', reading.scale === null ? 'unavailable' : `${reading.scale}${zoomedIn ? '  ← zoomed in' : ''}`],
    ['visualViewport', reading.visualWidth === null ? 'unavailable' : `${reading.visualWidth} × ${reading.visualHeight}`],
    ['window.inner', `${reading.innerWidth} × ${reading.innerHeight}`],
    ['html.clientWidth / scrollWidth', `${reading.clientWidth} / ${reading.scrollWidth}${wider ? '  ← wider than the viewport' : ''}`],
    ['devicePixelRatio', String(reading.dpr)],
    ['safe-area (t r b l)', reading.safeArea],
    ['focused', reading.activeElement],
  ];
  return (
    <dl className="dev-panel__list" data-testid="viewport-probe" data-zoomed={zoomedIn ? 'true' : 'false'} data-wider={wider ? 'true' : 'false'}>
      {rows.map(([k, v]) => (
        <div key={k} className="dev-panel__row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
