import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
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
  const [target, setTarget] = useState<GazeTarget | null>(null);
  const [eyeOffset, setEyeOffset] = useState<EyeOffset | undefined>(undefined);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiry = () => {
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
  };

  const expireAt = useCallback(
    (until: number) => {
      clearExpiry();
      expiryRef.current = setTimeout(() => {
        expiryRef.current = null;
        setTarget((t) => (t && t.kind !== 'pointer' && t.until <= until ? null : t));
      }, Math.max(0, until - now()));
    },
    [now],
  );

  useEffect(() => clearExpiry, []);

  // Turn the target into an offset relative to where the eyes are right now.
  useEffect(() => {
    if (!enabled || !target) {
      setEyeOffset(undefined);
      return;
    }
    if (target.kind === 'glance') {
      setEyeOffset(target.offset);
      return;
    }
    const actor = actorRef.current;
    if (!actor) return;
    const range = gazeRangeFor(sceneRef.current?.getBoundingClientRect().width ?? 0);
    const next = gazeToward(eyesOf(actor), target.point, range);
    setEyeOffset((prev) => (prev && prev.x === next.x && prev.y === next.y ? prev : next));
  }, [enabled, target, actorRef, sceneRef, actorKey]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType !== 'mouse' && !hoverCapable) return;
      const point = { x: event.clientX, y: event.clientY };
      clearExpiry();
      setTarget((t) => (t?.kind === 'pointer' && t.point.x === point.x && t.point.y === point.y ? t : { kind: 'pointer', point }));
    },
    [enabled, hoverCapable],
  );

  const onPointerLeave = useCallback(() => {
    setTarget((t) => (t?.kind === 'pointer' ? null : t));
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType === 'mouse' && hoverCapable) return; // the move handler already follows it
      const until = now() + TAP_ATTENTION_MS;
      setTarget({ kind: 'tap', point: { x: event.clientX, y: event.clientY }, until });
      expireAt(until);
    },
    [enabled, hoverCapable, now, expireAt],
  );

  const glance = useCallback(
    (offset: EyeOffset, durationMs: number) => {
      if (!enabled) return;
      const until = now() + durationMs;
      setTarget((t) => (t?.kind === 'pointer' ? t : { kind: 'glance', offset, until }));
      expireAt(until);
    },
    [enabled, now, expireAt],
  );

  const clear = useCallback(() => {
    clearExpiry();
    setTarget(null);
  }, []);

  return { eyeOffset, onPointerMove, onPointerLeave, onPointerDown, glance, clear };
}
