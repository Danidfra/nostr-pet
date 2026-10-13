import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toDataURL } from 'qrcode';
import { AlertTriangle, ArrowLeft, Copy, Egg, FileUp, Heart, Home, ImagePlus, KeyRound, Loader2, ShieldCheck, Smartphone, Sparkles, UserRound } from 'lucide-react';
import type { NostrConnectParams, NostrConnectStatus } from '@nostrify/react/login';
import type { NostrMetadata } from '@nostrify/nostrify';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { EnterIslandButton } from '@/features/home/EnterIslandButton';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { useSound } from '@/features/sound';
import { StagePanel } from './WelcomeStage';
import { WelcomeHero } from './WelcomeHero';
import { INVITATION } from './welcome-hero';
import { welcomeCast } from './welcome-cast';
import { useLoginActions } from '@/hooks/useLoginActions';
import { isNsec, readNsecFromText } from './new-account';
import { checkRelayTransport } from '@/lib/relay-transport';
import { signInMessage, withTimeout } from './sign-in';
import { PROFILE_ABOUT_MAX, PROFILE_NAME_MAX, checkProfileForm, profileFormFrom, type ProfileFormInput } from './profile-plan';

/** What the little guide says beside each step: friendly, never instead of the step's own plain words. */
const GUIDE_LINES: Record<string, string> = {
  'onboarding-existing-account': 'Welcome back! I missed you.',
};

/** A step of the way in: the card, in the welcome's world, with the Blobbi guide beside it. */
function Card({ children, testId, busy }: { children: React.ReactNode; testId: string; busy?: boolean }) {
  return (
    <StagePanel line={GUIDE_LINES[testId] ?? 'Hello again!'}>
      <section className="welcome-card" data-testid={testId} aria-busy={busy}>
        {children}
      </section>
    </StagePanel>
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
 * The first screen (M12.2): not a page about Blobbi but a little scene with
 * one in it. A Blobbi notices you ("Oh! You're here!"), follows you with its
 * eyes and answers a tap; a grown-up friend and an egg wait beside it. Under
 * it, one line ("A little friend is waiting for you.") and two doors, there
 * from the first frame: Meet your Blobbi (a new key, then the egg) and
 * Welcome back! (an account you have). What Blobbi and Nostr are is one tap
 * away, in a sheet, for whoever asks. A page that cannot reach the network
 * (plain HTTP on a LAN address, no Web Crypto) says so here, before anyone
 * makes a key it could not use.
 *
 * Laid out from the viewport down: the band (the line and the doors) takes
 * what it needs and the scene takes the rest, the Blobbi sized from the
 * scene's own height, so a short phone shows a smaller Blobbi, never a page
 * to scroll.
 */
export function WelcomeScreen({ onCreate, onExisting }: { onCreate: () => void; onExisting: () => void }) {
  const [blocked] = useState(() => checkRelayTransport());
  const [aboutOpen, setAboutOpen] = useState(false);
  const [hero, egg, grownUp] = welcomeCast();
  return (
    <section className="wscene" data-testid="onboarding-welcome" aria-labelledby="welcome-title">
      {/* The scene: the Blobbi who welcomes you, with a friend and an egg that is waiting for someone */}
      <div className="wscene__stage" data-testid="welcome-cast">
        <img src="/blobbilogo.svg" alt="Blobbi" className="wscene__logo" width={148} height={48} />
        {grownUp && <SceneFriend blobbi={grownUp} where="left" />}
        {hero && <WelcomeHero blobbi={hero} />}
        {egg && <SceneFriend blobbi={egg} where="right" />}
      </div>
      {/* The invitation and the two doors, there from the first frame: nobody waits for an animation */}
      <div className="wscene__band">
        <h1 id="welcome-title" className="wscene__title">
          {INVITATION}
        </h1>
        {blocked && (
          <p role="alert" className="welcome-card__warning" data-testid="welcome-blocked">
            <AlertTriangle aria-hidden /> {blocked.message}
          </p>
        )}
        <div className="wscene__actions">
          <button type="button" className="onboard-btn onboard-btn--primary welcome-card__primary" onClick={onCreate} data-testid="onboarding-create">
            <Sparkles className="h-4 w-4" aria-hidden />
            Meet your Blobbi
          </button>
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onExisting} aria-describedby="welcome-back-hint" data-testid="onboarding-existing">
            <KeyRound className="h-4 w-4" aria-hidden />
            Welcome back!
          </button>
          <span id="welcome-back-hint" className="sr-only">
            I already have an account
          </span>
        </div>
        <button type="button" className="wscene__about" onClick={() => setAboutOpen(true)} data-testid="welcome-what-is-nostr">
          What is Blobbi?
        </button>
      </div>
      <GameOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} title="What is Blobbi?" testId="welcome-about">
        <ul className="welcome-card__points welcome-about__points" aria-label="What you can do">
          <li><Egg aria-hidden /> One of a kind, from the moment it is an egg</li>
          <li><Heart aria-hidden /> It notices you, eats, plays and naps</li>
          <li><Home aria-hidden /> A home with rooms to walk and decorate</li>
        </ul>
        <p className="welcome-about__text">Free, with no email. Your Blobbi belongs to your own key, a little like a house key that only you hold.</p>
        <p className="welcome-about__text">
          Blobbi runs on Nostr, an open network where your account is a key you hold, not a password on our server. The same key and the same Blobbi work in
          Blobbi Island and Ditto. If you already use Nostr, choose Welcome back! and sign in with it.
        </p>
        <div className="mt-3 flex justify-center">
          <EnterIslandButton variant="secondary" />
        </div>
      </GameOverlay>
    </section>
  );
}

/** A friend in the scene: hops when tapped (and coos, with sound on). Decoration with a small surprise, not a control. */
function SceneFriend({ blobbi, where }: { blobbi: ReturnType<typeof welcomeCast>[number]; where: 'left' | 'right' }) {
  const { play } = useSound();
  const [hop, setHop] = useState(0);
  return (
    <button
      type="button"
      className={where === 'left' ? 'wscene__friend wscene__friend--left' : 'wscene__friend wscene__friend--right'}
      data-stage={blobbi.stage}
      data-hop={hop > 0 ? hop % 2 : undefined}
      onClick={() => {
        setHop((h) => h + 1);
        play(blobbi.stage === 'egg' ? 'poke' : 'happy');
      }}
      aria-label={blobbi.stage === 'egg' ? 'An egg, waiting for someone' : `${blobbi.name}, a grown-up Blobbi`}
      tabIndex={-1}
    >
      <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`welcome-${blobbi.d}`} size="100%" eggCrack="none" transparent style={{ width: '100%', height: '100%' }} expression={blobbi.stage === 'egg' ? undefined : 'happy'} />
      <span className="wscene__friend-shadow" aria-hidden />
    </button>
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

interface ProfileFormProps {
  existing: NostrMetadata | undefined;
  /** Publishes the kind 0; resolves when a relay accepted it. */
  onSave: (form: ProfileFormInput) => Promise<unknown>;
  onUpload?: (file: File) => Promise<string>;
  pending: boolean;
  error: Error | null;
  /** Said under the button after a save landed. */
  saved?: boolean;
}

/**
 * Name, picture and a line about you, on the standard kind 0. Not a step of
 * the way in any more (M12.3): the menu's Account offers it, whenever the
 * player likes. Nothing is published until they press Save.
 */
export function ProfileForm({ existing, onSave, onUpload, pending, error, saved = false }: ProfileFormProps) {
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
    <form onSubmit={submit} className="space-y-3" data-testid="profile-form" aria-busy={pending}>
      <p className="text-xs text-muted-foreground">Your Nostr profile: shared with every app you sign into with this key. Everything here is optional.</p>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background" aria-hidden>
          {form.picture ? <img src={form.picture} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
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
      <button type="submit" className="onboard-btn onboard-btn--primary" disabled={pending || uploading} data-testid="profile-save">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserRound className="h-4 w-4" aria-hidden />}
        {pending ? 'Saving…' : 'Save my profile'}
      </button>
      {saved && !pending && !error && (
        <p role="status" className="text-center text-xs text-muted-foreground" data-testid="profile-saved">
          Saved.
        </p>
      )}
    </form>
  );
}
