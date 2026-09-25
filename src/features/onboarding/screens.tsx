import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Egg, FileUp, ImagePlus, KeyRound, Loader2, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import type { NostrMetadata } from '@nostrify/nostrify';
import { WhatIsBlobbi } from '@/features/adoption';
import { EnterIslandButton } from '@/features/home/EnterIslandButton';
import { useLoginActions } from '@/hooks/useLoginActions';
import { KeyBackup } from './KeyBackup';
import { createNewAccount, isNsec, readNsecFromText, type NewAccount } from './new-account';
import { PROFILE_ABOUT_MAX, PROFILE_NAME_MAX, checkProfileForm, profileFormFrom, type ProfileFormInput } from './profile-plan';

function Card({ children, testId, busy }: { children: React.ReactNode; testId: string; busy?: boolean }) {
  return (
    <section className="home-glass mx-auto w-full max-w-md space-y-4 rounded-3xl p-6" data-testid={testId} aria-busy={busy}>
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

export function WelcomeScreen({ onCreate, onExisting }: { onCreate: () => void; onExisting: () => void }) {
  return (
    <Card testId="onboarding-welcome">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">The home of your Blobbi</h1>
        <p className="text-sm text-muted-foreground">A small companion that lives on Nostr, under your own key.</p>
      </div>
      <WhatIsBlobbi />
      <div className="space-y-2">
        <button type="button" className="onboard-btn onboard-btn--primary" onClick={onCreate} data-testid="onboarding-create">
          <Sparkles className="h-4 w-4" aria-hidden />
          Create an account
        </button>
        <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onExisting} data-testid="onboarding-existing">
          <KeyRound className="h-4 w-4" aria-hidden />
          I already have a Nostr account
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">One Nostr account is one identity across Blobbi, Blobbi Island and Ditto.</p>
      <div className="flex justify-center">
        <EnterIslandButton variant="secondary" />
      </div>
    </Card>
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
  const [account] = useState<NewAccount>(() => createNewAccount());
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
        <h2 className="text-xl font-semibold">Your new account</h2>
        <p className="text-sm text-muted-foreground">
          This is a Nostr account: a key pair made on this device. Your public id is <code className="break-all text-xs" data-testid="new-npub">{account.npub}</code>.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-400/60 bg-amber-50/80 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" role="note" data-testid="key-warning">
        <p className="font-semibold">The secret key below is your account.</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
          <li>Whoever has it controls the account. Never share it or paste it into a website you do not trust.</li>
          <li>There is no password reset. If you lose it, you may lose access to this account and your Blobbi for good.</li>
          <li>Save it now: copy it into a password manager, or download the backup file.</li>
        </ul>
      </div>
      <KeyBackup nsec={account.nsec} revealed onBackedUp={() => setBackedUp(true)} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4" data-testid="key-saved" />
        <span>I have saved my secret key somewhere safe.</span>
      </label>
      {!backedUp && confirmed && (
        <p className="text-xs text-muted-foreground" data-testid="key-saved-hint">
          You have not copied or downloaded it here. If you wrote it down, go on.
        </p>
      )}
      <button type="button" className="onboard-btn onboard-btn--primary" onClick={finish} disabled={!confirmed} data-testid="onboarding-continue">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Continue
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
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(null);
    }
  };

  const withBunker = (event: FormEvent) => {
    event.preventDefault();
    if (!bunkerValid) return;
    void run('bunker', async () => {
      await login.bunker(bunkerUri.trim());
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
          Sign in to see your Blobbi
        </h2>
        <p className="text-sm text-muted-foreground">Use a Nostr signer if you have one: your key stays with it.</p>
      </div>

      <button type="button" onClick={() => void run('extension', () => login.extension())} disabled={!extensionAvailable || busy !== null} className="onboard-btn onboard-btn--primary" data-testid="login-extension">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {busy === 'extension' ? 'Signing in…' : 'Sign in with extension'}
      </button>
      {!extensionAvailable && <p className="text-center text-xs text-muted-foreground">No NIP-07 extension detected in this browser.</p>}

      <form onSubmit={withBunker} className="space-y-2">
        <label htmlFor="bunker-uri" className="block text-sm font-medium">
          Or connect a remote signer
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
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </Card>
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
