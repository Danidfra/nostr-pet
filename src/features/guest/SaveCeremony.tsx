/**
 * Saving the guest Blobbi: account creation as a moment, not paperwork (M14;
 * M14.2 made the Blobbi alive through it and the words a child's).
 *
 * The home darkens, the Blobbi comes to the middle under a soft glow,
 * breathing, blinking, watching (`CeremonyBlobbi.tsx`), and the steps follow
 * in the visual language of the hatch and the key scene, one thing on the
 * screen at a time:
 *
 *   intro        why: "Ready to explore beyond this little world?" The player
 *                may still say Maybe later; nothing has happened.
 *   key          the key reserved when the egg was made, given with the same
 *                facts, the same ways to keep it and the same acknowledgement
 *                as any new account's (`KeyGift`); Continue signs in with it.
 *                From here the guest record remembers the stage, so a refresh
 *                resumes instead of starting over.
 *   profile      three short steps (a name, a picture, a line about you), each
 *                with Continue, Skip and Back, the Blobbi reacting to each:
 *                one kind 0, written once at the end, or never when every
 *                step was skipped. The words are checked on this device for
 *                the obviously unfriendly (`profile-guard.ts`), gently.
 *   publishing   the Blobbi, then the profile, to the relays; the ring around
 *                the Blobbi fills as each one is accepted, never before. A
 *                failure says which step and offers Try again; the guest
 *                record is kept until everything landed and was read back.
 *   done         "{name} has a new home!": the celebration, then the plain
 *                truth about what that home is, in a few words.
 *
 * Nothing is claimed early: a step is shown done only when a relay accepted
 * its event (or already held it, on a resumed save).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { parseBlobbonautEvent, parseModernBlobbiEvent, type BlobbiCompanion, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';
import { ArrowLeft, Check, Globe2, ImagePlus, KeyRound, Loader2, RotateCcw, Sparkles, UserRound } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import { useSound } from '@/features/sound';
import { useLoginActions } from '@/hooks/useLoginActions';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { KeyGift, KeyStage } from '@/features/onboarding/KeyScene';
import { useProfileSetup } from '@/features/onboarding/useProfileSetup';
import { PROFILE_ABOUT_MAX, PROFILE_NAME_MAX, checkProfileForm, type ProfileFormInput } from '@/features/onboarding/profile-plan';
import { checkPublicText } from '@/features/onboarding/profile-guard';
import { useGuest, useGuestUi } from './useGuest';
import { guestBlobbiEvent } from './guest-world';
import { runGuestMigration, verifyGuestMigration, MIGRATION_STEPS, type MigrationProgress, type MigrationStep, type StepState } from './guest-migration';
import type { GuestDocument } from './guest-store';
import { CeremonyPortrait } from './CeremonyBlobbi';
import { CeremonyStageContext, useCeremonyStage } from './ceremony-stage';
import { useCeremonyLife, type CeremonyLife } from './useCeremonyLife';

export interface SaveCeremonyProps {
  doc: GuestDocument;
  /** The collection's cache updater of the signed-in account, so the published Blobbi is home at once. */
  updateCompanionEvent: (event: NostrEvent) => void;
  /** Over: saved (into the account's home) or backed out of before the key (still a guest). */
  onDone: (saved: boolean) => void;
}

export function SaveCeremony({ doc, updateCompanionEvent, onDone }: SaveCeremonyProps) {
  const guest = useGuest();
  const stage = doc.migration?.stage ?? null;
  const record = guestBlobbiEvent(doc.events, doc.blobbiD);
  const blobbi = useMemo(() => (record ? parseModernBlobbiEvent(record) : undefined), [record]);
  const name = blobbi?.name ?? 'Your Blobbi';
  const reduced = useReducedMotion();

  if (stage === null) return <IntroStep name={name} blobbi={blobbi} reduced={reduced} onGo={() => guest.setStage('key')} onLater={() => onDone(false)} />;
  if (stage === 'key') return <KeyStep doc={doc} name={name} onBack={() => guest.cancelSave()} />;
  if (stage === 'profile') return <ProfileSteps doc={doc} name={name} blobbi={blobbi} reduced={reduced} />;
  return <ConnectStep doc={doc} name={name} blobbi={blobbi} reduced={reduced} updateCompanionEvent={updateCompanionEvent} onDone={() => onDone(true)} />;
}

/* ─── The stage every step stands on ─────────────────────────────────── */

interface SceneProps {
  children: ReactNode;
  reduced: boolean;
  testId: string;
  progress?: number;
  blobbi: BlobbiCompanion | undefined;
  label: string;
  /** The Blobbi's life in this scene (`useCeremonyLife`), which the step's controls drive. */
  life: CeremonyLife;
}

function Scene({ children, reduced, testId, progress, blobbi, label, life }: SceneProps) {
  return (
    <CeremonyStageContext.Provider value={life.stage}>
      <section className="savescene" data-testid={testId} data-reduced={reduced ? 'true' : undefined} role="dialog" aria-modal="true" aria-label={label}>
        <span className="savescene__veil" aria-hidden />
        <span className="savescene__spot" aria-hidden />
        <span className="keyscene__mote keyscene__mote--a" aria-hidden />
        <span className="keyscene__mote keyscene__mote--b" aria-hidden />
        <span className="keyscene__mote keyscene__mote--c" aria-hidden />
        <div className="savescene__scroll">
          <div className="savescene__body-col">
            {blobbi && <CeremonyPortrait blobbi={blobbi} life={life} progress={progress} reduced={reduced} />}
            {children}
          </div>
        </div>
      </section>
    </CeremonyStageContext.Provider>
  );
}

/* ─── intro ──────────────────────────────────────────────────────────── */

function IntroStep({ name, blobbi, reduced, onGo, onLater }: { name: string; blobbi: BlobbiCompanion | undefined; reduced: boolean; onGo: () => void; onLater: () => void }) {
  const { play } = useSound();
  const life = useCeremonyLife({ reduced });
  useEffect(() => {
    play('gather');
  }, [play]);
  return (
    <Scene reduced={reduced} testId="save-intro" blobbi={blobbi} label={`Save ${name}`} life={life}>
      <h2 className="savescene__title">Ready to explore beyond this little world?</h2>
      <p className="savescene__text" data-testid="save-intro-benefit">
        Give {name} a home you can return to from other devices. Your adventures can continue wherever you sign in.
      </p>
      <ul className="savescene__points" aria-label="What saving does">
        <li>
          <Sparkles aria-hidden /> {name} stays exactly the same. Same colours, same name, same stage.
        </li>
        <li>
          <Globe2 aria-hidden /> New worlds can meet {name}: Blobbi Island, Rumble and Nostr Farm.
        </li>
        <li>
          <KeyRound aria-hidden /> You get a little key that opens {name}’s home. Free, and no email needed.
        </li>
      </ul>
      <div className="savescene__actions">
        <button type="button" className="onboard-btn onboard-btn--primary" onClick={onGo} data-testid="save-go">
          <Sparkles className="h-4 w-4" aria-hidden />
          Let’s go
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
  // The one place the reserved secret is asked for: the store hands it over here and nowhere else (`SECURITY.md`)
  const { revealSecret } = guest;
  const account = useMemo(() => {
    const nsec = revealSecret();
    return nsec ? { nsec, pubkey: doc.identity.pubkey, npub: nip19.npubEncode(doc.identity.pubkey) } : null;
  }, [revealSecret, doc.identity.pubkey]);
  const signIn = useCallback(
    (nsec: string) => {
      // The stage first, so a refresh right after signing in resumes at the profile instead of starting over
      guest.setStage('profile');
      login.nsec(nsec);
    },
    [guest, login],
  );
  if (!account) {
    return (
      <div className="savescene savescene--key" data-testid="save-key">
        <KeyStage onBack={onBack} headline={`${name}’s key is not here.`}>
          <p role="alert" className="keyscene__error" data-testid="save-key-missing">
            The key reserved for {name} could not be read on this device, so {name} cannot be saved from here. Nothing was changed.
          </p>
        </KeyStage>
      </div>
    );
  }
  return (
    <div className="savescene savescene--key" data-testid="save-key">
      <KeyGift
        account={account}
        onBack={onBack}
        signIn={signIn}
        headline={`A little key, for ${name} and you.`}
        intro={
          <p className="keyscene__intro" data-testid="save-key-intro">
            {name}’s colours and shape were born from this key. It has waited on this device since the egg, and nothing has been sent anywhere. Now it is yours.
          </p>
        }
        continueLabel={`Save ${name}!`}
        aside="You can see your key again later, in the menu under Account."
      />
    </div>
  );
}

/* ─── profile: three short steps ─────────────────────────────────────── */

type ProfileStepId = 'name' | 'picture' | 'about';
const PROFILE_STEPS: readonly ProfileStepId[] = ['name', 'picture', 'about'];

function ProfileSteps({ doc, name, blobbi, reduced }: { doc: GuestDocument; name: string; blobbi: BlobbiCompanion | undefined; reduced: boolean }) {
  const guest = useGuest();
  const life = useCeremonyLife({ reduced });
  const { publish, upload } = useProfileSetup(doc.identity.pubkey);
  const { mutateAsync } = publish;
  const [at, setAt] = useState(0);
  const [form, setForm] = useState<ProfileFormInput>({ name: '', about: '', picture: '' });
  const [reason, setReason] = useState<string | null>(null);
  const step = PROFILE_STEPS[at];

  const finish = useCallback(() => {
    guest.profileDone();
    guest.setStage('publishing');
  }, [guest]);

  /** The last step passed: one kind 0 with what was given, or nothing at all when nothing was. */
  const complete = useCallback(
    (final: ProfileFormInput) => {
      const anything = final.name.trim() || final.about.trim() || final.picture.trim();
      if (!anything) {
        finish();
        return;
      }
      const check = checkProfileForm(final, { allowEmptyName: true });
      if (!check.ok) {
        setReason(check.reason);
        return;
      }
      void mutateAsync(check.value).then(finish).catch(() => undefined);
    },
    [finish, mutateAsync],
  );

  const go = useCallback(
    (next: ProfileFormInput, how: 'advance' | 'skipped') => {
      setReason(null);
      life.stage.react(how);
      if (at + 1 >= PROFILE_STEPS.length) complete(next);
      else setAt(at + 1);
    },
    [at, complete, life.stage],
  );
  const back = useCallback(() => {
    setReason(null);
    setAt((i) => Math.max(0, i - 1));
  }, []);

  const label = `Who is ${name}’s Blobbonaut? Step ${at + 1} of ${PROFILE_STEPS.length}`;
  return (
    <Scene reduced={reduced} testId="save-profile" blobbi={blobbi} label={label} life={life}>
      <ol className="savescene__dots" aria-label={`Step ${at + 1} of ${PROFILE_STEPS.length}`} data-testid="profile-progress" data-step={at + 1}>
        {PROFILE_STEPS.map((id, i) => (
          <li key={id} className={`savescene__dot ${i < at ? 'savescene__dot--done' : i === at ? 'savescene__dot--now' : ''}`} aria-current={i === at ? 'step' : undefined} />
        ))}
      </ol>
      {step === 'name' && (
        <NameStep
          name={name}
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          reason={reason}
          onReason={setReason}
          onContinue={() => go(form, form.name.trim() ? 'advance' : 'skipped')}
          onSkip={() => go({ ...form, name: '' }, 'skipped')}
          onNamed={() => life.stage.react('named')}
        />
      )}
      {step === 'picture' && (
        <PictureStep
          name={name}
          value={form.picture}
          onChange={(v) => setForm((f) => ({ ...f, picture: v }))}
          onUpload={upload.mutateAsync}
          reason={reason}
          onReason={setReason}
          onContinue={() => go(form, form.picture.trim() ? 'advance' : 'skipped')}
          onSkip={() => go({ ...form, picture: '' }, 'skipped')}
          onBack={back}
        />
      )}
      {step === 'about' && (
        <AboutStep
          name={name}
          value={form.about}
          onChange={(v) => setForm((f) => ({ ...f, about: v }))}
          reason={reason}
          onReason={setReason}
          pending={publish.isPending}
          error={publish.error}
          onContinue={() => go(form, form.about.trim() ? 'advance' : 'skipped')}
          onSkip={() => go({ ...form, about: '' }, 'skipped')}
          onBack={back}
        />
      )}
    </Scene>
  );
}

/** The frame of a profile step: the title, a line, the field, Continue, Skip and Back, in that order. */
function StepFrame({ title, line, children, onContinue, onSkip, onBack, continueLabel = 'Continue', pending = false, reason, error, testId }: { title: string; line: string; children: ReactNode; onContinue: () => void; onSkip: () => void; onBack?: () => void; continueLabel?: string; pending?: boolean; reason: string | null; error?: Error | null; testId: string }) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!pending) onContinue();
  };
  return (
    <form className="savescene__step" onSubmit={submit} data-testid={testId} aria-busy={pending}>
      <h2 className="savescene__title">{title}</h2>
      <p className="savescene__text">{line}</p>
      <div className="savescene__field">{children}</div>
      {reason && (
        <p className="savescene__reason" role="alert" data-testid="profile-reason">
          {reason}
        </p>
      )}
      {error && (
        <p className="savescene__reason" role="alert" data-testid="profile-error">
          {error.message} Try again, or skip this for now.
        </p>
      )}
      <div className="savescene__actions">
        <button type="submit" className="onboard-btn onboard-btn--primary" disabled={pending} data-testid="profile-next">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          {pending ? 'Saving…' : continueLabel}
        </button>
        <div className="savescene__row">
          {onBack && (
            <button type="button" className="savescene__quiet" onClick={onBack} disabled={pending} data-testid="profile-back">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
            </button>
          )}
          <button type="button" className="savescene__quiet" onClick={onSkip} disabled={pending} data-testid="save-profile-skip">
            Skip
          </button>
        </div>
      </div>
    </form>
  );
}

/** A field the Blobbi watches: its eyes on it while it is the player's, curious while they type. */
function useWatchedField(onChange: (v: string) => void) {
  const stage = useCeremonyStage();
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const onFocus = useCallback(() => stage.attend(ref.current), [stage]);
  const onBlur = useCallback(() => {
    stage.attend(null);
    stage.react('quiet');
  }, [stage]);
  const onInput = useCallback(
    (v: string) => {
      onChange(v);
      stage.react('typing');
    },
    [onChange, stage],
  );
  return { ref, onFocus, onBlur, onInput };
}

function NameStep({ name, value, onChange, reason, onReason, onContinue, onSkip, onNamed }: { name: string; value: string; onChange: (v: string) => void; reason: string | null; onReason: (r: string | null) => void; onContinue: () => void; onSkip: () => void; onNamed: () => void }) {
  const stage = useCeremonyStage();
  const field = useWatchedField(onChange);
  const next = () => {
    const trimmed = value.trim();
    if (trimmed.length > PROFILE_NAME_MAX) {
      onReason(`Keep your name under ${PROFILE_NAME_MAX} characters.`);
      return;
    }
    const friendly = checkPublicText(trimmed);
    if (!friendly.ok) {
      onReason(friendly.reason);
      stage.react('displeased');
      return;
    }
    if (trimmed) onNamed();
    onContinue();
  };
  return (
    <StepFrame title={`What should ${name} call you?`} line="Your name, as other players will see it. You can change it any time." onContinue={next} onSkip={onSkip} reason={reason} testId="profile-step-name">
      <label htmlFor="profile-name" className="sr-only">
        Your name
      </label>
      <input
        id="profile-name"
        ref={field.ref}
        value={value}
        onChange={(e) => field.onInput(e.target.value)}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        maxLength={PROFILE_NAME_MAX + 8}
        autoComplete="nickname"
        spellCheck={false}
        placeholder="Your name"
        className="onboard-input savescene__input"
        data-testid="profile-name"
      />
    </StepFrame>
  );
}

function PictureStep({ name, value, onChange, onUpload, reason, onReason, onContinue, onSkip, onBack }: { name: string; value: string; onChange: (v: string) => void; onUpload: (file: File) => Promise<string>; reason: string | null; onReason: (r: string | null) => void; onContinue: () => void; onSkip: () => void; onBack: () => void }) {
  const field = useWatchedField(onChange);
  const stage = useCeremonyStage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    onReason(null);
    try {
      const url = await onUpload(file);
      onChange(url);
      stage.react('named');
    } catch (err) {
      onReason(err instanceof Error ? err.message : 'That picture could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };
  const next = () => {
    const picture = value.trim();
    if (picture) {
      try {
        const url = new URL(picture);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
      } catch {
        onReason('A picture needs a web address, or upload one.');
        return;
      }
    }
    onContinue();
  };
  return (
    <StepFrame title="A picture of you?" line={`Upload one, or paste a link. ${name} already knows your face, so skipping is fine.`} onContinue={next} onSkip={onSkip} onBack={onBack} reason={reason} pending={uploading} testId="profile-step-picture">
      <div className="savescene__picture">
        <span className="savescene__avatar" aria-hidden>
          {value ? <img src={value} alt="" /> : <UserRound />}
        </span>
        <button type="button" className="onboard-btn onboard-btn--secondary" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="profile-upload">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {uploading ? 'Uploading…' : 'Upload a picture'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} data-testid="profile-upload-input" />
      </div>
      <label htmlFor="profile-picture" className="sr-only">
        Picture link
      </label>
      <input
        id="profile-picture"
        ref={field.ref}
        value={value}
        onChange={(e) => field.onInput(e.target.value)}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        placeholder="https://…"
        autoComplete="off"
        spellCheck={false}
        className="onboard-input savescene__input"
        data-testid="profile-picture"
      />
    </StepFrame>
  );
}

function AboutStep({ name, value, onChange, reason, onReason, pending, error, onContinue, onSkip, onBack }: { name: string; value: string; onChange: (v: string) => void; reason: string | null; onReason: (r: string | null) => void; pending: boolean; error: Error | null; onContinue: () => void; onSkip: () => void; onBack: () => void }) {
  const stage = useCeremonyStage();
  const field = useWatchedField(onChange);
  const next = () => {
    const about = value.trim();
    if (about.length > PROFILE_ABOUT_MAX) {
      onReason(`Keep it under ${PROFILE_ABOUT_MAX} characters.`);
      return;
    }
    const friendly = checkPublicText(about);
    if (!friendly.ok) {
      onReason(friendly.reason);
      stage.react('displeased');
      return;
    }
    onContinue();
  };
  return (
    <StepFrame title="A line about you?" line={`A few words for the friends ${name} will make. Optional, like everything here.`} onContinue={next} onSkip={onSkip} onBack={onBack} continueLabel="Finish" reason={reason} error={error} pending={pending} testId="profile-step-about">
      <label htmlFor="profile-about" className="sr-only">
        About you
      </label>
      <textarea
        id="profile-about"
        ref={field.ref}
        value={value}
        onChange={(e) => field.onInput(e.target.value)}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        maxLength={PROFILE_ABOUT_MAX + 20}
        rows={2}
        placeholder="I like…"
        className="onboard-input savescene__input resize-none"
        data-testid="profile-about"
      />
    </StepFrame>
  );
}

/* ─── publishing → done ──────────────────────────────────────────────── */

type Run = { state: 'idle' | 'running' | 'failed' | 'verifying' | 'done'; error?: string; failedStep?: MigrationStep };

function ConnectStep({ doc, name, blobbi, reduced, updateCompanionEvent, onDone }: { doc: GuestDocument; name: string; blobbi: BlobbiCompanion | undefined; reduced: boolean; updateCompanionEvent: (event: NostrEvent) => void; onDone: () => void }) {
  const guest = useGuest();
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const { play } = useSound();
  const life = useCeremonyLife({ reduced });
  const [steps, setSteps] = useState<Record<MigrationStep, StepState>>({ blobbi: 'waiting', profile: 'waiting' });
  const [run, setRun] = useState<Run>({ state: 'idle' });
  const running = useRef(false);
  const latest = useRef({ doc, updateCompanionEvent });
  latest.current = { doc, updateCompanionEvent };
  const stepLabel: Record<MigrationStep, string> = { blobbi: name, profile: 'Your profile' };

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
  const { markSaved } = useGuestUi();
  const { react } = life.stage;
  useEffect(() => {
    if (run.state === 'done') {
      markSaved();
      react('complete');
    }
  }, [run.state, markSaved, react]);

  useEffect(() => {
    void start();
    // Once, when the step is shown (Try again calls `start` itself)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = MIGRATION_STEPS.filter((s) => steps[s] === 'landed' || steps[s] === 'found').length;
  const done = run.state === 'done';
  return (
    <Scene reduced={reduced} testId="save-connect" blobbi={blobbi} progress={done ? MIGRATION_STEPS.length : progress} label={done ? `${name} has a new home` : `Saving ${name}`} life={life}>
      <h2 className="savescene__title" data-testid="save-connect-title">
        {done ? `${name} has a new home!` : run.state === 'failed' ? 'Not quite yet.' : `Giving ${name} a home…`}
      </h2>
      {!done && (
        <ol className="savescene__steps" aria-label="Saving" data-testid="save-steps">
          {MIGRATION_STEPS.map((step) => (
            <li key={step} data-step={step} data-state={steps[step]} data-testid={`save-step-${step}`}>
              <span className="savescene__step-mark" aria-hidden>
                {steps[step] === 'landed' || steps[step] === 'found' ? <Check className="h-3.5 w-3.5" /> : steps[step] === 'failed' ? '!' : steps[step] === 'waiting' ? '' : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </span>
              <span>
                {stepLabel[step]}
                {steps[step] === 'found' && <span className="savescene__step-note"> (already there)</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {done && (
        <ol className="savescene__steps savescene__steps--done sr-only" aria-label="Saved" data-testid="save-steps">
          {MIGRATION_STEPS.map((step) => (
            <li key={step} data-step={step} data-state={steps[step]} data-testid={`save-step-${step}`}>
              {stepLabel[step]}
            </li>
          ))}
        </ol>
      )}
      {run.state === 'verifying' && (
        <p className="savescene__text" role="status" data-testid="save-verifying">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden /> Making sure {name} is really there…
        </p>
      )}
      {run.state === 'failed' && (
        <div className="savescene__failed" role="alert" data-testid="save-failed">
          <p className="font-semibold">{run.failedStep ? `${stepLabel[run.failedStep]} did not get through.` : 'Something did not get through.'}</p>
          <p className="text-sm opacity-80">
            {run.error} {name} is still safe on this device. Nothing was lost.
          </p>
          <button type="button" className="onboard-btn onboard-btn--primary mt-3" onClick={() => void start()} data-testid="save-retry">
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      )}
      {done && (
        <>
          <p className="savescene__text" data-testid="save-done-text">
            Your little friend is now connected to a bigger world. You hold the key to that home.
          </p>
          <p className="savescene__fine" data-testid="save-done-nostr">
            That world is powered by Nostr, an open network where your identity belongs to you. Keep your key safe. It is the only way back in.
          </p>
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={finish} data-testid="save-done">
            <Sparkles className="h-4 w-4" aria-hidden /> Back to {name}
          </button>
        </>
      )}
    </Scene>
  );
}
