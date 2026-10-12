/**
 * The Blobbi that welcomes a visitor (`welcome-hero.ts` holds its lines and
 * faces). It is aware of you: it notices you arrive ("Oh! You're here!"),
 * blinks, follows the pointer with its eyes (a touch makes it look there for
 * a moment), and answers a tap in turn: shy, giggly, overjoyed. Drawn by the
 * canonical renderer; it is a picture of a Blobbi from a made-up key, never
 * an account's.
 *
 * Light by design: no animation library, the hops are CSS; one window
 * listener for the eyes, two timers. Reduced motion keeps the faces and the
 * words and drops the hops and the bobbing. It is a button for the keyboard
 * and screen readers (Enter or Space says hello), and what it says is a
 * polite status.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BlobbiRenderer, type BlobbiExpression } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { useSound } from '@/features/sound';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import { AT_REST, BLINK_MS, GREETING, GREETING_MS, NOTICING, gazeToward, nextBlinkIn, reactionFor, type HeroMove } from './welcome-hero';

export interface WelcomeHeroProps {
  blobbi: BlobbiCompanion;
  /** 'hero': the scene's star, greeting the visitor; 'guide': small, beside a step, saying `line`. */
  variant?: 'hero' | 'guide';
  /** What a guide says (a hero says its greeting, then its reactions). */
  line?: string;
  testId?: string;
}

/** How long a touch holds its eyes. */
const LOOK_MS = 1_500;

export function WelcomeHero({ blobbi, variant = 'hero', line, testId = 'welcome-hero' }: WelcomeHeroProps) {
  const reduced = useReducedMotion();
  const { play } = useSound();
  const hero = variant === 'hero';
  const [face, setFace] = useState<BlobbiExpression>(hero ? NOTICING : AT_REST);
  const [said, setSaid] = useState<string | null>(hero ? GREETING : line ?? null);
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState<{ x: number; y: number } | undefined>(undefined);
  const [move, setMove] = useState<{ kind: HeroMove; key: number } | null>(null);
  const taps = useRef(0);
  const faceRef = useRef<HTMLButtonElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The greeting: surprised to see you, then glad; the words stay a moment, then the scene's invitation takes over
  useEffect(() => {
    if (!hero) return;
    const glad = setTimeout(() => setFace(AT_REST), reduced ? 500 : 900);
    const quiet = setTimeout(() => setSaid((s) => (s === GREETING ? null : s)), GREETING_MS);
    return () => {
      clearTimeout(glad);
      clearTimeout(quiet);
    };
  }, [hero, reduced]);
  // A guide's line follows the step it stands beside
  useEffect(() => {
    if (!hero) setSaid(line ?? null);
  }, [hero, line]);

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
      }, nextBlinkIn());
    };
    schedule();
    return () => {
      clearTimeout(open);
      clearTimeout(shut);
    };
  }, []);

  // Its eyes: on the mouse as it moves; on a touch for a moment
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let release: ReturnType<typeof setTimeout> | undefined;
    const lookAt = (x: number, y: number) => {
      const r = faceRef.current?.getBoundingClientRect();
      if (!r || r.width === 0) return;
      setGaze(gazeToward({ x: r.left + r.width / 2, y: r.top + r.height * 0.42 }, { x, y }));
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') lookAt(e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      lookAt(e.clientX, e.clientY);
      clearTimeout(release);
      release = setTimeout(() => setGaze(undefined), LOOK_MS);
    };
    const onLeave = () => setGaze(undefined);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      clearTimeout(release);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const onTap = useCallback(() => {
    const r = reactionFor(taps.current);
    taps.current += 1;
    setFace(r.face);
    setSaid(r.line);
    setMove((m) => ({ kind: r.move, key: (m?.key ?? 0) + 1 }));
    play(r.sound);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setFace(AT_REST);
      setSaid(hero ? null : line ?? null);
    }, r.ms);
  }, [play, hero, line]);

  return (
    // Full class names: Tailwind keeps a component class's rule only if its name appears whole in the source
    <div className={hero ? 'whero whero--hero' : 'whero whero--guide'} data-testid={testId} data-reduced={reduced ? 'true' : undefined}>
      <p className="whero__bubble" role="status" aria-live="polite" data-shown={said ? 'true' : 'false'} data-testid={`${testId}-says`}>
        {said ?? ''}
      </p>
      <button
        ref={faceRef}
        type="button"
        className="whero__body"
        onClick={onTap}
        aria-label={`${blobbi.name}, a Blobbi. Say hello`}
        data-move={move && !reduced ? move.kind : undefined}
        // Two copies of each hop, taken in turn, so the same hop coming round again restarts (the button keeps its
        // focus: no re-mount)
        data-beat={move ? move.key % 2 : undefined}
      >
        <BlobbiRenderer
          visual={toBlobbiVisual(blobbi)}
          instanceId={`${testId}-${blobbi.d}`}
          size="100%"
          expression={face}
          eyeOffset={gaze}
          eyesClosed={blink}
          transparent
          style={{ width: '100%', height: '100%' }}
          label={blobbi.name}
        />
      </button>
      <span className="whero__shadow" aria-hidden />
    </div>
  );
}
