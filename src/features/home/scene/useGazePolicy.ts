import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { TAP_ATTENTION_MS, gazeRangeFor, gazeToward, type EyeOffset, type GazeTarget, type Point } from './gaze';

export interface UseGazePolicyOptions {
  /** The actor's box; the eyes are taken to sit in its upper half. */
  actorRef: RefObject<HTMLElement | null>;
  /** The scene box, for the saturation range. */
  sceneRef: RefObject<HTMLElement | null>;
  hoverCapable: boolean;
  /** Anything that moves the actor; the gaze is recomputed when it changes. */
  actorKey: string;
  enabled?: boolean;
  now?: () => number;
}

export interface GazePolicy {
  eyeOffset: EyeOffset | undefined;
  /** Scene pointer handlers: hovering pointers are followed, taps are looked at briefly. */
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** An idle glance: a fixed offset for a while. */
  glance: (offset: EyeOffset, durationMs: number) => void;
  clear: () => void;
}

function eyesOf(actor: HTMLElement): Point {
  const rect = actor.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 };
}

/**
 * Where the Blobbi looks. A hovering pointer (mouse, trackpad) is followed
 * while it is over the scene and near enough to matter; a tap or pen touch
 * holds its attention for a moment; an idle glance is a fixed offset. The
 * output is the renderer's `eyeOffset`, already clamped. The renderer
 * mirrors the left profile itself, so nothing here is negated.
 */
export function useGazePolicy({ actorRef, sceneRef, hoverCapable, actorKey, enabled = true, now = Date.now }: UseGazePolicyOptions): GazePolicy {
  // The target is kept in a ref; the offset is computed where the target is set (and when the actor moves), never
  // in an effect that follows the target: a hovering pointer sets state once per frame at most, and only when the
  // eyes really move (M15 care refinement: the effect per pointer frame fed a nested-update chain in dev)
  const targetRef = useRef<GazeTarget | null>(null);
  const [eyeOffset, setEyeOffset] = useState<EyeOffset | undefined>(undefined);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiry = () => {
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
  };

  /** The offset for a target, relative to where the eyes are right now; undefined for none (or no actor yet). */
  const offsetFor = useCallback(
    (target: GazeTarget | null): EyeOffset | undefined => {
      if (!target) return undefined;
      if (target.kind === 'glance') return target.offset;
      const actor = actorRef.current;
      if (!actor) return undefined;
      const range = gazeRangeFor(sceneRef.current?.getBoundingClientRect().width ?? 0);
      return gazeToward(eyesOf(actor), target.point, range);
    },
    [actorRef, sceneRef],
  );

  /** Aim at a target (or none): the state changes only when the offset does. */
  // What was last set: compared before setting, since a set of an equal value can still cost the home a render
  const shownRef = useRef<EyeOffset | undefined>(undefined);
  const aim = useCallback(
    (target: GazeTarget | null) => {
      targetRef.current = target;
      const next = offsetFor(target);
      const prev = shownRef.current;
      if (prev === next || (prev && next && prev.x === next.x && prev.y === next.y)) return;
      shownRef.current = next;
      setEyeOffset(next);
    },
    [offsetFor],
  );

  const expireAt = useCallback(
    (until: number) => {
      clearExpiry();
      expiryRef.current = setTimeout(() => {
        expiryRef.current = null;
        const t = targetRef.current;
        if (t && t.kind !== 'pointer' && t.until <= until) aim(null);
      }, Math.max(0, until - now()));
    },
    [now, aim],
  );

  useEffect(() => clearExpiry, []);

  // The actor moved under a held target: the eyes follow it from where they are now (no state when nothing changes)
  useEffect(() => {
    if (targetRef.current && targetRef.current.kind !== 'glance') aim(targetRef.current);
  }, [actorKey, aim]);

  // A mouse moves many times per frame; the eyes only need the latest
  // position once per frame. The point is kept in a ref and the offset is
  // computed in a requestAnimationFrame, so the home re-renders at most
  // once per frame for gaze, not once per pixel, and not at all while the
  // eyes stay where they are.
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const pointFrameRef = useRef<number | null>(null);
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType !== 'mouse' && !hoverCapable) return;
      pendingPointRef.current = { x: event.clientX, y: event.clientY };
      if (pointFrameRef.current !== null) return;
      pointFrameRef.current = requestAnimationFrame(() => {
        pointFrameRef.current = null;
        const point = pendingPointRef.current;
        if (!point) return;
        clearExpiry();
        const t = targetRef.current;
        if (t?.kind === 'pointer' && t.point.x === point.x && t.point.y === point.y) return;
        aim({ kind: 'pointer', point });
      });
    },
    [enabled, hoverCapable, aim],
  );
  useEffect(
    () => () => {
      if (pointFrameRef.current !== null) cancelAnimationFrame(pointFrameRef.current);
    },
    [],
  );

  const onPointerLeave = useCallback(() => {
    if (targetRef.current?.kind === 'pointer') aim(null);
  }, [aim]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType === 'mouse' && hoverCapable) return; // the move handler already follows it
      const until = now() + TAP_ATTENTION_MS;
      aim({ kind: 'tap', point: { x: event.clientX, y: event.clientY }, until });
      expireAt(until);
    },
    [enabled, hoverCapable, now, expireAt, aim],
  );

  const glance = useCallback(
    (offset: EyeOffset, durationMs: number) => {
      if (!enabled) return;
      if (targetRef.current?.kind === 'pointer') return;
      const until = now() + durationMs;
      aim({ kind: 'glance', offset, until });
      expireAt(until);
    },
    [enabled, now, expireAt, aim],
  );

  const clear = useCallback(() => {
    clearExpiry();
    aim(null);
  }, [aim]);

  // Off: no gaze at all (nothing is set; what was held is simply not shown)
  const shown = enabled ? eyeOffset : undefined;
  return useMemo(() => ({ eyeOffset: shown, onPointerMove, onPointerLeave, onPointerDown, glance, clear }), [shown, onPointerMove, onPointerLeave, onPointerDown, glance, clear]);
}
