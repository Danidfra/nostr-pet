/**
 * One 3D Blobbi on a small stage of its own (`blobbi3d/stage.ts`): the
 * lab's viewer. Rebuilds the model when the genome or stage changes, faces
 * a view or turns, plays a motion, and says so without WebGL instead of
 * drawing nothing.
 *
 * A preview is never worth the room: a context the browser takes away
 * turns it into a line (never re-made, so no loop of new contexts), and an
 * error thrown inside it is caught here and shown as the same line, still
 * reported the way React reports errors (M14.3.1).
 */
import { Component, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import type { BlobbiGenome, BlobbiMotion } from '@blobbi-kit/renderer/procedural';

import { webglAvailable } from '../hooks/useRoomScene';
import { buildBlobbiModel } from '../lib/blobbi3d/model';
import { morphologyOf, type Blobbi3dStage as Stage3d } from '../lib/blobbi3d/identity';
import { buildSnoFigurine } from '../lib/blobbi3d/sno-figurine';
import { BlobbiStage, prefersReducedMotion, type StageView } from '../lib/blobbi3d/stage';
import { recordRuntimeError } from '../lib/runtime-errors';

export interface Blobbi3dStageProps {
  genome: BlobbiGenome;
  stage: Stage3d;
  view: StageView;
  motion: BlobbiMotion;
  sleeping?: boolean;
  /** Stand the SNO figurine of the same Blobbi beside it. */
  figurine?: boolean;
  /** The eyes follow the pointer over the stage; otherwise the resting gaze. */
  trackPointer?: boolean;
  /** Seconds per walk cycle (the room's tempo); the kit's by default. */
  walkCycle?: number;
  /** CSS px, square. */
  size?: number;
  testId?: string;
  label?: string;
}

type Status = 'loading' | 'ready' | 'unavailable' | 'lost';

/** What a stage that cannot draw says, by why. */
const NOTES: Record<'unavailable' | 'lost' | 'failed', string> = {
  unavailable: 'No WebGL here: the 3D Blobbi cannot be drawn.',
  lost: 'The 3D preview stopped on this device.',
  failed: 'The 3D preview could not start on this device.',
};

export function Blobbi3dStage(props: Blobbi3dStageProps) {
  const { size = 240, testId = 'blobbi-3d-stage' } = props;
  return (
    <StageBoundary size={size} testId={testId} label={props.label}>
      <StageView3d {...props} />
    </StageBoundary>
  );
}

function StageNote({ size, testId, label, status, note }: { size: number; testId: string; label?: string; status: string; note: string }) {
  return (
    <div className="relative shrink-0 rounded-2xl bg-white/40" style={{ width: size, height: size }} data-testid={testId} data-stage={status} aria-label={label}>
      <p className="flex h-full items-center justify-center p-4 text-center text-xs text-foreground/70" role="status" data-testid={`${testId}-note`}>
        {note}
      </p>
    </div>
  );
}

interface BoundaryProps {
  size: number;
  testId: string;
  label?: string;
  children: ReactNode;
}

/** An error inside the preview stays inside the preview. */
class StageBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordRuntimeError('render', error, `${error.stack ?? ''}${info.componentStack ? `\n\ncomponent stack:${info.componentStack}` : ''}`);
  }

  render() {
    if (this.state.failed) return <StageNote size={this.props.size} testId={this.props.testId} label={this.props.label} status="failed" note={NOTES.failed} />;
    return this.props.children;
  }
}

function StageView3d({ genome, stage, view, motion, sleeping = false, figurine = false, trackPointer = false, walkCycle, size = 240, testId = 'blobbi-3d-stage', label }: Blobbi3dStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<BlobbiStage | null>(null);
  const [status, setStatus] = useState<Status>(() => (webglAvailable() ? 'loading' : 'unavailable'));

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status === 'unavailable' || status === 'lost') return;
    let s: BlobbiStage;
    try {
      s = new BlobbiStage(host, { walkCycle, reducedMotion: prefersReducedMotion });
    } catch (error) {
      if (import.meta.env.DEV) console.error('[blobbi-3d-stage] no stage:', error);
      setStatus('unavailable');
      return;
    }
    stageRef.current = s;
    // Taken away by the browser: a line in its place, and no new stage for this preview
    s.onContextLost = () => setStatus('lost');
    s.resize(size, size);
    setStatus('ready');
    return () => {
      s.dispose();
      stageRef.current = null;
    };
    // The stage lives as long as the canvas; its inputs are set below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'unavailable' || status === 'lost']);

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
  useEffect(() => {
    if (!trackPointer) stageRef.current?.lookAtNothing();
  }, [trackPointer, status]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackPointer) return;
    const box = e.currentTarget.getBoundingClientRect();
    stageRef.current?.lookAtCanvasPoint(((e.clientX - box.left) / box.width) * size, ((e.clientY - box.top) / box.height) * size);
  };
  const onPointerLeave = () => {
    if (trackPointer) stageRef.current?.lookAtNothing();
  };

  const box: CSSProperties = { width: size, height: size };
  if (status === 'lost') return <StageNote size={size} testId={testId} label={label} status="lost" note={NOTES.lost} />;
  return (
    <div className="relative shrink-0 rounded-2xl bg-white/40" style={box} data-testid={testId} data-stage={status} data-view={view} data-motion={motion} data-seed={genome.seed} data-tracking={trackPointer ? 'pointer' : 'rest'} aria-label={label} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      {status !== 'unavailable' && <div ref={hostRef} style={box} />}
      {status === 'unavailable' && (
        <p className="flex h-full items-center justify-center p-4 text-center text-xs text-foreground/70" role="status">
          {NOTES.unavailable}
        </p>
      )}
    </div>
  );
}
