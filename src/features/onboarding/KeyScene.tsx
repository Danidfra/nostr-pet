/**
 * The secret key, given (M12.3): not a card of paragraphs but a moment, in
 * the visual language of the hatch and the evolution. The welcome's world
 * darkens, a soft light falls on a glowing key, a few motes drift, and the
 * key itself is the protagonist: "A little key, just for you."
 *
 * What it is, said before anything can be done with it, in four short lines
 * that are never hidden: it is a secret key; whoever has it can open the
 * account; losing it can mean losing the account for good; Blobbi cannot
 * recover it. Then the key, readable, and the two ways to keep it: Copy key
 * (into a password manager, as good as a file) and Download backup file.
 * Writing it down by hand is a third way and is offered as one.
 *
 * Only once the player has chosen a way to keep it does the confirmation
 * appear: "I saved my secret key somewhere safe." (a deliberate checkbox,
 * the acknowledgement the way in has always required), then "Continue to my
 * egg!". A download is never reported as done: the page can only ask the
 * browser to save the file, so it says that and asks the player to check.
 *
 * Unchanged underneath: the key comes from nostr-tools (`createNewAccount`),
 * lives in this screen's state until the player continues, and then goes
 * to the login store the ecosystem shares (`login.nsec`), exactly as
 * before. It is never put in a URL, an input's value, a log, an error report
 * or a relay message. The public identity (npub) is not shown here: the
 * menu's Account has it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Copy, Download, Egg, KeyRound, PenLine } from 'lucide-react';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import { useSound } from '@/features/sound';
import { useLoginActions } from '@/hooks/useLoginActions';
import { createNewAccount, downloadNsecBackup, nsecBackupFilename, type NewAccount } from './new-account';

/** How the player chose to keep the key; null until they chose. */
export type KeyKeeping = 'copy' | 'download' | 'written';

export const KEY_HEADLINE = 'A little key, just for you.';

export function CreateAccountScreen({ onBack }: { onBack: () => void }) {
  const login = useLoginActions();
  // The key comes from the browser's secure randomness (nostr-tools); a browser without it cannot make one, and says so
  const [made] = useState<{ account: NewAccount } | { error: string }>(() => {
    try {
      return { account: createNewAccount() };
    } catch {
      return { error: 'This browser cannot make a secure key here. Open Blobbi over https in an up-to-date browser, or sign in with an account you already have.' };
    }
  });
  if ('error' in made) {
    return (
      <KeyStage onBack={onBack}>
        <p role="alert" className="keyscene__error" data-testid="create-account-unsupported">
          {made.error}
        </p>
      </KeyStage>
    );
  }
  return <KeyGift account={made.account} onBack={onBack} signIn={login.nsec} />;
}

/** The darkened world, the light, the motes, the way back: the stage the key is given on. */
export function KeyStage({ onBack, headline = KEY_HEADLINE, intro, children }: { onBack: () => void; headline?: string; intro?: ReactNode; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <section className="keyscene" data-testid="onboarding-create-account" data-reduced={reduced ? 'true' : undefined} aria-labelledby="key-title">
      <span className="keyscene__veil" aria-hidden />
      <span className="keyscene__spot" aria-hidden />
      <span className="keyscene__mote keyscene__mote--a" aria-hidden />
      <span className="keyscene__mote keyscene__mote--b" aria-hidden />
      <span className="keyscene__mote keyscene__mote--c" aria-hidden />
      <span className="keyscene__mote keyscene__mote--d" aria-hidden />
      <div className="keyscene__scroll">
        <button type="button" onClick={onBack} className="keyscene__back" data-testid="onboarding-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        <div className="keyscene__body">
          <div className="keyscene__key" aria-hidden>
            <span className="keyscene__halo" />
            <KeyRound className="keyscene__icon" strokeWidth={1.8} />
          </div>
          <h2 id="key-title" className="keyscene__title">
            {headline}
          </h2>
          {intro}
          {children}
        </div>
      </div>
    </section>
  );
}

export interface KeyGiftProps {
  account: NewAccount;
  onBack: () => void;
  /** Signs in with the key once the backup is acknowledged. The one place the key leaves this screen. */
  signIn: (nsec: string) => void;
  /** The way in: "Continue to my egg!". Saving a guest Blobbi (M14) says where it goes instead. */
  continueLabel?: string;
  headline?: string;
  /** A line before the facts: for a guest, why there is a key at all. */
  intro?: ReactNode;
  /** Under the Continue button; the default says where the key can be seen again. */
  aside?: string;
}

/**
 * The key, given: the facts, the key, the ways to keep it, the acknowledgement,
 * then sign-in. Shared by the way in (a fresh key) and by saving a guest
 * Blobbi (the key reserved when its egg was made): the words differ, the
 * facts, the backup and the acknowledgement never do.
 */
export function KeyGift({ account, onBack, signIn, continueLabel = 'Continue to my egg!', headline, intro, aside = 'You can see your key again later in the menu, under Account.' }: KeyGiftProps) {
  const { play } = useSound();
  const [kept, setKept] = useState<KeyKeeping | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One sign-in, however fast the button is pressed twice
  const continued = useRef(false);
  // On a short screen the confirmation may land below the fold: brought into view as it appears
  const confirmRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const shown = kept !== null;
  useEffect(() => {
    if (shown) confirmRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [shown, reduced]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account.nsec);
      setKept('copy');
      setCopied(true);
      setNote('Copied. Paste it into your password manager now, then copy something else: the clipboard is no place to leave it.');
      play('chirp');
    } catch {
      setNote('Copying is not available here. Select the key above and copy it, or download the file.');
    }
  };
  const download = () => {
    if (downloadNsecBackup(account.nsec)) {
      setKept('download');
      // The page can only ask: whether the file was saved is the browser's (and the player's) to say
      setNote(`Your browser was asked to save ${nsecBackupFilename(account.nsec)}. Check that it is in your downloads before you go on.`);
      play('chirp');
    } else setNote('Downloads are not available here. Copy the key instead.');
  };
  const written = () => {
    setKept('written');
    setNote('Write every character exactly, and keep the paper somewhere safe and private.');
  };
  const finish = () => {
    if (!kept || !confirmed || continued.current) return;
    continued.current = true;
    try {
      signIn(account.nsec);
    } catch (err) {
      continued.current = false;
      setError(err instanceof Error ? err.message : 'Could not sign in with the new key.');
    }
  };

  return (
    <KeyStage onBack={onBack} headline={headline} intro={intro}>
      <ul className="keyscene__facts" role="note" aria-label="About your secret key" data-testid="key-warning">
        <li>
          This is your <strong>secret key</strong>: your account, instead of a password.
        </li>
        <li>Anyone who gets it can open your account. Never share it.</li>
        <li>If you lose it, you can lose your Blobbi for good.</li>
        <li>Blobbi cannot recover it for you.</li>
      </ul>
      <code className="keyscene__nsec" data-testid="nsec-box" aria-label="Your secret key">
        {account.nsec}
      </code>
      <div className="keyscene__ways">
        <button type="button" className="onboard-btn onboard-btn--secondary keyscene__way" onClick={copy} data-testid="nsec-copy" data-done={kept === 'copy' ? 'true' : undefined}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy key'}
        </button>
        <button type="button" className="onboard-btn onboard-btn--secondary keyscene__way" onClick={download} data-testid="nsec-download" data-done={kept === 'download' ? 'true' : undefined}>
          <Download className="h-4 w-4" aria-hidden />
          Download backup file
        </button>
      </div>
      {kept === null && (
        <button type="button" className="keyscene__quiet" onClick={written} data-testid="nsec-written">
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          I’ll write it down instead
        </button>
      )}
      <p className="keyscene__note" role="status" data-testid="nsec-note">
        {note ?? ''}
      </p>
      {kept !== null && (
        <div className="keyscene__confirm" data-testid="key-confirm" ref={confirmRef}>
          <label className="keyscene__check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="key-saved" />
            <span>I saved my secret key somewhere safe.</span>
          </label>
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={finish} disabled={!confirmed} data-testid="onboarding-continue">
            <Egg className="h-4 w-4" aria-hidden />
            {continueLabel}
          </button>
          <p className="keyscene__aside">{aside}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="keyscene__error">
          {error}
        </p>
      )}
    </KeyStage>
  );
}
