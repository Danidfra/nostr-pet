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
 */
export type CeremonyPhase = 'idle' | 'building' | 'publishing' | 'revealing' | 'failed';

export interface CeremonyTimings {
  /** Milliseconds per build step (three steps). */
  stepMs: number;
  /** How long the reveal celebration stays. */
  revealMs: number;
}

export const CEREMONY_TIMINGS: CeremonyTimings = { stepMs: 700, revealMs: 2_400 };
export const REDUCED_CEREMONY_TIMINGS: CeremonyTimings = { stepMs: 120, revealMs: 1_200 };

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
}

const CRACKS: readonly BlobbiEggCrack[] = ['none', 'light', 'medium', 'heavy'];

/** The visual state of a ceremony beat. Pure. */
export function ceremonyPresentation(state: CeremonyState): CeremonyPresentation {
  const { kind, phase, step } = state;
  if (kind === null || phase === 'idle' || phase === 'failed') return { eggCrack: null, effects: [], exclusive: false };
  const exclusive = phase === 'building' || phase === 'publishing';
  if (phase === 'revealing') return { eggCrack: null, effects: [{ id: 'golden-sparkles', intensity: 1.2 }], exclusive };
  if (kind === 'hatch') {
    return { eggCrack: CRACKS[Math.min(3, Math.max(0, step))], effects: [{ id: 'solar-radiance', intensity: 0.4 + step * 0.25 }], exclusive };
  }
  return { eggCrack: null, effects: [{ id: 'celestial-aura', intensity: 0.4 + step * 0.3 }], exclusive };
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
        setState({ kind, phase: 'building', step: 0, error: null });
        for (let step = 1; step <= 3; step += 1) {
          await wait(t.stepMs);
          if (!mountedRef.current) return;
          setState((s) => ({ ...s, step }));
        }
        setState((s) => ({ ...s, phase: 'publishing', step: 3 }));
        const landed = await latest.current.perform(kind);
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
