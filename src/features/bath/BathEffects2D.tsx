/**
 * What a care ritual leaves on the Blobbi's drawing (the 2D home's actor, the
 * room's Classic drawing): the foam on the cells the machine counts foamed,
 * the wet sheen on the wet ones, the shower's rain while it is held, and the
 * tool at its head (resting, with a gentle invitation, while nothing is
 * pressed). Laid in the Blobbi's art box (the anchor is the box it is mounted
 * in); drawn from the frame alone (`bath-frame.ts`): it decides nothing.
 */
import type { CSSProperties } from 'react';
import { cellCenter, type BathPoint } from './bath-machine';
import { foamedCount, type BathAnchor, type BathFrame } from './bath-frame';
import { BathToolArt } from './BathTools';
import './bath.css';

interface BathEffects2DProps {
  frame: BathFrame;
  /** The box it is drawn in (its size on screen). */
  anchor?: Extract<BathAnchor, { kind: 'box' }>;
}

const toSvg = (p: BathPoint) => ({ x: p.x * 100, y: (1 - p.y) * 100 });

export function BathEffects2D({ frame }: BathEffects2DProps) {
  const stage = frame.stage;
  const tool = frame.tool;
  const toolAt = tool ? toSvg(tool.at) : null;
  const rinsing = stage?.kind === 'rinse';
  const raining = rinsing && !!tool?.pressed;
  const bottom = (1 - frame.outline.bottom) * 100;
  const showWet = frame.cells.some((c) => c.wet);
  return (
    <>
      <svg className="bath-layer__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false" data-testid="bath-effects">
        {/* Wet: a sheen where the water has been */}
        {showWet && (
          <g className="bath-wet" data-testid="bath-wet">
            {frame.cells.map((cell, i) => {
              if (!cell.wet) return null;
              const c = toSvg(cellCenter(frame.grid, i));
              return <circle key={i} cx={c.x} cy={c.y} r={6.8} fill="#38bdf8" opacity={0.26} />;
            })}
          </g>
        )}
        {/* Foam on every cell the machine counts foamed: a bubble each */}
        <g className="bath-foam" data-testid="bath-foam" data-count={foamedCount(frame)}>
          {frame.cells.map((cell, i) => {
            if (!cell.foamed) return null;
            const c = toSvg(cellCenter(frame.grid, i));
            const r = 9.2;
            const wobble = ((i * 7) % 5) - 2;
            return (
              <g key={i} className="bath-foam__cell" style={{ '--i': i % 6 } as CSSProperties}>
                <circle cx={c.x + wobble * 0.4} cy={c.y - wobble * 0.3} r={r} fill="#fff" opacity={0.96} />
                <circle cx={c.x + wobble * 0.4 - r * 0.35} cy={c.y - wobble * 0.3 - r * 0.35} r={r * 0.22} fill="#e0f2fe" opacity="0.9" />
              </g>
            );
          })}
        </g>
        {/* The shower's rain while it is held: drops from the head down to the feet, and the splash where they land */}
        {rinsing && toolAt && (
          <g className="bath-rain" data-testid="bath-rain" data-raining={raining ? 'true' : 'false'} style={{ '--fall': `${Math.max(8, bottom - toolAt.y)}` } as CSSProperties}>
            {raining && [-9, -5.5, -2, 1.5, 5, 8.5].map((dx, i) => (
              <ellipse key={dx} className="bath-drop" style={{ '--delay': `${i * 90}ms` } as CSSProperties} cx={toolAt.x + dx} cy={toolAt.y + 4} rx={1.1} ry={2.4} fill="#7dd3fc" opacity="0.85" />
            ))}
            {raining && [-10, -4, 3, 9].map((dx, i) => (
              <circle key={dx} className="bath-splash" style={{ '--delay': `${i * 140}ms` } as CSSProperties} cx={toolAt.x + dx} cy={bottom} r={1.6} fill="#bae6fd" opacity="0.9" />
            ))}
          </g>
        )}
      </svg>
      {tool && toolAt && (
        <div className="bath-layer__tool" data-testid="bath-tool-in-hand" data-tool={tool.kind} data-style={frame.style} data-resting={tool.pressed ? 'false' : 'true'} style={{ left: `${toolAt.x}%`, top: `${toolAt.y}%` }} aria-hidden>
          <BathToolArt tool={tool.kind} className="bath-layer__tool-art" />
        </div>
      )}
    </>
  );
}
