import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toDataURL } from 'qrcode';
import { AlertTriangle, ArrowLeft, Copy, Egg, FileUp, Heart, Home, ImagePlus, KeyRound, Loader2, ShieldCheck, Smartphone, Sparkles, UserRound } from 'lucide-react';
import type { NostrConnectParams, NostrConnectStatus } from '@nostrify/react/login';
import type { NostrMetadata } from '@nostrify/nostrify';
import { EnterIslandButton } from '@/features/home/EnterIslandButton';
import { useLoginActions } from '@/hooks/useLoginActions';
import { KeyBackup } from './KeyBackup';
import { createNewAccount, isNsec, readNsecFromText, type NewAccount } from './new-account';
import { checkRelayTransport } from '@/lib/relay-transport';
import { signInMessage, withTimeout } from './sign-in';
import { PROFILE_ABOUT_MAX, PROFILE_NAME_MAX, checkProfileForm, profileFormFrom, type ProfileFormInput } from './profile-plan';

function Card({ children, testId, busy }: { children: React.ReactNode; testId: string; busy?: boolean }) {
  return (
    <section className="welcome-card" data-testid={testId} aria-busy={busy}>
      {children}
    </section>
  );
}

function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="onboarding-back">
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

/* ─── Welcome ─────────────────────────────────────────────────────────── */

/**
 * The first screen: what a Blobbi is, in one breath, and two doors. A new
 * visitor's door says what they will do (adopt), not what an account is; the
 * key is explained on the next screen, when it exists. A returning player's
 * door is right under it. Nostr is named only on request. A page that cannot
 * reach the network (plain HTTP on a LAN address, no Web Crypto) says so
 * here, before anyone makes a key it could not use.
 */
export function WelcomeScreen({ onCreate, onExisting }: { onCreate: () => void; onExisting: () => void }) {
  const [blocked] = useState(() => checkRelayTransport());
  return (
    <section className="welcome-card" data-testid="onboarding-welcome">
      <img src="/blobbilogo.svg" alt="Blobbi" className="welcome-card__logo" width={148} height={48} />
      <h1 className="welcome-card__title">A little creature, waiting to hatch</h1>
      <p className="welcome-card__lead">Adopt an egg. Watch it hatch. Feed it, play with it and make its home cozy as it grows.</p>
      <ul className="welcome-card__points" aria-label="What you can do">
        <li><Egg aria-hidden /> One of a kind</li>
        <li><Heart aria-hidden /> Eats, plays and naps</li>
        <li><Home aria-hidden /> Rooms to decorate</li>
      </ul>
      {blocked && (
        <p role="alert" className="welcome-card__warning" data-testid="welcome-blocked">
          <AlertTriangle aria-hidden /> {blocked.message}
        </p>
      )}
      <div className="welcome-card__actions">
        <button type="button" className="onboard-btn onboard-btn--primary welcome-card__primary" onClick={onCreate} data-testid="onboarding-create">
          <Sparkles className="h-4 w-4" aria-hidden />
          Adopt my Blobbi
        </button>
        <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onExisting} data-testid="onboarding-existing">
          <KeyRound className="h-4 w-4" aria-hidden />
          I have an account
        </button>
      </div>
      <p className="welcome-card__fine">Free, no email. Your Blobbi belongs to your own key.</p>
      <details className="welcome-card__more" data-testid="welcome-what-is-nostr">
        <summary>How does it work?</summary>
        <p>
          Blobbi runs on Nostr, an open network where your account is a key you hold, not a password on our server. The same key and the same Blobbi work in
          Blobbi Island and Ditto. If you already use Nostr, sign in with it.
        </p>
        <div className="mt-2 flex justify-center">
          <EnterIslandButton variant="secondary" />
        </div>
      </details>
    </section>
  );
}

/* ─── Create an account ────────────────────────────────────────────────── */

/**
 * A new key, shown once. The player must confirm a backup before the key
 * signs them in; the confirmation is a deliberate checkbox, and the copy
 * and download buttons are right there. The words do not soften it: the
 * key is the account, and losing it can mean losing the account.
 */
export function CreateAccountScreen({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
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
      <Card testId="onboarding-create-account">
        <BackButton onClick={onBack} />
        <p role="alert" className="text-sm text-destructive" data-testid="create-account-unsupported">
          {made.error}
        </p>
      </Card>
    );
  }
  return <CreateAccountKey account={made.account} onBack={onBack} onCreated={onCreated} login={login} />;
}

function CreateAccountKey({ account, onBack, onCreated, login }: { account: NewAccount; onBack: () => void; onCreated: () => void; login: ReturnType<typeof useLoginActions> }) {
  const [backedUp, setBackedUp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    if (!confirmed) return;
    try {
      login.nsec(account.nsec);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in with the new key.');
    }
  };

  return (
    <Card testId="onboarding-create-account">
      <BackButton onClick={onBack} />
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">First, your key</h2>
        <p className="text-sm text-muted-foreground">
          Your Blobbi needs a home that belongs to you. Instead of a password, you get a <strong>secret key</strong>: it was just made on this device, and nobody else has it, not even us.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-400/60 bg-amber-50/80 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" role="note" data-testid="key-warning">
        <p className="font-semibold">Keep it like a house key.</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
          <li>It is the only way back in on a new phone or after clearing this browser. There is no reset and no recovery email.</li>
          <li>Whoever has it can use your account. Never share it, and never paste it into a site you do not trust.</li>
          <li>Save it now: a password manager, or the backup file below.</li>
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Your public id (fine to share): <code className="break-all" data-testid="new-npub">{account.npub}</code>
      </p>
      <KeyBackup nsec={account.nsec} revealed onBackedUp={() => setBackedUp(true)} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4" data-testid="key-saved" />
        <span>I saved my secret key somewhere safe. I understand it cannot be recovered without it.</span>
      </label>
      {!backedUp && confirmed && (
        <p className="text-xs text-muted-foreground" data-testid="key-saved-hint">
          You have not copied or downloaded it here. If you wrote it down, go on.
        </p>
      )}
      <button type="button" className="onboard-btn onboard-btn--primary" onClick={finish} disabled={!confirmed} data-testid="onboarding-continue">
        <Egg className="h-4 w-4" aria-hidden />
        Continue to my egg
      </button>
      <p className="text-xs text-muted-foreground">
        On this device the key is kept by the sign-in store, the same one Blobbi Island and Ditto use. You can see it again from the menu, under Account.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}

/** How long a signer (an extension, a bunker) may take to answer before the screen says so and lets the player try again. */
const SIGNER_TIMEOUT_MS = 60_000;

/* ─── Existing account ─────────────────────────────────────────────────── */

function hasExtension(): boolean {
  return typeof window !== 'undefined' && 'nostr' in window;
}

/** The text of a small file (the backup); never more than a few KB is read. */
function readFileText(file: File): Promise<string> {
  if (file.size > 4_096) return Promise.reject(new Error('That is not a key backup file.'));
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

/**
 * The returning player. An extension and a bunker come first because they
 * keep the key out of this app; a secret key (pasted or the backup file)
 * is there for accounts made here or elsewhere without a signer.
 */
export function ExistingAccountScreen({ onBack }: { onBack?: () => void }) {
  const login = useLoginActions();
  const [bunkerUri, setBunkerUri] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<'extension' | 'bunker' | 'nsec' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const extensionAvailable = hasExtension();
  const bunkerValid = bunkerUri.trim().startsWith('bunker://');
  const nsecValid = isNsec(nsecInput.trim());

  const run = async (kind: 'extension' | 'bunker' | 'nsec', action: () => Promise<void> | void) => {
    setError(null);
    setBusy(kind);
    try {
      await action();
    } catch (err) {
      setError(signInMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const withBunker = (event: FormEvent) => {
    event.preventDefault();
    if (!bunkerValid) return;
    void run('bunker', async () => {
      await withTimeout(login.bunker(bunkerUri.trim()), SIGNER_TIMEOUT_MS, 'The signer did not answer. Check it is online and approve Blobbi there, then try again.');
      setBunkerUri('');
    });
  };
  const withNsec = (event: FormEvent) => {
    event.preventDefault();
    if (!nsecValid) return;
    void run('nsec', () => {
      login.nsec(nsecInput.trim());
      setNsecInput('');
    });
  };
  const fromFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await readFileText(file);
    const found = readNsecFromText(text);
    if (!found) {
      setError('That file does not hold one secret key.');
      return;
    }
    // The key goes straight into the session; the file is not kept anywhere.
    setError(null);
    setNsecInput(found);
    setShowKey(true);
  };

  return (
    <Card testId="onboarding-existing-account" busy={busy !== null}>
      {onBack && <BackButton onClick={onBack} />}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold" id="login-heading">
          Welcome back
        </h2>
        <p className="text-sm text-muted-foreground">Sign in with the Nostr account your Blobbi lives under. A signer keeps your key with it, which is safest.</p>
      </div>

      <button type="button" onClick={() => void run('extension', () => withTimeout(login.extension(), SIGNER_TIMEOUT_MS, 'The extension did not answer. Open it, approve Blobbi, then try again.'))} disabled={!extensionAvailable || busy !== null} className="onboard-btn onboard-btn--primary" data-testid="login-extension">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {busy === 'extension' ? 'Signing in…' : 'Sign in with extension'}
      </button>
      {!extensionAvailable && <p className="text-center text-xs text-muted-foreground">No NIP-07 extension detected in this browser.</p>}

      <SignerAppConnect disabled={busy !== null} />

      <form onSubmit={withBunker} className="space-y-2">
        <label htmlFor="bunker-uri" className="block text-sm font-medium">
          Or paste a bunker address
        </label>
        <input id="bunker-uri" value={bunkerUri} onChange={(e) => setBunkerUri(e.target.value)} placeholder="bunker://…" autoComplete="off" spellCheck={false} className="onboard-input" />
        {bunkerUri && !bunkerValid && <p className="text-xs text-destructive">URI must start with bunker://</p>}
        <button type="submit" disabled={!bunkerValid || busy !== null} className="onboard-btn onboard-btn--secondary" data-testid="login-bunker">
          <KeyRound className="h-4 w-4" aria-hidden />
          {busy === 'bunker' ? 'Connecting…' : 'Connect bunker'}
        </button>
      </form>

      <details className="rounded-2xl border border-border bg-background/60 p-3" data-testid="login-key-section" open={showKey} onToggle={(e) => setShowKey((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm font-medium">Sign in with a secret key</summary>
        <form onSubmit={withNsec} className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">For an account made here, or a backup file. The key is kept on this device by the sign-in store; prefer a signer when you have one.</p>
          <label htmlFor="nsec-input" className="sr-only">
            Secret key (nsec)
          </label>
          <input id="nsec-input" type="password" value={nsecInput} onChange={(e) => setNsecInput(e.target.value)} placeholder="nsec1…" autoComplete="off" spellCheck={false} className="onboard-input" data-testid="login-nsec-input" />
          {nsecInput && !nsecValid && <p className="text-xs text-destructive">That is not a valid nsec.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="onboard-btn onboard-btn--secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null} data-testid="login-nsec-file">
              <FileUp className="h-4 w-4" aria-hidden />
              Backup file
            </button>
            <button type="submit" disabled={!nsecValid || busy !== null} className="onboard-btn onboard-btn--primary" data-testid="login-nsec">
              <KeyRound className="h-4 w-4" aria-hidden />
              Sign in
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => void fromFile(e.target.files?.[0])} data-testid="login-nsec-file-input" />
        </form>
      </details>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive" data-testid="login-error">
          {error}
        </p>
      )}
    </Card>
  );
}

/* ─── A signer app, by QR or deep link (NIP-46, nostrconnect://) ───────── */

const STATUS_WORD: Record<NostrConnectStatus, string> = { 'awaiting-connect': 'Waiting for your signer app…', 'getting-public-key': 'Signer found. Confirming…' };

function isTouchDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * The mobile-friendly signer path: one tap makes a nostrconnect session
 * (an ephemeral client key and a secret, in memory only), shows it as a
 * QR to scan from another device and as a link to open a signer app on
 * this one, and waits for the signer's answer on the application relays.
 * Leaving the screen, cancelling or a refresh ends the session: nothing
 * of it is stored. The user's key never comes near this app.
 */
function SignerAppConnect({ disabled }: { disabled: boolean }) {
  const login = useLoginActions();
  const [session, setSession] = useState<{ params: NostrConnectParams; uri: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<NostrConnectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mobile = isTouchDevice();

  const stop = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setSession(null);
    setQr(null);
    setStatus(null);
  };
  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = () => {
    setError(null);
    setCopied(false);
    const next = login.nostrconnect.start();
    setSession(next);
    setStatus('awaiting-connect');
    void toDataURL(next.uri, { margin: 1, width: 224, errorCorrectionLevel: 'M' })
      .then((url) => setQr(url))
      .catch(() => setQr(null));
    const controller = new AbortController();
    controllerRef.current = controller;
    login.nostrconnect
      .wait(next.params, controller.signal, (s) => {
        if (!controller.signal.aborted) setStatus(s);
      })
      .then(() => {
        if (!controller.signal.aborted) stop();
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'The signer did not answer.');
        stop();
      });
  };
  const copy = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.uri);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!session) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={start} disabled={disabled} className="onboard-btn onboard-btn--secondary" data-testid="login-signer-app">
          <Smartphone className="h-4 w-4" aria-hidden />
          Connect a signer app
        </button>
        <p className="text-center text-xs text-muted-foreground">Amber, nsec.app and other NIP-46 signers. Your key stays in the app.</p>
        {error && (
          <p role="alert" className="text-center text-sm text-destructive" data-testid="signer-app-error">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="signer-connect" data-testid="signer-app-session" aria-live="polite">
      {!mobile && (
        <div className="signer-connect__qr" aria-label="Scan with your signer app">
          {qr ? <img src={qr} alt="QR code for your signer app" width={224} height={224} data-testid="signer-app-qr" /> : <span className="text-xs text-muted-foreground">Making the code…</span>}
        </div>
      )}
      <p className="text-center text-sm font-semibold" data-testid="signer-app-status">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />
        {status ? STATUS_WORD[status] : ''}
      </p>
      <p className="text-center text-xs text-muted-foreground">{mobile ? 'Open your signer app with the button, approve Blobbi there, then come back.' : 'Scan the code with your signer app, or open it on this device.'}</p>
      <div className="grid grid-cols-2 gap-2">
        <a href={session.uri} className="onboard-btn onboard-btn--primary" data-testid="signer-app-open">
          <Smartphone className="h-4 w-4" aria-hidden />
          Open signer app
        </a>
        <button type="button" className="onboard-btn onboard-btn--secondary" onClick={copy} data-testid="signer-app-copy">
          <Copy className="h-4 w-4" aria-hidden />
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <button type="button" className="inline-flex w-full justify-center text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={stop} data-testid="signer-app-cancel">
        Cancel
      </button>
    </div>
  );
}

/* ─── Profile ─────────────────────────────────────────────────────────── */

interface ProfileSetupScreenProps {
  existing: NostrMetadata | undefined;
  /** Publishes the kind 0; resolves when a relay accepted it. */
  onSave: (form: ProfileFormInput) => Promise<unknown>;
  onSkip: () => void;
  onUpload?: (file: File) => Promise<string>;
  pending: boolean;
  error: Error | null;
}

/** Name, picture and a line about you, on the standard kind 0. Skippable. */
export function ProfileSetupScreen({ existing, onSave, onSkip, onUpload, pending, error }: ProfileSetupScreenProps) {
  const [form, setForm] = useState<ProfileFormInput>(() => profileFormFrom(existing));
  const [reason, setReason] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const check = checkProfileForm(form);
    if (!check.ok) {
      setReason(check.reason);
      return;
    }
    setReason(null);
    void onSave(check.value);
  };
  const upload = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await onUpload(file);
      setForm((f) => ({ ...f, picture: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card testId="onboarding-profile" busy={pending}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">How should your Blobbi know you?</h2>
        <p className="text-sm text-muted-foreground">Your Nostr profile: shared with every app you sign into with this key. Everything here is optional.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background" aria-hidden>
            {form.picture ? <img src={form.picture} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7 text-muted-foreground" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor="profile-picture" className="block text-sm font-medium">
              Picture
            </label>
            <input id="profile-picture" value={form.picture} onChange={(e) => setForm((f) => ({ ...f, picture: e.target.value }))} placeholder="https://…" autoComplete="off" spellCheck={false} className="onboard-input" data-testid="profile-picture" />
            {onUpload && (
              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => fileRef.current?.click()} disabled={uploading || pending} data-testid="profile-upload">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
                {uploading ? 'Uploading…' : 'Upload an image'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} data-testid="profile-upload-input" />
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>
        </div>
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium">
            Name
          </label>
          <input id="profile-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={PROFILE_NAME_MAX + 8} autoComplete="nickname" spellCheck={false} className="onboard-input mt-1" data-testid="profile-name" />
        </div>
        <div>
          <label htmlFor="profile-about" className="block text-sm font-medium">
            About you
          </label>
          <textarea id="profile-about" value={form.about} onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))} maxLength={PROFILE_ABOUT_MAX + 20} rows={2} className="onboard-input mt-1 resize-none" data-testid="profile-about" />
        </div>
        {reason && (
          <p className="text-xs text-destructive" data-testid="profile-reason">
            {reason}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive" data-testid="profile-error">
            {error.message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onSkip} disabled={pending} data-testid="profile-skip">
            Skip for now
          </button>
          <button type="submit" className="onboard-btn onboard-btn--primary" disabled={pending || uploading} data-testid="profile-save">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Egg className="h-4 w-4" aria-hidden />}
            {pending ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </form>
    </Card>
  );
}
