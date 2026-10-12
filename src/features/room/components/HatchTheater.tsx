/**
 * The hatch, as a small piece of theatre over the room: the room darkens, the
 * player's own egg comes to the middle under a soft light, stirs, cracks
 * (the renderer's own shell drawings), holds still for a breath, and light
 * bursts out while the egg → baby transition is written. Only when the write
 * has landed does the light clear on the baby (the same Blobbi: same address,
 * same seed, drawn by the canonical renderer from the live collection), which
 * looks around, notices the player, blushes, hops for joy, and is let go into
 * its home.
 *
 * The beats and the write are the lifecycle ceremony's (`useLifecycleCeremony`):
 * one write at exactly one point, a reveal only after it landed, a failure
 * that leaves the egg an egg with Try again and Later. Nothing here signs or
 * publishes; `perform` does (the kit's hatch, which re-reads the Blobbi fresh
 * and refuses one that has already hatched, so a second device or a second
 * tap cannot write a second hatch).
 *
 * Reduced motion: no rocking, no hops, no burst; the shell's drawings, the
 * faces and the words tell it, quicker. Sound only when the player turned it on.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlobbiRenderer, type BlobbiVisualEffect } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { useLifecycleCeremony, hatchOnScreen, type CeremonyTimings } from '@/features/lifecycle';
import { REDUCED_THEATER_TIMINGS, THEATER_TIMINGS, VEIL_MS, revealMoment } from '../lib/hatch-theater';
import type { BlobbiSoundId } from '@/features/sound/sounds';

export interface HatchTheaterProps {
  /** The Blobbi, live from the collection: an egg until the write lands, the baby after. */
  blobbi: BlobbiCompanion;
  /** The egg → baby write (with whatever checks precede it); resolves true when it landed. */
  perform: () => Promise<boolean>;
  /** Why the last write failed, in the player's words, if the lifecycle knows. */
  error?: string | null;
  reducedMotion: boolean;
  play: (sound: BlobbiSoundId) => void;
  /** The theatre is over: hatched (into the room), or put off until later (the egg stays an egg). */
  onDone: (hatched: boolean) => void;
  /** Test seam: the beats' pace (the theatre's own, or its reduced-motion pace, otherwise). */
  timings?: CeremonyTimings;
}

export function HatchTheater({ blobbi, perform, error, reducedMotion, play, onDone, timings }: HatchTheaterProps) {
  const latest = useRef({ perform, onDone, play });
  latest.current = { perform, onDone, play };
  const [revealAt, setRevealAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const ceremony = useLifecycleCeremony({
    perform: () => latest.current.perform(),
    reducedMotion,
    timings: timings ?? (reducedMotion ? REDUCED_THEATER_TIMINGS : THEATER_TIMINGS),
    onReveal: () => {
      setRevealAt(performance.now());
      latest.current.play('hatch');
    },
  });
  const { start, phase, step, dismiss } = ceremony;

  // The room darkens, then the egg is presented and the story begins. No "started" flag of its own: the ceremony
  // ignores a start while one runs, and a flag set in an effect would block the re-run StrictMode makes (the timer
  // of the first run is cleared by its cleanup), so the hatch would never begin
  useEffect(() => {
    const timer = setTimeout(() => start('hatch'), reducedMotion ? 150 : VEIL_MS);
    return () => clearTimeout(timer);
  }, [start, reducedMotion]);

  // A crack is heard as it appears; the light gathering, as it gathers
  const lastStep = useRef(0);
  useEffect(() => {
    if (phase === 'building' && step > lastStep.current) latest.current.play('crack');
    if (phase === 'publishing' && lastStep.current !== 4) latest.current.play('gather');
    lastStep.current = phase === 'publishing' ? 4 : step;
  }, [phase, step]);

  // The reveal's own clock: what the baby does moment by moment
  useEffect(() => {
    if (revealAt === null) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now() - revealAt);
      frame = requestAnimationFrame(tick);
    };
    tick();
    const interval = setInterval(() => setNow(performance.now() - revealAt), 120);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [revealAt]);
  const moment = revealAt === null ? null : revealMoment(now, reducedMotion);
  const noticed = useRef(false);
  const cheered = useRef(false);
  useEffect(() => {
    if (!moment) return;
    if (!noticed.current && now >= (reducedMotion ? 900 : 1_800)) {
      noticed.current = true;
      latest.current.play('curious');
    }
    if (!cheered.current && now >= (reducedMotion ? 1_800 : 3_400)) {
      cheered.current = true;
      latest.current.play('happy');
    }
  }, [moment, now, reducedMotion]);

  // The ceremony back at rest after a reveal: the theatre hands the Blobbi to its home
  const revealed = useRef(false);
  if (phase === 'revealing') revealed.current = true;
  useEffect(() => {
    if (phase === 'idle' && revealed.current) latest.current.onDone(true);
  }, [phase]);

  const presentation = hatchOnScreen(ceremony.presentation.hatch, blobbi.stage);
  const beat = phase === 'failed' ? 'failed' : presentation?.beat ?? 'presenting';
  const showBaby = blobbi.stage !== 'egg' && phase === 'revealing';
  const effects: readonly BlobbiVisualEffect[] = useMemo(() => (showBaby && !reducedMotion ? [{ id: 'golden-sparkles', intensity: 0.9 }] : []), [showBaby, reducedMotion]);
  const visual = useMemo(() => toBlobbiVisual(blobbi), [blobbi]);
  const caption =
    phase === 'failed' ? null
    : showBaby && moment ? (moment.caption === 'none' ? null : moment.caption === 'hatched' ? `${blobbi.name} has hatched!` : `Welcome home, ${blobbi.name}`)
    : beat === 'stirring' ? 'Something is moving inside…'
    : beat === 'cracking' ? 'The shell is cracking…'
    : beat === 'breaking' ? 'Almost…'
    : beat === 'hatching' ? (phase === 'publishing' ? 'Here it comes…' : '…')
    : null;

  return (
    <div className="hatch-theater" data-testid="hatch-theater" data-beat={beat} data-phase={phase} data-reduced={reducedMotion ? 'true' : undefined} role="dialog" aria-modal="true" aria-label={`${blobbi.name} is hatching`}>
      <div className="hatch-theater__veil" aria-hidden />
      <div className="hatch-theater__light" aria-hidden />
      <div className="hatch-theater__stage">
        <div className="hatch-theater__burst" data-burst={presentation?.burst ?? 'none'} aria-hidden />
        <div className="hatch-theater__actor" data-rock={reducedMotion ? 0 : presentation?.rock ?? 0} data-hop={moment?.hop && !reducedMotion ? 'true' : undefined} data-testid="hatch-theater-actor" data-stage={showBaby ? blobbi.stage : 'egg'}>
          <BlobbiRenderer
            visual={visual}
            instanceId={`hatch-${blobbi.d}`}
            size="100%"
            eggCrack={showBaby ? undefined : (ceremony.presentation.eggCrack ?? 'none')}
            effects={effects}
            expression={showBaby ? moment?.face : undefined}
            eyeOffset={showBaby ? moment?.eyes : undefined}
            transparent
            style={{ width: '100%', height: '100%' }}
            label={blobbi.name}
          />
        </div>
        <span className="hatch-theater__shadow" aria-hidden />
      </div>
      <p className="hatch-theater__caption" role="status" aria-live="polite" data-testid="hatch-theater-caption">
        {caption ?? ' '}
      </p>
      {phase === 'publishing' && (
        <p className="hatch-theater__note" data-testid="hatch-theater-writing">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving the hatch to your account
        </p>
      )}
      {showBaby && moment?.caption === 'home' && (
        <button type="button" className="onboard-btn onboard-btn--primary hatch-theater__go" onClick={() => latest.current.onDone(true)} data-testid="hatch-theater-continue">
          <Sparkles className="h-4 w-4" aria-hidden /> Go home
        </button>
      )}
      {phase === 'failed' && (
        <div className="hatch-theater__failed" role="alert" data-testid="hatch-theater-failed">
          <p className="font-semibold">The egg did not hatch yet.</p>
          <p className="text-sm opacity-80">{error || ceremony.error?.message || 'The change did not reach the relays.'} Nothing was changed; your egg is safe.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="onboard-btn onboard-btn--secondary" onClick={() => latest.current.onDone(false)} data-testid="hatch-theater-later">
              Later
            </button>
            <button
              type="button"
              className="onboard-btn onboard-btn--primary"
              onClick={() => {
                dismiss();
                setTimeout(() => start('hatch'), 50);
              }}
              data-testid="hatch-theater-retry"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
