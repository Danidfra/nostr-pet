/**
 * The hatch, as a small piece of theatre over the room, in the player's
 * hands (M12.3). The room darkens, the player's own egg comes to the middle
 * under a soft light and stirs, and a word invites a tap. Each tap is a
 * crack (the renderer's own shell drawings: light, medium, heavy), with a
 * jolt, a sound and a stronger rocking; the last tap opens the shell, light
 * bursts out, and the egg → baby transition is written. Only when the write
 * has landed and the collection holds the baby does the light clear on it
 * (the same Blobbi: same address, same seed, drawn by the canonical
 * renderer), which looks around, notices the player, blushes, hops for joy,
 * and is let go into its home.
 *
 * One write, at one point: the tap that opens the shell. A guard of the
 * theatre's own keeps a drumroll of taps, a double tap or Try again from
 * ever starting a second; `perform` is the room's (the first egg's relay
 * confirmation, then the kit's hatch, which re-reads the Blobbi fresh and
 * refuses one already hatched). A failed write leaves the egg an egg, says
 * so, and offers Try again (the write again, no taps asked twice) and Later
 * (the room keeps its invitation; the next visit starts the shell whole).
 * A refresh at any point before the write lands starts the shell whole
 * again; after it landed, the baby is simply there. Hatched on another
 * device meanwhile: the collection says baby, and the theatre shows it.
 *
 * Nothing is timed against the player: no tap is too slow. "Hatch it for
 * me" taps for whoever cannot tap again and again. The egg is a real button
 * (Enter or Space is a tap) and holds the focus. Reduced motion: no rocking,
 * no jolts, no burst; the shell's drawings, the words and the faces tell it.
 * Sound only when the player turned it on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlobbiRenderer, type BlobbiVisualEffect } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { Loader2, RotateCcw, Sparkles, Wand2 } from 'lucide-react';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { AUTO_TAP_MS, REDUCED_AUTO_TAP_MS, REDUCED_THEATER_TIMINGS, TAPS_TO_HATCH, THEATER_TIMINGS, crackForTaps, revealMoment, tapCaption, tapCounts } from '../lib/hatch-theater';
import type { CeremonyTimings } from '@/features/lifecycle';
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
  /** The theatre is over: hatched (into the room), or put off until later after a failure (the egg stays an egg). */
  onDone: (hatched: boolean) => void;
  /** Test seam: the reveal's pace and the burst's least time (the theatre's own, or its reduced-motion pace). */
  timings?: CeremonyTimings;
}

/** Where the theatre is: the shell in the player's hands, the write out, the baby shown, or a write that failed. */
export type TheaterPhase = 'tapping' | 'writing' | 'revealing' | 'failed';

export function HatchTheater({ blobbi, perform, error, reducedMotion, play, onDone, timings }: HatchTheaterProps) {
  const t = timings ?? (reducedMotion ? REDUCED_THEATER_TIMINGS : THEATER_TIMINGS);
  const latest = useRef({ perform, onDone, play });
  latest.current = { perform, onDone, play };
  const [taps, setTaps] = useState(0);
  const [phase, setPhase] = useState<TheaterPhase>('tapping');
  const [auto, setAuto] = useState(false);
  const lastTapAt = useRef<number | null>(null);
  // The one write: set when it starts, cleared only by a failure (Try again), never by a tap
  const writing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const write = useCallback(async () => {
    if (writing.current) return;
    writing.current = true;
    setPhase('writing');
    latest.current.play('gather');
    // The light covers the shell for at least its moment, however quickly the relays answer
    const [landed] = await Promise.all([
      latest.current.perform().catch(() => false),
      t.burstMs ? new Promise((resolve) => setTimeout(resolve, t.burstMs)) : undefined,
    ]);
    if (!mounted.current) return;
    if (landed) {
      // The reveal waits for the collection to hold the baby (the effect below)
      setPhase('revealing');
      return;
    }
    writing.current = false;
    setPhase('failed');
  }, [t.burstMs]);

  const tap = useCallback(() => {
    if (phase !== 'tapping') return;
    const now = performance.now();
    if (!tapCounts(taps, lastTapAt.current, now)) return;
    lastTapAt.current = now;
    const next = taps + 1;
    setTaps(next);
    if (next >= TAPS_TO_HATCH) {
      void write();
      return;
    }
    latest.current.play('crack');
  }, [phase, taps, write]);

  // "Hatch it for me": the same taps, made at an easy pace, stopping once the shell opens
  useEffect(() => {
    if (!auto || phase !== 'tapping') return;
    const timer = setTimeout(tap, taps === 0 ? 200 : reducedMotion ? REDUCED_AUTO_TAP_MS : AUTO_TAP_MS);
    return () => clearTimeout(timer);
  }, [auto, phase, taps, tap, reducedMotion]);

  // The canonical record decides: a baby in the collection is hatched, whether by this write or by another device
  const hatched = blobbi.stage !== 'egg';
  const [revealAt, setRevealAt] = useState<number | null>(null);
  useEffect(() => {
    if (!hatched || revealAt !== null) return;
    writing.current = true;
    setPhase('revealing');
    setRevealAt(performance.now());
    latest.current.play('hatch');
  }, [hatched, revealAt]);

  // The reveal's own clock: what the baby does moment by moment, then home
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (revealAt === null) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now() - revealAt);
      frame = requestAnimationFrame(tick);
    };
    tick();
    const interval = setInterval(() => setNow(performance.now() - revealAt), 120);
    const done = setTimeout(() => latest.current.onDone(true), t.revealMs + 1_600);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [revealAt, t.revealMs]);
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

  const showBaby = hatched && revealAt !== null;
  const opening = phase === 'writing' || (phase === 'revealing' && !showBaby);
  const crack = crackForTaps(taps);
  const effects: readonly BlobbiVisualEffect[] = useMemo(() => {
    if (showBaby) return reducedMotion ? [] : [{ id: 'golden-sparkles', intensity: 0.9 }];
    return [{ id: 'solar-radiance', intensity: 0.4 + Math.min(taps, 3) * 0.25 }];
  }, [showBaby, reducedMotion, taps]);
  const visual = useMemo(() => toBlobbiVisual(blobbi), [blobbi]);
  const caption =
    phase === 'failed' ? null
    : showBaby && moment ? (moment.caption === 'none' ? null : moment.caption === 'hatched' ? `${blobbi.name} has hatched!` : `Welcome home, ${blobbi.name}`)
    : opening ? tapCaption(TAPS_TO_HATCH)
    : tapCaption(taps);
  // The beat the room's stylesheet draws: the shell stirring, cracking, about to give, the light, the baby
  const beat = phase === 'failed' ? 'failed' : showBaby ? 'hatched' : opening ? 'hatching' : taps === 0 ? 'stirring' : taps >= 3 ? 'breaking' : 'cracking';
  const burst = showBaby ? 'out' : opening && !reducedMotion ? 'in' : 'none';

  return (
    <div
      className="hatch-theater"
      data-testid="hatch-theater"
      data-beat={beat}
      data-phase={opening ? 'publishing' : phase}
      data-taps={taps}
      data-reduced={reducedMotion ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`${blobbi.name} is hatching`}
    >
      <div className="hatch-theater__veil" aria-hidden />
      <div className="hatch-theater__light" aria-hidden />
      <div className="hatch-theater__stage">
        <div className="hatch-theater__burst" data-burst={burst} aria-hidden />
        <div
          className="hatch-theater__actor"
          data-rock={reducedMotion || phase !== 'tapping' ? 0 : Math.min(taps, 3)}
          data-hop={moment?.hop && !reducedMotion ? 'true' : undefined}
          data-ready={phase === 'tapping' && taps === 0 && !reducedMotion ? 'true' : undefined}
          data-testid="hatch-theater-actor"
          data-stage={showBaby ? blobbi.stage : 'egg'}
          data-crack={showBaby ? undefined : crack}
        >
          {/* Each tap jolts the shell (two names, so the same jolt plays again on the next tap without a remount) */}
          <div className="hatch-theater__shell" data-jolt={!reducedMotion && phase === 'tapping' && taps > 0 ? (taps % 2 ? 'a' : 'b') : undefined}>
            <BlobbiRenderer
              visual={visual}
              instanceId={`hatch-${blobbi.d}`}
              size="100%"
              eggCrack={showBaby ? undefined : crack}
              effects={effects}
              expression={showBaby ? moment?.face : undefined}
              eyeOffset={showBaby ? moment?.eyes : undefined}
              transparent
              style={{ width: '100%', height: '100%' }}
              label={blobbi.name}
            />
          </div>
        </div>
        {/* A flash of light from the new crack: one small element, made again for each counted tap */}
        {taps > 0 && phase === 'tapping' && <span key={taps} className="hatch-theater__flash" data-testid="hatch-theater-flash" aria-hidden />}
        <span className="hatch-theater__shadow" aria-hidden />
        {phase === 'tapping' && (
          <button
            type="button"
            className="hatch-theater__tap"
            onClick={tap}
            // The egg takes the focus as it is presented, so Enter or Space is a tap from the first moment
            autoFocus
            aria-label={`Tap ${blobbi.name} to crack the shell, ${taps} of ${TAPS_TO_HATCH}`}
            data-testid="hatch-theater-egg"
          />
        )}
      </div>
      <p className="hatch-theater__caption" role="status" aria-live="polite" data-testid="hatch-theater-caption">
        {caption ?? ' '}
      </p>
      {phase === 'tapping' && !auto && (
        <button type="button" className="hatch-theater__quiet" onClick={() => setAuto(true)} data-testid="hatch-theater-auto">
          <Wand2 className="h-3.5 w-3.5" aria-hidden /> Hatch it for me
        </button>
      )}
      {opening && (
        <p className="hatch-theater__note" data-testid="hatch-theater-writing">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving the hatch to your account
        </p>
      )}
      {showBaby && moment?.caption === 'home' && (
        <button type="button" className="onboard-btn onboard-btn--primary hatch-theater__go" onClick={() => latest.current.onDone(true)} data-testid="hatch-theater-continue">
          <Sparkles className="h-4 w-4" aria-hidden /> Go home
        </button>
      )}
      {phase === 'failed' && !hatched && (
        <div className="hatch-theater__failed" role="alert" data-testid="hatch-theater-failed">
          <p className="font-semibold">The egg did not hatch yet.</p>
          <p className="text-sm opacity-80">{error || 'The change did not reach the relays.'} Nothing was changed; your egg is safe.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="onboard-btn onboard-btn--secondary" onClick={() => latest.current.onDone(false)} data-testid="hatch-theater-later">
              Later
            </button>
            <button type="button" className="onboard-btn onboard-btn--primary" onClick={() => void write()} data-testid="hatch-theater-retry">
              <RotateCcw className="h-4 w-4" aria-hidden /> Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
