/**
 * The lab's comparison matrix: many identities, each as the kit's 2D front
 * drawing beside the 3D model's front, side and back, all the 3D stills
 * drawn through one WebGL context (`blobbi3d/stills.ts`).
 */
import { useEffect, useMemo, useState } from 'react';
import { BlobbiRenderer, type BlobbiVisual } from '@blobbi-kit/renderer';
import { renderBlobbiSvg, type BlobbiGenome } from '@blobbi-kit/renderer/procedural';

import { webglAvailable } from '../hooks/useRoomScene';
import { renderStills, type StillView } from '../lib/blobbi3d/stills';
import type { Blobbi3dStage } from '../lib/blobbi3d/identity';

/**
 * The kit's own drawing of a genome (a fixture with no Blobbi event behind
 * it), as an image: the canonical SVG, untouched, in the stage's own frame
 * (a baby's is its smaller square, as `BlobbiRenderer` draws it).
 */
export function KitSvg({ genome, stage, view, size, testId }: { genome: BlobbiGenome; stage: Blobbi3dStage; view: 'front' | 'side' | 'back'; size: number; testId?: string }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderBlobbiSvg(genome, { stage, view }, { frame: 'stage' }))}`, [genome, stage, view]);
  return <img src={src} width={size} height={size} alt={`The kit's ${view} drawing`} data-testid={testId} data-kit-svg={view} />;
}

export interface MatrixRow {
  id: string;
  label: string;
  /** What the row is there to show (a trait, a pair, the bounds). */
  focus?: string;
  /** The Blobbi's visual, when there is one; else the kit's drawing of the genome. */
  visual?: BlobbiVisual;
  genome: BlobbiGenome;
  stage: Blobbi3dStage;
}

/** The kit's three views, and the room's: the front from the room camera's elevation, as the room shows it at rest. */
const VIEWS: readonly StillView[] = ['front', 'side', 'back', 'room'];

export function FidelityMatrix({ rows, size = 120 }: { rows: readonly MatrixRow[]; size?: number }) {
  const [stills, setStills] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'drawing' | 'done' | 'unavailable'>(() => (webglAvailable() ? 'drawing' : 'unavailable'));
  const requests = useMemo(() => rows.map((r) => ({ id: r.id, genome: r.genome, stage: r.stage })), [rows]);

  useEffect(() => {
    if (!webglAvailable()) return;
    const controller = new AbortController();
    setStills({});
    setStatus('drawing');
    renderStills(requests, VIEWS, size, (still) => {
      if (!controller.signal.aborted) setStills((s) => ({ ...s, [`${still.id}:${still.view}`]: still.url }));
    }, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setStatus('done');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });
    return () => controller.abort();
  }, [requests, size]);

  return (
    <div className="flex flex-col gap-2 overflow-x-auto" data-testid="lab-matrix" data-status={status}>
      <div className="grid gap-1 text-[11px] text-foreground/60" style={{ gridTemplateColumns: `8rem repeat(5, ${size}px)` }}>
        <span />
        <span>2D front (kit)</span>
        <span>3D front</span>
        <span>3D side</span>
        <span>3D back</span>
        <span>3D in the room</span>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="grid items-center gap-1" style={{ gridTemplateColumns: `8rem repeat(5, ${size}px)` }} data-testid={`lab-matrix-${row.id}`} data-seed={row.genome.seed}>
          <div className="min-w-0 pr-2 text-xs">
            <p className="truncate font-bold">{row.label}</p>
            <p className="truncate text-[10px] text-foreground/60">{row.focus ? `${row.focus} · ` : ''}{row.stage}</p>
          </div>
          <div className="rounded-xl bg-white/40" style={{ width: size, height: size }} data-testid={`lab-matrix-${row.id}-2d`}>
            {row.visual ? (
              <BlobbiRenderer visual={row.visual} instanceId={`lab-matrix-${row.id}`} size="100%" facing="front" motion="still" sleepIndicator="none" transparent style={{ width: '100%', height: '100%' }} />
            ) : (
              <KitSvg genome={row.genome} stage={row.stage} view="front" size={size} />
            )}
          </div>
          {VIEWS.map((view) => {
            const url = stills[`${row.id}:${view}`];
            return (
              <div key={view} className="flex items-center justify-center rounded-xl bg-white/40" style={{ width: size, height: size }} data-testid={`lab-matrix-${row.id}-${view}`} data-still={url ? 'ready' : status}>
                {url ? <img src={url} width={size} height={size} alt={`${row.label}, 3D ${view}`} /> : <span className="text-[10px] text-foreground/50">{status === 'unavailable' ? 'no WebGL' : '…'}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
