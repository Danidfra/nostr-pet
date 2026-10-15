/**
 * What a care ritual leaves on the Blobbi's drawing (the 2D home's actor,
 * the room's Classic drawing), drawn from the frame alone (`bath-frame.ts`):
 * it decides nothing. Laid in the Blobbi's art box (the anchor is the box it
 * is mounted in, which moves with the actor).
 *
 *   on the body, clipped to its silhouette (the frame's body cells, rounded):
 *     the foam     a bubble on every cell the machine counts foamed, exactly
 *                  those (the soap's white lather; the shampoo's tinted,
 *                  denser one);
 *     the sheen    a glossy highlight over the wet cells, as strong as
 *                  `wetness` (a towel ritual: over every cell not yet rubbed
 *                  dry), and a soft fluff where the towel has been (`dry`);
 *     the streams  thin lines of water running down the body's sides;
 *     the drops    beads that start on the body, slide down it, let go at its
 *                  lowest point under them and fall (outside the clip) to a
 *                  small splash on the ground;
 *   outside it, only what falls: the shower's rain from the head to where it
 *   lands on the body, the falling half of each drop and its splash, and the
 *   one-shot bursts the cues ask for (a splash of water at the feet on
 *   `splash-in` / `splash-out`, a ring of drops flung off on `shake`), each
 *   played once per cue id. The tool follows the frame's point.
 *
 * All motion is the stylesheet's (`bath.css`); about twenty nodes beyond the
 * foam. Reduced motion (the frame's flag) draws no streams, no running or
 * falling drops and no rain, keeps the foam and the sheen still, and lets a
 * burst fade in place: every state stays legible.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { cellCenter } from './bath-machine';
import { cuesAfter, foamedCount, type BathAnchor, type BathCue, type BathFrame } from './bath-frame';
import { BathToolArt } from './BathTools';
import { bodyPath, dropletPlans, insideOutline, isBodyNotDry, isWetNotDry, landingUnder, shapePath, streamPlans, toView } from './effects/body-shape';
import type { BodyOutline } from './body-mask';
import './bath.css';

interface BathEffects2DProps {
  frame: BathFrame;
  /** The box it is drawn in (its size on screen). */
  anchor?: Extract<BathAnchor, { kind: 'box' }>;
  /** The drawing's own outline (the one the body mask was read from): the clip follows its edge; without it, the body cells. */
  outline?: BodyOutline;
}

/** How long a burst stays on screen (ms): past its animation, then unmounted. */
const BURST_MS = 1100;
const BURST_REDUCED_MS = 500;

const RAIN_DX = [-9, -5.5, -2, 1.5, 5, 8.5];
const SHAKE_DROPS = 10;
const SPLASH_DROPS = 8;

export function BathEffects2D({ frame, outline }: BathEffects2DProps) {
  const id = useId();
  const stage = frame.stage;
  const tool = frame.tool;
  const toolAt = tool ? toView(tool.at) : null;
  const raining = stage?.kind === 'rinse' && !!tool?.pressed && tool.kind === 'shower';
  const reduced = frame.reducedMotion;
  const bodyClip = `${id}-body`;
  const sheenClip = `${id}-sheen`;
  const towel = frame.ritual === 'towel';

  // The shapes from the cells: again only when a cell changed (or the outline did)
  const shapes = useMemo(() => {
    const sheenPick = towel ? isBodyNotDry : isWetNotDry;
    const body = bodyPath(frame, outline);
    return {
      body,
      clip: body === shapePath(frame, undefined, 0) ? 'cells' : 'outline',
      sheen: shapePath(frame, sheenPick, 0),
      streams: streamPlans(frame),
      droplets: dropletPlans(frame, 6),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the cells and the outline change only with the revision and the key
  }, [frame.revision, frame.key, frame.grid, frame.outline.bottom, frame.outline.top, towel, outline]);

  // With the drawing's own edge as the clip, an edge cell's bubble is kept just inside it
  const edgeOutline = shapes.clip === 'outline' ? outline : undefined;
  const wetness = frame.wetness;
  const anyWet = frame.cells.some((c) => c.wet && !c.dry);
  const anyDamp = towel ? frame.cells.some((c) => c.body && !c.dry) : anyWet;
  const sheenOpacity = towel ? 0.34 : 0.18 + 0.32 * wetness;
  const streams = reduced ? 0 : raining ? shapes.streams.length : Math.ceil(shapes.streams.length * Math.min(1, wetness * 1.2));
  const droplets = reduced || wetness < 0.2 ? 0 : Math.min(shapes.droplets.length, Math.round(2 + 4 * wetness));
  const bursts = useBursts(frame, reduced);
  const feet = toView({ x: 0.5, y: frame.outline.bottom });
  const centre = toView({ x: 0.5, y: (frame.outline.bottom + frame.outline.top) / 2 });

  return (
    <>
      <svg
        className="bath-layer__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
        data-testid="bath-effects"
        data-ritual={frame.ritual}
        data-style={frame.style}
        data-wetness={wetness.toFixed(2)}
        data-reduced={reduced ? 'true' : 'false'}
        data-clip={shapes.clip}
      >
        <defs>
          <clipPath id={bodyClip} clipPathUnits="userSpaceOnUse">
            <path d={shapes.body} />
          </clipPath>
          <clipPath id={sheenClip} clipPathUnits="userSpaceOnUse">
            <path d={shapes.sheen} />
          </clipPath>
          <radialGradient id={`${id}-foam`} cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#f8fbff" />
            <stop offset="1" stopColor="#dbeafe" />
          </radialGradient>
          <radialGradient id={`${id}-foam-shampoo`} cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#f3e8ff" />
            <stop offset="1" stopColor="#d8b4fe" />
          </radialGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="0.3" stopColor="#e0f2fe" stopOpacity="0.4" />
            <stop offset="0.65" stopColor="#7dd3fc" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0ea5e9" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* On the body only: everything in here is clipped to its silhouette */}
        <g clipPath={`url(#${bodyClip})`} data-testid="bath-on-body">
          {/* The wet sheen, where the water has been, as strong as the wetness; gone where the towel has rubbed */}
          {anyDamp && (
            <g clipPath={`url(#${sheenClip})`}>
              <rect className="bath-sheen" data-testid="bath-sheen" x="0" y="0" width="100" height="100" fill={`url(#${id}-sheen)`} opacity={sheenOpacity} />
            </g>
          )}
          {/* The towel's fluff: a soft warm glow on every cell rubbed dry */}
          <g className="bath-dry" data-testid="bath-dry" data-count={frame.cells.filter((c) => c.dry).length}>
            {frame.cells.map((cell, i) => {
              if (!cell.dry) return null;
              const c = toView(cellCenter(frame.grid, i));
              return <circle key={i} className="bath-dry__cell" cx={c.x} cy={c.y} r={100 / frame.grid / 2 + 1} fill="#fff7ed" opacity="0.38" />;
            })}
          </g>
          {/* Thin streams running down the body's sides and belly while it is wet, and under the shower */}
          <g className="bath-streams" data-testid="bath-streams" data-count={streams}>
            {shapes.streams.slice(0, streams).map((s, i) => (
              <path key={i} className="bath-stream" d={s.d} fill="none" stroke="#bae6fd" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" style={{ '--len': s.length.toFixed(1), '--delay': `${i * 230}ms` } as CSSProperties} />
            ))}
          </g>
          {/* The foam, a bubble on every cell the machine counts foamed, exactly those */}
          <g className="bath-foam" data-testid="bath-foam" data-count={foamedCount(frame)} data-style={frame.style}>
            {frame.cells.map((cell, i) => {
              if (!cell.foamed) return null;
              const at = cellCenter(frame.grid, i);
              const c = toView(edgeOutline ? insideOutline(at, edgeOutline) : at);
              const cell100 = 100 / frame.grid;
              const wobble = ((i * 7) % 5) - 2;
              const r = cell100 * (frame.style === 'shampoo' ? 0.7 : 0.62) + ((i * 3) % 3) * 0.5;
              const fill = frame.style === 'shampoo' ? `url(#${id}-foam-shampoo)` : `url(#${id}-foam)`;
              return (
                <g key={i} className="bath-foam__cell" style={{ '--i': i % 6 } as CSSProperties}>
                  <circle cx={c.x + wobble * 0.5} cy={c.y - wobble * 0.35} r={r} fill={fill} opacity={0.97} />
                  {frame.style === 'shampoo' && <circle cx={c.x - wobble * 0.6 + 2} cy={c.y + wobble * 0.4 + 1.5} r={r * 0.45} fill={fill} opacity={0.9} />}
                </g>
              );
            })}
          </g>
          {/* The drops' run down the body: each slides from where it starts to the body's lowest point under it */}
          <g className="bath-droplets" data-testid="bath-droplets" data-count={droplets}>
            {shapes.droplets.slice(0, droplets).map((d, i) => {
              const at = toView({ x: d.x, y: d.start });
              const dy = (d.start - d.release) * 100;
              return <ellipse key={i} className="bath-droplet__slide" cx={at.x} cy={at.y} rx="1.3" ry="2" fill="#bae6fd" opacity="0.9" style={dropletVars(d, dy, 0)} />;
            })}
          </g>
          {/* Where the shower's drops land on the body: a small splash each */}
          {raining && toolAt && (
            <g className="bath-rain-hits">
              {RAIN_DX.filter((_, i) => i % 2 === 0).map((dx, i) => {
                const x = Math.max(0, Math.min(100, toolAt.x + dx));
                const land = landingUnder(frame, x / 100);
                if (land === null) return null;
                return <circle key={dx} className="bath-splash" style={{ '--delay': `${i * 140}ms` } as CSSProperties} cx={x} cy={(1 - land) * 100 + 2} r={1.6} fill="#e0f2fe" opacity="0.9" />;
              })}
            </g>
          )}
        </g>

        {/* Off the body: only what falls */}
        <g className="bath-falling" data-testid="bath-falling">
          {shapes.droplets.slice(0, droplets).map((d, i) => {
            const from = toView({ x: d.x, y: d.release });
            const fall = Math.max(1, (d.release - d.ground) * 100 + 2);
            return (
              <g key={i}>
                <ellipse className="bath-droplet__fall" cx={from.x} cy={from.y} rx="1.2" ry="2.2" fill="#7dd3fc" opacity="0.85" style={dropletVars(d, 0, fall)} />
                <ellipse className="bath-droplet__splash" cx={from.x} cy={feet.y + 1} rx="2.6" ry="0.9" fill="none" stroke="#bae6fd" strokeWidth="0.8" opacity="0" style={dropletVars(d, 0, fall)} />
              </g>
            );
          })}
          {/* The shower's rain while it is held: from the head down to the body under it (the feet beside it) */}
          {stage?.kind === 'rinse' && toolAt && (
            <g className="bath-rain" data-testid="bath-rain" data-raining={raining ? 'true' : 'false'}>
              {raining && reduced && (
                <path className="bath-rain__spray" d={`M ${toolAt.x - 7} ${toolAt.y + 3} L ${toolAt.x + 7} ${toolAt.y + 3} L ${toolAt.x + 11} ${feet.y} L ${toolAt.x - 11} ${feet.y} Z`} fill="#bae6fd" opacity="0.35" />
              )}
              {raining &&
                !reduced &&
                RAIN_DX.map((dx, i) => {
                  const x = toolAt.x + dx;
                  const land = landingUnder(frame, x / 100);
                  const to = land === null ? feet.y : (1 - land) * 100;
                  return <ellipse key={dx} className="bath-drop" style={{ '--delay': `${i * 90}ms`, '--fall': `${Math.max(6, to - toolAt.y - 4)}` } as CSSProperties} cx={x} cy={toolAt.y + 4} rx={1.1} ry={2.4} fill="#7dd3fc" opacity="0.85" />;
                })}
            </g>
          )}
          {/* The cues' bursts, once each */}
          {bursts.map((b) => (
            <g key={b.id} className="bath-burst" data-testid="bath-burst" data-kind={b.kind} data-cue={b.id}>
              {b.kind === 'shake'
                ? Array.from({ length: SHAKE_DROPS }, (_, i) => {
                    const a = (i / SHAKE_DROPS) * Math.PI * 2 + 0.3;
                    return <ellipse key={i} className="bath-burst__drop" cx={centre.x} cy={centre.y} rx="1.4" ry="2.2" fill="#7dd3fc" opacity="0.9" style={{ '--dx': `${(Math.cos(a) * 34).toFixed(1)}`, '--dy': `${(Math.sin(a) * 30).toFixed(1)}`, '--delay': `${(i % 3) * 40}ms` } as CSSProperties} />;
                  })
                : [
                    <ellipse key="ring" className="bath-burst__ring" cx={feet.x} cy={feet.y + 1} rx="18" ry="5" fill="none" stroke="#bae6fd" strokeWidth="1.6" opacity="0.9" />,
                    ...Array.from({ length: SPLASH_DROPS }, (_, i) => {
                      const a = Math.PI + (i / (SPLASH_DROPS - 1)) * Math.PI;
                      return <ellipse key={i} className="bath-burst__drop" cx={feet.x} cy={feet.y} rx="1.3" ry="2" fill="#7dd3fc" opacity="0.9" style={{ '--dx': `${(Math.cos(a) * 26).toFixed(1)}`, '--dy': `${(Math.sin(a) * 22 - 6).toFixed(1)}`, '--delay': `${(i % 4) * 30}ms` } as CSSProperties} />;
                    }),
                  ]}
            </g>
          ))}
        </g>
      </svg>
      {/* A shake under way: the stylesheet wobbles the drawing beside this marker (`:has()`), once per cue */}
      {bursts.some((b) => b.kind === 'shake') && <div className="bath-shake" data-testid="bath-shake" aria-hidden />}
      {tool && toolAt && (
        <div className="bath-layer__tool" data-testid="bath-tool-in-hand" data-tool={tool.kind} data-style={frame.style} data-resting={tool.pressed ? 'false' : 'true'} style={{ left: `${toolAt.x}%`, top: `${toolAt.y}%` }} aria-hidden>
          <BathToolArt tool={tool.kind} className="bath-layer__tool-art" />
        </div>
      )}
    </>
  );
}

/** A drop's timing and distances as the stylesheet's variables (one cycle: the slide, the fall, the splash, a rest). */
function dropletVars(d: { delay: number; slideMs: number; fallMs: number }, slideDy: number, fallDy: number): CSSProperties {
  return { '--delay': `${d.delay}ms`, '--cycle': `${d.slideMs + d.fallMs + 700}ms`, '--slide-dy': slideDy.toFixed(2), '--fall-dy': fallDy.toFixed(2) } as CSSProperties;
}

/**
 * The cues not yet played, each kept on screen for its burst's length and then let go. The memory is the last id
 * played; a new key (another ritual) starts it afresh. A cue is played once: the same list seen again adds nothing.
 */
function useBursts(frame: Pick<BathFrame, 'cues' | 'key'>, reduced: boolean): BathCue[] {
  const [bursts, setBursts] = useState<BathCue[]>([]);
  const last = useRef(0);
  const key = useRef(frame.key);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastId = frame.cues.length ? frame.cues[frame.cues.length - 1].id : 0;
  useEffect(() => {
    if (key.current !== frame.key) {
      key.current = frame.key;
      last.current = 0;
      setBursts([]);
    }
    const next = cuesAfter(frame, last.current).filter((c) => c.kind === 'shake' || c.kind === 'splash-in' || c.kind === 'splash-out');
    last.current = Math.max(last.current, lastId);
    if (next.length === 0) return;
    setBursts((b) => [...b, ...next]);
    // Let go after the burst's length; the timers live past this effect (a new frame every animation frame)
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== timer);
      setBursts((b) => b.filter((x) => !next.some((n) => n.id === x.id)));
    }, reduced ? BURST_REDUCED_MS : BURST_MS);
    timers.current.push(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the cues only ever grow: their last id says when there is something new
  }, [frame.key, lastId, reduced]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return bursts;
}
