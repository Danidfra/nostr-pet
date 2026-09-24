import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import { REACTION_DURATION_MS } from './reactions';

export interface ReactionPolicy {
  /** The temporary reaction on the face right now, or null for the baseline. */
  reaction: BlobbiEmotion | null;
  /** Show `emotion` for a while, then fall back to the baseline. A new reaction replaces the old one. */
  react: (emotion: BlobbiEmotion | null, durationMs?: number) => void;
  clear: () => void;
}

/**
 * Temporary reactions with an expiry. Nothing here decides what to react to;
 * callers map care results, pokes and the like onto emotions (see
 * `reactions.ts`) and hand them in.
 */
export function useReactionPolicy(): ReactionPolicy {
  const [reaction, setReaction] = useState<BlobbiEmotion | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setReaction(null);
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

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useMemo(() => ({ reaction, react, clear }), [reaction, react, clear]);
}
