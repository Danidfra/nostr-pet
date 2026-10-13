/**
 * Saving the guest Blobbi: account creation as a moment, not paperwork (M14).
 *
 * The home darkens, the Blobbi comes to the middle under a soft glow, and
 * the steps follow in the visual language of the hatch and the key scene:
 *
 *   intro        why: "Let's give {name} a place in the wider world." The player
 *                may still say Maybe later; nothing has happened.
 *   key          the key reserved when the egg was made, given with the same
 *                facts, the same ways to keep it and the same acknowledgement
 *                as any new account's (`KeyGift`); Continue signs in with it.
 *                From here the guest record remembers the stage, so a refresh
 *                resumes instead of starting over.
 *   profile      a name, a picture, a line about you (the standard kind 0);
 *                every field optional, Skip is a full answer.
 *   publishing   the Blobbi, then the profile, to the relays; the ring around
 *                the Blobbi fills as each one is accepted, never before. A
 *                failure says which step and offers Try again; the guest
 *                record is kept until everything landed and was read back.
 *   done         "{name} is connected!": the worlds are open.
 *
 * Nothing is claimed early: a step is shown done only when a relay accepted
 * its event (or already held it, on a resumed save).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { parseBlobbonautEvent, parseModernBlobbiEvent, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';
import { Check, Globe2, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import { useSound } from '@/features/sound';
import { useLoginActions } from '@/hooks/useLoginActions';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { KeyGift } from '@/features/onboarding/KeyScene';
import { ProfileForm } from '@/features/onboarding/screens';
import { useProfileSetup } from '@/features/onboarding/useProfileSetup';
import { useGuest } from './useGuest';
import { guestBlobbiEvent } from './guest-world';
import { runGuestMigration, verifyGuestMigration, MIGRATION_STEPS, type MigrationProgress, type MigrationStep, type StepState } from './guest-migration';
import type { GuestDocument } from './guest-store';

export interface SaveCeremonyProps {
  doc: GuestDocument;
  /** The collection's cache updater of the signed-in account, so the published Blobbi is home at once. */
  updateCompanionEvent: (event: NostrEvent) => void;
  /** Over: saved (into the account's home) or backed out of before the key (still a guest). */
  onDone: (saved: boolean) => void;
}

const STEP_LABEL: Record<MigrationStep, string> = { blobbi: 'Your Blobbi', profile: 'Your Blobbonaut profile' };

export function SaveCeremony({ doc, updateCompanionEvent, onDone }: SaveCeremonyProps) {
  const guest = useGuest();
  const stage = doc.migration?.stage ?? null;
  const record = guestBlobbiEvent(doc.events, doc.blobbiD);
  const blobbi = useMemo(() => (record ? parseModernBlobbiEvent(record) : undefined), [record]);
  const name = blobbi?.name ?? 'Your Blobbi';
  const reduced = useReducedMotion();

  if (stage === null) return <IntroStep name={name} blobbi={blobbi} reduced={reduced} onGo={() => guest.setStage('key')} onLater={() => onDone(false)} />;
  if (stage === 'key') return <KeyStep doc={doc} name={name} onBack={() => guest.cancelSave()} />;
  if (stage === 'profile') return <ProfileStep doc={doc} name={name} blobbi={blobbi} reduced={reduced} />;
  return <ConnectStep doc={doc} name={name} blobbi={blobbi} reduced={reduced} updateCompanionEvent={updateCompanionEvent} onDone={() => onDone(true)} />;
}

/* ─── The stage every step stands on ─────────────────────────────────── */

function Scene({ children, reduced, testId, progress, blobbi, label }: { children: React.ReactNode; reduced: boolean; testId: string; progress?: number; blobbi: ReturnType<typeof parseModernBlobbiEvent> | undefined; label: string }) {
  return (
    <section className="savescene" data-testid={testId} data-reduced={reduced ? 'true' : undefined} role="dialog" aria-modal="true" aria-label={label}>
      <span className="savescene__veil" aria-hidden />
      <span className="savescene__spot" aria-hidden />
      <span className="keyscene__mote keyscene__mote--a" aria-hidden />
      <span className="keyscene__mote keyscene__mote--b" aria-hidden />
      <span className="keyscene__mote keyscene__mote--c" aria-hidden />
      <div className="savescene__scroll">
        <div className="savescene__body">
          {blobbi && (
            <div className="savescene__portrait" data-progress={progress ?? 0} data-testid="save-portrait">
              <span className="savescene__ring" aria-hidden />
              <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`save-${blobbi.d}`} size="100%" transparent style={{ width: '100%', height: '100%' }} expression="happy" label={blobbi.name} />
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

/* ─── intro ──────────────────────────────────────────────────────────── */

function IntroStep({ name, blobbi, reduced, onGo, onLater }: { name: string; blobbi: ReturnType<typeof parseModernBlobbiEvent> | undefined; reduced: boolean; onGo: () => void; onLater: () => void }) {
  const { play } = useSound();
  useEffect(() => {
    play('gather');
  }, [play]);
  return (
    <Scene reduced={reduced} testId="save-intro" blobbi={blobbi} label={`Save ${name}`}>
      <h2 className="savescene__title">Let’s give {name} a place in the wider world.</h2>
      <ul className="savescene__points" aria-label="What saving does">
        <li>
          <Sparkles aria-hidden /> {name} keeps the colours, the name and everything you have shared: the very same Blobbi.
        </li>
        <li>
          <Globe2 aria-hidden /> A key only you hold opens the door to Blobbi Island and the other worlds.
        </li>
        <li>
          <Check aria-hidden /> Free, no email. You get the key, you keep it safe, and {name} is yours wherever you sign in.
        </li>
      </ul>
      <div className="savescene__actions">
        <button type="button" className="onboard-btn onboard-btn--primary" onClick={onGo} data-testid="save-go">
          <Sparkles className="h-4 w-4" aria-hidden />
          Let’s do it
        </button>
        <button type="button" className="savescene__quiet" onClick={onLater} data-testid="save-later">
          Maybe later
        </button>
      </div>
    </Scene>
  );
}

/* ─── key ────────────────────────────────────────────────────────────── */

function KeyStep({ doc, name, onBack }: { doc: GuestDocument; name: string; onBack: () => void }) {
  const guest = useGuest();
  const login = useLoginActions();
  const account = useMemo(() => ({ nsec: doc.identity.nsec, pubkey: doc.identity.pubkey, npub: nip19.npubEncode(doc.identity.pubkey) }), [doc.identity]);
  const signIn = useCallback(
    (nsec: string) => {
      // The stage first, so a refresh right after signing in resumes at the profile instead of starting over
      guest.setStage('profile');
      login.nsec(nsec);
    },
    [guest, login],
  );
  return (
    <div className="savescene savescene--key" data-testid="save-key">
      <KeyGift
        account={account}
        onBack={onBack}
        signIn={signIn}
        headline={`A little key, for ${name} and you.`}
        intro={
          <p className="keyscene__intro" data-testid="save-key-intro">
            {name}’s colours and shape were born from this key, which has been waiting on this device since the egg. Nothing has been sent anywhere. It is yours
            now.
          </p>
        }
        continueLabel={`Save ${name}!`}
        aside="You can see your key again later in the menu, under Account."
      />
    </div>
  );
}

/* ─── profile ────────────────────────────────────────────────────────── */

function ProfileStep({ doc, name, blobbi, reduced }: { doc: GuestDocument; name: string; blobbi: ReturnType<typeof parseModernBlobbiEvent> | undefined; reduced: boolean }) {
  const guest = useGuest();
  const { publish, upload } = useProfileSetup(doc.identity.pubkey);
  const { mutateAsync } = publish;
  const next = useCallback(() => {
    guest.profileDone();
    guest.setStage('publishing');
  }, [guest]);
  return (
    <Scene reduced={reduced} testId="save-profile" blobbi={blobbi} label="Who are you?">
      <h2 className="savescene__title">Who is {name}’s Blobbonaut?</h2>
      <p className="savescene__text">A name and a picture for you, shared with every app you sign into with your key. All of it optional; {name} does not mind.</p>
      <div className="savescene__card">
        <ProfileForm existing={undefined} onSave={(form) => mutateAsync(form).then(next).catch(() => undefined)} onUpload={upload.mutateAsync} pending={publish.isPending} error={publish.error} />
      </div>
      <button type="button" className="savescene__quiet" onClick={next} disabled={publish.isPending} data-testid="save-profile-skip">
        Skip for now
      </button>
    </Scene>
  );
}

/* ─── publishing → done ──────────────────────────────────────────────── */

type Run = { state: 'idle' | 'running' | 'failed' | 'verifying' | 'done'; error?: string; failedStep?: MigrationStep };

function ConnectStep({ doc, name, blobbi, reduced, updateCompanionEvent, onDone }: { doc: GuestDocument; name: string; blobbi: ReturnType<typeof parseModernBlobbiEvent> | undefined; reduced: boolean; updateCompanionEvent: (event: NostrEvent) => void; onDone: () => void }) {
  const guest = useGuest();
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const { play } = useSound();
  const [steps, setSteps] = useState<Record<MigrationStep, StepState>>({ blobbi: 'waiting', profile: 'waiting' });
  const [run, setRun] = useState<Run>({ state: 'idle' });
  const running = useRef(false);
  const latest = useRef({ doc, updateCompanionEvent });
  latest.current = { doc, updateCompanionEvent };

  const landed = useCallback(
    (step: MigrationStep, event: NostrEvent) => {
      guest.recordLanded(step, event.id);
      if (step === 'blobbi') latest.current.updateCompanionEvent(event);
      if (step === 'profile') {
        const parsed = parseBlobbonautEvent(event);
        if (parsed) queryClient.setQueryData<BlobbonautProfile | null>(['blobbonaut-profile', latest.current.doc.identity.pubkey], parsed);
      }
    },
    [guest, queryClient],
  );

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRun({ state: 'running' });
    const onProgress = ({ step, state }: MigrationProgress) => setSteps((s) => ({ ...s, [step]: state }));
    try {
      const outcome = await runGuestMigration({ doc: latest.current.doc, nostr, publisher, onLanded: landed, onProgress });
      if (!outcome.ok) {
        setRun({ state: 'failed', error: outcome.error.message, failedStep: outcome.step });
        return;
      }
      guest.setStage('verifying');
      setRun({ state: 'verifying' });
      const verified = await verifyGuestMigration(latest.current.doc, nostr);
      play('hatch');
      setRun({ state: 'done' });
      // Confirmed: the record has done its work and goes when the player leaves the scene (`finish`); a refresh before
      // that lets it go too (`useFinishSave`). Not confirmed yet: it stays `verifying`, and the home confirms it later.
      if (verified) guest.setStage('done');
    } finally {
      running.current = false;
    }
  }, [nostr, publisher, landed, guest, play]);
  const finish = useCallback(() => {
    if (latest.current.doc.migration?.stage === 'done') guest.clear();
    onDone();
  }, [guest, onDone]);

  useEffect(() => {
    void start();
    // Once, when the step is shown (Try again calls `start` itself)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = MIGRATION_STEPS.filter((s) => steps[s] === 'landed' || steps[s] === 'found').length;
  const done = run.state === 'done';
  return (
    <Scene reduced={reduced} testId="save-connect" blobbi={blobbi} progress={done ? MIGRATION_STEPS.length : progress} label={done ? `${name} is connected` : `Saving ${name}`}>
      <h2 className="savescene__title" data-testid="save-connect-title">
        {done ? `${name} is connected!` : run.state === 'failed' ? 'Not quite yet.' : `Connecting ${name} to the world…`}
      </h2>
      <ol className="savescene__steps" aria-label="Saving" data-testid="save-steps">
        {MIGRATION_STEPS.map((step) => (
          <li key={step} data-step={step} data-state={steps[step]} data-testid={`save-step-${step}`}>
            <span className="savescene__step-mark" aria-hidden>
              {steps[step] === 'landed' || steps[step] === 'found' ? <Check className="h-3.5 w-3.5" /> : steps[step] === 'failed' ? '!' : steps[step] === 'waiting' ? '' : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </span>
            <span>
              {STEP_LABEL[step]}
              {steps[step] === 'found' && <span className="savescene__step-note"> (already there)</span>}
            </span>
          </li>
        ))}
      </ol>
      {run.state === 'verifying' && (
        <p className="savescene__text" role="status" data-testid="save-verifying">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden /> Reading it back from the relays…
        </p>
      )}
      {run.state === 'failed' && (
        <div className="savescene__failed" role="alert" data-testid="save-failed">
          <p className="font-semibold">{run.failedStep ? `${STEP_LABEL[run.failedStep]} did not reach the relays.` : 'Something did not reach the relays.'}</p>
          <p className="text-sm opacity-80">{run.error} {name} is still safe on this device; nothing was lost.</p>
          <button type="button" className="onboard-btn onboard-btn--primary mt-3" onClick={() => void start()} data-testid="save-retry">
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      )}
      {done && (
        <>
          <p className="savescene__text" data-testid="save-done-text">
            {name} now has a home on Nostr, under your key. The worlds are open: Blobbi Island, Blobbi Rumble, Nostr Farm and whatever comes next.
          </p>
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={finish} data-testid="save-done">
            <Sparkles className="h-4 w-4" aria-hidden /> Back to {name}
          </button>
        </>
      )}
    </Scene>
  );
}
