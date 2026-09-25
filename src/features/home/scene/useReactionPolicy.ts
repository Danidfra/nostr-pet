import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import type { PokeGesture } from '../personality';
import { REACTION_DURATION_MS } from './reactions';

/** A gesture in flight: what, and a key that restarts it when the same one plays again. */
export interface ActiveGesture {
  kind: PokeGesture;
  key: number;
}

export interface ReactionPolicy {
  /** The temporary reaction on the face right now, or null for the baseline. */
  reaction: BlobbiEmotion | null;
  /** Show `emotion` for a while, then fall back to the baseline. A new reaction replaces the old one. */
  react: (emotion: BlobbiEmotion | null, durationMs?: number) => void;
  /** The body gesture playing right now, or null. */
  gesture: ActiveGesture | null;
  /** Play a gesture for a while; a new one replaces the old one. */
  gesticulate: (kind: PokeGesture, durationMs: number) => void;
  clear: () => void;
}

/**
 * Temporary reactions with an expiry: a face and a body gesture, each on
 * its own clock. Nothing here decides what to react to; callers map care
 * results, pokes and the like onto emotions and gestures (`reactions.ts`,
 * `personality.ts`) and hand them in.
 */
export function useReactionPolicy(): ReactionPolicy {
  const [reaction, setReaction] = useState<BlobbiEmotion | null>(null);
  const [gesture, setGesture] = useState<ActiveGesture | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureKeyRef = useRef(0);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    timerRef.current = null;
    gestureTimerRef.current = null;
    setReaction(null);
    setGesture(null);
  }, []);

  const react = useCallback(
    (emotion: BlobbiEmotion | null, durationMs: number = REACTION_DURATION_MS) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (!emotion) {
        setReaction(null);
        return;
      }
      setReaction(emotion);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setReaction(null);
      }, durationMs);
    },
    [],
  );

  const gesticulate = useCallback((kind: PokeGesture, durationMs: number) => {
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    gestureKeyRef.current += 1;
    setGesture({ kind, key: gestureKeyRef.current });
    gestureTimerRef.current = setTimeout(() => {
      gestureTimerRef.current = null;
      setGesture(null);
    }, durationMs);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    },
    [],
  );

  return useMemo(() => ({ reaction, react, gesture, gesticulate, clear }), [reaction, react, gesture, gesticulate, clear]);
}
