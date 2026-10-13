/**
 * The Blobbi's life during the save ceremony, in React (M14.2): one hook
 * that owns the face (the shared expression controller), the blinks, the
 * eyes (the pointer, or the field being typed in), the little moves and the
 * sparkles, and plays the moments of `ceremony-life.ts` on them. Timers,
 * not animation frames, and every one is cleared on unmount. Reduced motion
 * keeps the faces and the eyes and drops the moves and the sparkles.
 * `CeremonyBlobbi.tsx` draws what this decides.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlobbiVisualEffect } from '@blobbi-kit/renderer';
import { useExpression } from '@/features/expression/react/useExpression';
import { useSound } from '@/features/sound';
import { BLINK_MS, CEREMONY_AT_REST, MOVE_MS, SURPRISE_MS, gazeToward, momentFor, nextBlinkIn, nextIdleIn, planIdleMoment, type CeremonyMove, type CeremonyReaction, type Random } from './ceremony-life';
import type { CeremonyStage } from './ceremony-stage';

/** How long a touch holds its eyes. */
const LOOK_MS = 1_500;

export interface CeremonyLife {
  stage: CeremonyStage;
  /** The portrait's box, for the eyes to know where the face is on screen. */
  faceRef: React.MutableRefObject<HTMLElement | null>;
  portrait: {
    face: ReturnType<typeof useExpression>['face'];
    faceName: string;
    blink: boolean;
    gaze: { x: number; y: number } | undefined;
    move: { kind: CeremonyMove; key: number } | null;
    effects: readonly BlobbiVisualEffect[];
  };
}

export function useCeremonyLife({ reduced, random = Math.random }: { reduced: boolean; random?: Random }): CeremonyLife {
  const { play } = useSound();
  const expression = useExpression(CEREMONY_AT_REST, { reducedMotion: reduced });
  const { show, clear } = expression;
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState<{ x: number; y: number } | undefined>(undefined);
  const [move, setMove] = useState<{ kind: CeremonyMove; key: number } | null>(null);
  const [effects, setEffects] = useState<readonly BlobbiVisualEffect[]>([]);
  const faceRef = useRef<HTMLElement | null>(null);
  const attended = useRef<HTMLElement | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const moveUntil = useRef(0);
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
    return t;
  }, []);
  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) clearTimeout(t);
      set.clear();
    };
  }, []);

  // Blinking, now and then
  useEffect(() => {
    let open: ReturnType<typeof setTimeout>;
    let shut: ReturnType<typeof setTimeout>;
    const schedule = () => {
      shut = setTimeout(() => {
        setBlink(true);
        open = setTimeout(() => {
          setBlink(false);
          schedule();
        }, BLINK_MS);
      }, nextBlinkIn(random));
    };
    schedule();
    return () => {
      clearTimeout(open);
      clearTimeout(shut);
    };
  }, [random]);

  // Its eyes: on the field the player types in, else on the mouse as it moves, else on a touch for a moment
  const lookAtPoint = useCallback((x: number, y: number) => {
    const r = faceRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setGaze(gazeToward({ x: r.left + r.width / 2, y: r.top + r.height * 0.42 }, { x, y }));
  }, []);
  const lookAtAttended = useCallback(() => {
    const el = attended.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    lookAtPoint(r.left + Math.min(r.width, 160) / 2, r.top + r.height / 2);
    return true;
  }, [lookAtPoint]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let release: ReturnType<typeof setTimeout> | undefined;
    const onMove = (e: PointerEvent) => {
      if (attended.current) return;
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') lookAtPoint(e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || attended.current) return;
      lookAtPoint(e.clientX, e.clientY);
      clearTimeout(release);
      release = setTimeout(() => setGaze(undefined), LOOK_MS);
    };
    const onLeave = () => {
      if (!attended.current) setGaze(undefined);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      clearTimeout(release);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [lookAtPoint]);

  // Left alone: a glance, a face, or nothing, on long pauses; never while a field is the player's
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let glanceEnd: ReturnType<typeof setTimeout> | undefined;
    const beat = () => {
      timer = setTimeout(() => {
        if (!attended.current) {
          const moment = planIdleMoment(random);
          if (moment.type === 'glance') {
            setGaze(moment.offset);
            glanceEnd = setTimeout(() => setGaze((g) => (g === moment.offset ? undefined : g)), moment.durationMs);
          } else if (moment.type === 'face') {
            show('life', moment.name, { priority: 1, durationMs: moment.durationMs });
          }
        }
        beat();
      }, nextIdleIn(random));
    };
    beat();
    return () => {
      clearTimeout(timer);
      clearTimeout(glanceEnd);
    };
  }, [random, show]);

  const playMove = useCallback(
    (kind: CeremonyMove) => {
      if (reduced) return;
      const now = Date.now();
      // A move over a move: the second waits for nothing and is dropped, so the body never jitters
      if (now < moveUntil.current && kind !== 'cheer') return;
      moveUntil.current = now + MOVE_MS[kind];
      setMove((m) => ({ kind, key: (m?.key ?? 0) + 1 }));
    },
    [reduced],
  );

  const react = useCallback(
    (reaction: CeremonyReaction) => {
      const moment = momentFor(reaction);
      if (moment.face === null) clear(moment.source);
      else if (reaction === 'displeased') {
        // Surprised first, then displeased: two faces in one moment
        show(moment.source, 'surprised', { priority: moment.priority, durationMs: SURPRISE_MS });
        later(() => show(moment.source, 'upset', { priority: moment.priority, durationMs: moment.faceMs ?? undefined }), SURPRISE_MS);
      } else show(moment.source, moment.face, { priority: moment.priority, durationMs: moment.faceMs ?? undefined });
      if (moment.move) playMove(moment.move);
      if (moment.effects.length > 0 && !reduced) {
        const mine = moment.effects;
        setEffects(mine);
        later(() => setEffects((e) => (e === mine ? [] : e)), moment.effectsMs);
      }
      if (moment.sound) play(moment.sound);
    },
    [clear, show, later, playMove, reduced, play],
  );

  const attend = useCallback(
    (element: HTMLElement | null) => {
      attended.current = element;
      if (element) {
        if (!lookAtAttended()) setGaze({ x: 0, y: 0.35 });
      } else setGaze(undefined);
    },
    [lookAtAttended],
  );

  const stage = useMemo<CeremonyStage>(() => ({ react, attend }), [react, attend]);
  return useMemo(
    () => ({ stage, faceRef, portrait: { face: expression.face, faceName: expression.name ?? 'rest', blink, gaze, move, effects } }),
    [stage, expression.face, expression.name, blink, gaze, move, effects],
  );
}

