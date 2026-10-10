/**
 * One 3D Blobbi on a small stage of its own (`blobbi3d/stage.ts`): the
 * lab's viewer. Rebuilds the model when the genome or stage changes, faces
 * a view or turns, plays a motion, and says so without WebGL instead of
 * drawing nothing.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BlobbiGenome, BlobbiMotion } from '@blobbi-kit/renderer/procedural';

import { webglAvailable } from '../hooks/useRoomScene';
import { buildBlobbiModel } from '../lib/blobbi3d/model';
import { morphologyOf, type Blobbi3dStage as Stage3d } from '../lib/blobbi3d/identity';
import { buildSnoFigurine } from '../lib/blobbi3d/sno-figurine';
import { BlobbiStage, prefersReducedMotion, type StageView } from '../lib/blobbi3d/stage';

export interface Blobbi3dStageProps {
  genome: BlobbiGenome;
  stage: Stage3d;
  view: StageView;
  motion: BlobbiMotion;
  sleeping?: boolean;
  /** Stand the SNO figurine of the same Blobbi beside it. */
  figurine?: boolean;
  /** Seconds per walk cycle (the room's tempo); the kit's by default. */
  walkCycle?: number;
  /** CSS px, square. */
  size?: number;
  testId?: string;
  label?: string;
}

type Status = 'loading' | 'ready' | 'unavailable';

export function Blobbi3dStage({ genome, stage, view, motion, sleeping = false, figurine = false, walkCycle, size = 240, testId = 'blobbi-3d-stage', label }: Blobbi3dStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<BlobbiStage | null>(null);
  const [status, setStatus] = useState<Status>(() => (webglAvailable() ? 'loading' : 'unavailable'));

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status === 'unavailable') return;
    let s: BlobbiStage;
    try {
      s = new BlobbiStage(host, { walkCycle, reducedMotion: prefersReducedMotion });
    } catch (error) {
      if (import.meta.env.DEV) console.error('[blobbi-3d-stage] no stage:', error);
      setStatus('unavailable');
      return;
    }
    stageRef.current = s;
    s.resize(size, size);
    setStatus('ready');
    return () => {
      s.dispose();
      stageRef.current = null;
    };
    // The stage lives as long as the canvas; its inputs are set below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'unavailable']);

  useEffect(() => {
    stageRef.current?.resize(size, size);
  }, [size, status]);

  useEffect(() => {
    const s = stageRef.current;
    if (!s || status !== 'ready') return;
    const model = buildBlobbiModel(morphologyOf(genome, stage), genome.seed);
    const sno = figurine ? buildSnoFigurine(morphologyOf(genome, stage)).object : null;
    s.setModel(model, sno);
    return () => {
      s.setModel(null);
      model.dispose();
    };
  }, [genome, stage, figurine, status]);

  useEffect(() => {
    stageRef.current?.setView(view);
  }, [view, status]);
  useEffect(() => {
    stageRef.current?.setMotion(motion);
  }, [motion, status]);
  useEffect(() => {
    stageRef.current?.setSleeping(sleeping);
  }, [sleeping, status]);

  const box: CSSProperties = { width: size, height: size };
  return (
    <div className="relative shrink-0 rounded-2xl bg-white/40" style={box} data-testid={testId} data-stage={status} data-view={view} data-motion={motion} data-seed={genome.seed} aria-label={label}>
      {status !== 'unavailable' && <div ref={hostRef} style={box} />}
      {status === 'unavailable' && (
        <p className="flex h-full items-center justify-center p-4 text-center text-xs text-foreground/70" role="status">
          No WebGL here: the 3D Blobbi cannot be drawn.
        </p>
      )}
    </div>
  );
}
