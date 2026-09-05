import { useState, type FormEvent } from 'react';
import { KeyRound, Shield } from 'lucide-react';
import { useLoginActions } from '@/hooks/useLoginActions';

function hasExtension(): boolean {
  return typeof window !== 'undefined' && 'nostr' in window;
}

/**
 * Sign-in surface. Adapted from the pre-nuke login dialog, reduced to the two
 * signers that keep the identity key out of this origin: a NIP-07 extension
 * and a NIP-46 bunker. There is no nsec field on purpose (see useLoginActions).
 */
export function LoginPanel() {
  const login = useLoginActions();
  const [bunkerUri, setBunkerUri] = useState('');
  const [busy, setBusy] = useState<'extension' | 'bunker' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extensionAvailable = hasExtension();
  const bunkerValid = bunkerUri.trim().startsWith('bunker://');

  const withExtension = async () => {
    setError(null);
    setBusy('extension');
    try {
      await login.extension();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extension sign-in failed.');
    } finally {
      setBusy(null);
    }
  };

  const withBunker = async (event: FormEvent) => {
    event.preventDefault();
    if (!bunkerValid) return;
    setError(null);
    setBusy('bunker');
    try {
      await login.bunker(bunkerUri.trim());
      setBunkerUri('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bunker connection failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="login-heading"
      className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-border bg-card/80 p-6 shadow-lg backdrop-blur"
    >
      <div className="space-y-1 text-center">
        <h2 id="login-heading" className="text-lg font-semibold">
          Sign in to see your Blobbi
        </h2>
        <p className="text-sm text-muted-foreground">Use a Nostr signer. Your key never enters this app.</p>
      </div>

      <button
        type="button"
        onClick={withExtension}
        disabled={!extensionAvailable || busy !== null}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-sm font-medium text-white shadow transition hover:from-purple-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Shield className="h-4 w-4" />
        {busy === 'extension' ? 'Signing in…' : 'Sign in with extension'}
      </button>
      {!extensionAvailable && (
        <p className="text-center text-xs text-muted-foreground">No NIP-07 extension detected in this browser.</p>
      )}

      <form onSubmit={withBunker} className="space-y-2">
        <label htmlFor="bunker-uri" className="block text-sm font-medium">
          Or connect a remote signer
        </label>
        <input
          id="bunker-uri"
          value={bunkerUri}
          onChange={(e) => setBunkerUri(e.target.value)}
          placeholder="bunker://…"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {bunkerUri && !bunkerValid && <p className="text-xs text-destructive">URI must start with bunker://</p>}
        <button
          type="submit"
          disabled={!bunkerValid || busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          {busy === 'bunker' ? 'Connecting…' : 'Connect bunker'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
