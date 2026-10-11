/**
 * The expression controller in React: one per Blobbi on screen, its winner
 * as state (so the drawing re-renders when the face changes, not per frame),
 * and the face eased: between two faces the kit can blend (presets and
 * blends), a few in-between faces over `EASE_MS`; to or from explicit parts
 * (eyes shut, a smile) the face changes at once, as a blink does.
 * StrictMode-safe: a disposed controller is made again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlobbiEmotion, BlobbiExpression } from '@blobbi-kit/renderer';
import { createExpressionController, type ExpressionController, type ExpressionRequest } from '../controller';
import { EXPRESSIONS, type ExpressionName } from '../faces';

/** How long a face takes to ease into the next. */
export const EASE_MS = 180;
/** In-between faces while easing (each a render of the drawing). */
const EASE_STEPS = 3;

type Weights = Partial<Record<Exclude<BlobbiEmotion, 'neutral'>, number>>;

function weightsOf(expression: BlobbiExpression): Weights | null {
  if (typeof expression === 'string') return expression === 'neutral' ? {} : { [expression]: 1 };
  if ('blend' in expression) return { ...expression.blend };
  return null;
}

/** A face part way from one blendable face to another. */
export function easeFace(from: BlobbiExpression, to: BlobbiExpression, k: number): BlobbiExpression {
  const a = weightsOf(from);
  const b = weightsOf(to);
  if (!a || !b || k >= 1) return to;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Weights>;
  const blend: Weights = {};
  for (const key of keys) {
    const w = (a[key] ?? 0) * (1 - k) + (b[key] ?? 0) * k;
    if (w > 0.005) blend[key] = w;
  }
  return Object.keys(blend).length ? { blend } : 'neutral';
}

export interface UseExpression {
  /** The face to draw now: the winner's, else the baseline, eased. */
  face: BlobbiExpression;
  /** The winning request's name, or null when the baseline shows. */
  name: ExpressionName | null;
  show: ExpressionController['show'];
  clear: ExpressionController['clear'];
  controller: ExpressionController;
}

export function useExpression(baseline: BlobbiExpression, options: { reducedMotion?: boolean } = {}): UseExpression {
  const ref = useRef<ExpressionController | null>(null);
  const get = useCallback(() => {
    ref.current ??= createExpressionController();
    return ref.current;
  }, []);
  const [winner, setWinner] = useState<ExpressionRequest | null>(null);
  useEffect(() => {
    const controller = get();
    setWinner(controller.current());
    const off = controller.subscribe(setWinner);
    return () => {
      off();
      controller.dispose();
      ref.current = null;
    };
  }, [get]);

  const target = winner ? EXPRESSIONS[winner.name] : baseline;
  const [face, setFace] = useState<BlobbiExpression>(target);
  const shown = useRef<BlobbiExpression>(target);
  useEffect(() => {
    const from = shown.current;
    if (from === target) return;
    if (options.reducedMotion || !weightsOf(from) || !weightsOf(target)) {
      shown.current = target;
      setFace(target);
      return;
    }
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const next = step >= EASE_STEPS ? target : easeFace(from, target, step / EASE_STEPS);
      shown.current = next;
      setFace(next);
      if (step >= EASE_STEPS) clearInterval(timer);
    }, EASE_MS / EASE_STEPS);
    // Interrupted mid-ease, the next ease starts from the face on screen (`shown`), so nothing jumps
    return () => clearInterval(timer);
  }, [target, options.reducedMotion]);

  const show = useCallback<ExpressionController['show']>((source, name, opts) => get().show(source, name, opts), [get]);
  const clear = useCallback<ExpressionController['clear']>((source) => get().clear(source), [get]);
  return useMemo(() => ({ face, name: winner?.name ?? null, show, clear, controller: get() }), [face, winner, show, clear, get]);
}
