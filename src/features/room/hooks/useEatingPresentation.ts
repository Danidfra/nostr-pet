/**
 * How the Blobbi takes food, drawn on whichever drawing stands in the room:
 *
 *   offered    (food or drink handed over, or reached on the floor; the write
 *              is out) it looks at it, eager: eyes on the food, an excited
 *              face. Nothing is eaten yet.
 *   eating     (the write landed: `useRoomCare` turned the offer `eating`)
 *              bite after bite, in step with the munch: the mouth open on the
 *              bite, then closed on it, eyes shut with the pleasure of it, the
 *              body dipping into each bite and bobbing back up; the food
 *              itself shrinks bite by bite (the overlay's own CSS).
 *
 * The face goes through the expression controller (as "care"); the body's
 * bob through the 3D pose and the 2D drawing's box, by style, frame by
 * frame. Then the celebration (the care's own reaction) takes over. Reduced
 * motion: the faces, no bob.
 */
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { PRIORITY } from '@/features/expression/controller';
import type { ExpressionName } from '@/features/expression/faces';
import type { RoomControl } from '../components/RoomShell';
import { EAT, type RoomOffer } from './useRoomCare';
import { isHandFed } from '../lib/room-care';

interface UseEatingPresentationOptions {
  offer: RoomOffer | null;
  controlRef: MutableRefObject<RoomControl | null>;
  boxRef: RefObject<HTMLElement | null>;
  showFace: (source: string, name: ExpressionName, options?: { priority?: number }) => void;
  clearFace: (source: string) => void;
  reducedMotion: boolean;
}

/** Where the eyes go while it takes food: on the food, at its mouth. */
const ON_THE_FOOD = { x: 0, y: 0.6 } as const;

/** The face and the dip of a moment of eating (`t` ms in): the mouth open on each bite, then closed on it. */
export function biteAt(t: number): { face: ExpressionName; dip: number } {
  const k = t % EAT.biteMs;
  if (k < EAT.openMs) return { face: 'chewing', dip: Math.sin((k / EAT.openMs) * Math.PI * 0.5) };
  return { face: 'munching', dip: Math.cos(((k - EAT.openMs) / (EAT.biteMs - EAT.openMs)) * Math.PI * 0.5) * 0.6 };
}

export function useEatingPresentation({ offer, controlRef, boxRef, showFace, clearFace, reducedMotion }: UseEatingPresentationOptions): { gaze: { x: number; y: number } | null } {
  const action = offer?.choice.entry.item.care?.action;
  const isFood = !!offer && !!action && isHandFed(action);
  const offered = isFood && offer!.phase === 'using';
  const eating = isFood && offer!.phase === 'eating' ? offer : null;
  const latest = useRef({ controlRef, boxRef, showFace, clearFace, reducedMotion });
  latest.current = { controlRef, boxRef, showFace, clearFace, reducedMotion };

  // Offered: eager, eyes on it
  useEffect(() => {
    if (!offered) return;
    latest.current.showFace('care', 'excited', { priority: PRIORITY.care });
    return () => latest.current.clearFace('care');
  }, [offered]);

  // Eating: bite after bite
  const eatingKey = eating ? `${eating.key}:${eating.eatingSince}` : null;
  useEffect(() => {
    if (!eating?.eatingSince) return;
    const since = eating.eatingSince;
    const total = (eating.bites ?? EAT.food) * EAT.biteMs;
    let frame = 0;
    let lastFace: ExpressionName | null = null;
    const pose = (dip: number | null) => {
      const { controlRef: c, boxRef: b, reducedMotion: reduced } = latest.current;
      if (reduced) return;
      const p = dip === null ? null : { sx: 1 + 0.05 * dip, sy: 1 - 0.07 * dip, pitch: 0.08 * dip, roll: 0 };
      c.current?.pose(p);
      const box = b.current;
      if (!box) return;
      box.style.transformOrigin = p ? '50% 100%' : '';
      box.style.transform = p ? `scale(${p.sx.toFixed(4)}, ${p.sy.toFixed(4)})` : '';
    };
    const step = () => {
      const t = Date.now() - since;
      const { face, dip } = biteAt(Math.min(t, total - 1));
      if (face !== lastFace) {
        lastFace = face;
        latest.current.showFace('care', face, { priority: PRIORITY.care });
      }
      pose(dip);
      if (t < total) frame = requestAnimationFrame(step);
      else pose(null);
    };
    step();
    return () => {
      cancelAnimationFrame(frame);
      pose(null);
      latest.current.clearFace('care');
    };
    // The eating moment itself (its key and start) is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eatingKey]);

  return { gaze: offered || eating ? ON_THE_FOOD : null };
}
