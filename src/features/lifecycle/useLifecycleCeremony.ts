import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlobbiEggCrack, BlobbiVisualEffect } from '@blobbi-kit/renderer';

export type CeremonyKind = 'hatch' | 'evolve';

/**
 * A ceremony is short and has four beats:
 *
 *   building    the scene builds up (the shell cracks, or the glow gathers); nothing published
 *   publishing  the semantic transition is written to Nostr; the scene holds still
 *   revealing   the publish landed: the new stage is shown with a small celebration
 *   failed      the publish did not land: the scene returns to what it was; an error is shown
 *
 * `idle` is no ceremony. The exclusive behaviour mode covers `building` and
 * `publishing`; once the new stage is real the home is free again.
 *
 * A hatch tells its build as a small story (`HatchBeat`): the intact shell
 * stirs, cracks appear and grow, the last crack holds for a moment, light
 * bursts out while the write is on its way, and the baby is there when the
 * light clears. The shell's four drawings are the renderer's
 * (`BlobbiEggCrack`); the rocking and the light are the home's, on its own
 * box around the renderer, so they are the same for every visual generation.
 */
export type CeremonyPhase = 'idle' | 'building' | 'publishing' | 'revealing' | 'failed';

export interface CeremonyTimings {
  /** Milliseconds per build step (three steps). */
  stepMs: number;
  /** How long the reveal celebration stays. */
  revealMs: number;
  /** Hatch only: how long the intact shell stirs before the first crack. `stepMs` when absent. */
  leadMs?: number;
  /** Hatch only: how long the last crack holds before the write. None when absent. */
  finalMs?: number;
  /** Hatch only: the least time the burst of light stays over the shell while the write is out. None when absent. */
  burstMs?: number;
}

export const CEREMONY_TIMINGS: CeremonyTimings = { stepMs: 700, revealMs: 2_400, leadMs: 1_100, finalMs: 900, burstMs: 600 };
/** Reduced motion: no rocking and no burst are drawn, so the build is only as long as the shell needs to be read. */
export const REDUCED_CEREMONY_TIMINGS: CeremonyTimings = { stepMs: 120, revealMs: 1_200, leadMs: 300, finalMs: 500, burstMs: 0 };

/**
 * Where a hatch is in its story:
 *
 *   stirring   the shell is intact and rocks gently: something moves inside
 *   cracking   the first cracks appear and grow; the rocking grows with them
 *   breaking   the last crack: the shell is about to give
 *   hatching   light bursts out; the egg → baby write is on its way
 *   hatched    the write landed: the light clears and the baby is there
 */
export type HatchBeat = 'stirring' | 'cracking' | 'breaking' | 'hatching' | 'hatched';

export interface HatchPresentation {
  beat: HatchBeat;
  /** How hard the shell rocks, 0 (not at all) to 4. Not drawn under reduced motion. */
  rock: 0 | 1 | 2 | 3 | 4;
  /** The burst of light over the actor: gathering over the shell, or clearing off the baby. */
  burst: 'none' | 'in' | 'out';
}

export interface CeremonyState {
  kind: CeremonyKind | null;
  phase: CeremonyPhase;
  /** 0..3 while building, 3 while publishing. */
  step: number;
  error: Error | null;
}

export interface CeremonyPresentation {
  /** What the shell should look like during a hatch ceremony; null leaves the lifecycle's own crack. */
  eggCrack: BlobbiEggCrack | null;
  /** Renderer effects to draw around the Blobbi for this beat. */
  effects: readonly BlobbiVisualEffect[];
  /** True while movement, gaze, idle and taps must stay out of the way. */
  exclusive: boolean;
  /** The hatch story's beat; null outside a hatch ceremony. */
  hatch: HatchPresentation | null;
}

const CRACKS: readonly BlobbiEggCrack[] = ['none', 'light', 'medium', 'heavy'];

/** The visual state of a ceremony beat. Pure. */
export function ceremonyPresentation(state: CeremonyState): CeremonyPresentation {
  const { kind, phase, step } = state;
  if (kind === null || phase === 'idle' || phase === 'failed') return { eggCrack: null, effects: [], exclusive: false, hatch: null };
  const exclusive = phase === 'building' || phase === 'publishing';
  if (phase === 'revealing') {
    return { eggCrack: null, effects: [{ id: 'golden-sparkles', intensity: 1.2 }], exclusive, hatch: kind === 'hatch' ? { beat: 'hatched', rock: 0, burst: 'out' } : null };
  }
  if (kind === 'hatch') {
    const at = Math.min(3, Math.max(0, step)) as 0 | 1 | 2 | 3;
    const hatch: HatchPresentation =
      phase === 'publishing'
        ? { beat: 'hatching', rock: 4, burst: 'in' }
        : at === 0
          ? { beat: 'stirring', rock: 1, burst: 'none' }
          : at === 3
            ? { beat: 'breaking', rock: 4, burst: 'none' }
            : { beat: 'cracking', rock: at === 1 ? 2 : 3, burst: 'none' };
    return { eggCrack: CRACKS[at], effects: [{ id: 'solar-radiance', intensity: 0.4 + at * 0.25 }], exclusive, hatch };
  }
  return { eggCrack: null, effects: [{ id: 'celestial-aura', intensity: 0.4 + step * 0.3 }], exclusive, hatch: null };
}

/**
 * The hatch beat for what is actually on screen. The ceremony reveals the
 * moment the write lands, and the home shows the new stage a render later
 * (the collection cache notifies after the publish resolves): for that one
 * render the shell is still there, so the story is still `hatching`. The
 * baby beat is only ever shown with the baby.
 */
export function hatchOnScreen(hatch: HatchPresentation | null, stage: 'egg' | 'baby' | 'adult'): HatchPresentation | null {
  if (hatch?.beat === 'hatched' && stage === 'egg') return { beat: 'hatching', rock: 4, burst: 'in' };
  return hatch;
}

export interface UseLifecycleCeremonyOptions {
  /** Performs the semantic transition; resolves true when it landed. */
  perform: (kind: CeremonyKind) => Promise<boolean>;
  reducedMotion: boolean;
  timings?: CeremonyTimings;
  /** Called when the reveal starts, so the scene can celebrate (a face, a hop). */
  onReveal?: (kind: CeremonyKind) => void;
}

export interface LifecycleCeremony extends CeremonyState {
  presentation: CeremonyPresentation;
  /** Start a ceremony. Ignored while one is running. */
  start: (kind: CeremonyKind) => void;
  /** Clear a failed ceremony. */
  dismiss: () => void;
}

/**
 * The lifecycle ceremony: local presentation first, the semantic write at
 * exactly one point, and a reveal only when the write landed. A failed
 * write never leaves the scene pretending the stage changed.
 */
export function useLifecycleCeremony({ perform, reducedMotion, timings, onReveal }: UseLifecycleCeremonyOptions): LifecycleCeremony {
  const t = timings ?? (reducedMotion ? REDUCED_CEREMONY_TIMINGS : CEREMONY_TIMINGS);
  const [state, setState] = useState<CeremonyState>({ kind: null, phase: 'idle', step: 0, error: null });
  const runningRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const latest = useRef({ perform, onReveal, t });
  latest.current = { perform, onReveal, t };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(resolve, ms);
      timersRef.current.push(id);
    });

  const start = useCallback((kind: CeremonyKind) => {
    if (runningRef.current) return;
    runningRef.current = true;
    const { t } = latest.current;

    void (async () => {
      try {
        const hatching = kind === 'hatch';
        setState({ kind, phase: 'building', step: 0, error: null });
        for (let step = 1; step <= 3; step += 1) {
          await wait(hatching && step === 1 ? (t.leadMs ?? t.stepMs) : t.stepMs);
          if (!mountedRef.current) return;
          setState((s) => ({ ...s, step }));
        }
        // The last crack is a beat of its own: without it a fast write would hide it.
        if (hatching && t.finalMs) {
          await wait(t.finalMs);
          if (!mountedRef.current) return;
        }
        setState((s) => ({ ...s, phase: 'publishing', step: 3 }));
        // The write, and for a hatch the least time the light needs to cover the shell.
        const [landed] = await Promise.all([latest.current.perform(kind), hatching && t.burstMs ? wait(t.burstMs) : undefined]);
        if (!mountedRef.current) return;
        if (!landed) {
          setState((s) => ({ ...s, phase: 'failed', step: 0, error: s.error ?? new Error('The change did not reach the relays.') }));
          return;
        }
        setState((s) => ({ ...s, phase: 'revealing', step: 3 }));
        latest.current.onReveal?.(kind);
        await wait(latest.current.t.revealMs);
        if (!mountedRef.current) return;
        setState({ kind: null, phase: 'idle', step: 0, error: null });
      } finally {
        runningRef.current = false;
      }
    })();
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => (s.phase === 'failed' ? { kind: null, phase: 'idle', step: 0, error: null } : s));
  }, []);

  return { ...state, presentation: ceremonyPresentation(state), start, dismiss };
}
