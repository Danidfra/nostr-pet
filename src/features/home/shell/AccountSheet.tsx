/**
 * The account, as one screen of its own (M14.1): who you are on Nostr (the
 * picture, the name, the npub, how you are signed in), the profile editor
 * (the standard kind 0, the same `ProfileForm` as everywhere; nothing is
 * published until Save), the secret-key backup for a key kept on this
 * device, Sign out, and the way to Ditto. Opened from the menu's Account
 * tile, so it is one tap from anywhere and never buried in settings. A
 * guest has no account: the menu offers Save my Blobbi instead.
 */
import { LogOut } from 'lucide-react';
import { GameOverlay } from './GameOverlay';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { shortNpub } from '@/lib/format';
import { DITTO_BLOBBI_URL } from '@/config/ecosystem';
import { KeyBackup } from '@/features/onboarding/KeyBackup';
import { ProfileForm } from '@/features/onboarding/screens';
import { useProfileSetup } from '@/features/onboarding/useProfileSetup';
import { travelMode } from '@/features/presence/travel-mode';
import { setActivePresence, useActivePresenceChoice, usePresenceStatus } from '@/features/presence/active-presence-choice';

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
}

const SIGNED_IN_LINE: Record<string, string> = {
  extension: 'Signed in with a browser extension. Your key stays with it.',
  bunker: 'Signed in with a remote signer. Your key stays with it.',
  nsec: 'Signed in with a secret key kept on this device.',
};

export function AccountSheet({ open, onClose }: AccountSheetProps) {
  const { user, metadata } = useCurrentUser();
  const { logout, sessionNsec, loginType } = useLoginActions();
  if (!user) return null;
  const name = metadata?.display_name || metadata?.name || shortNpub(user.pubkey);
  return (
    <GameOverlay
      open={open}
      onClose={onClose}
      title="Account"
      testId="account-sheet"
      size="tall"
      lead={metadata?.picture ? <img src={metadata.picture} alt="" className="overlay-portrait object-cover" /> : <span aria-hidden className="overlay-portrait bg-gradient-to-br from-purple-400 to-pink-400" />}
      subtitle={
        <span className="block min-w-0">
          <span className="block truncate text-sm font-bold text-foreground" data-testid="account-name">
            {name}
          </span>
          <span className="block truncate text-xs text-muted-foreground" data-testid="account-npub">
            {shortNpub(user.pubkey)}
          </span>
        </span>
      }
    >
      <div className="menu" data-testid="account">
        <p className="text-xs text-muted-foreground" data-testid="login-type">
          {(loginType && SIGNED_IN_LINE[loginType]) ?? ''}
        </p>
        <section className="menu-section" aria-labelledby="account-profile" data-testid="profile-section">
          <h3 id="account-profile" className="menu-section__title">
            Your profile
          </h3>
          <MenuProfile pubkey={user.pubkey} metadata={metadata} />
        </section>
        {sessionNsec && (
          <section className="menu-section" aria-labelledby="account-key" data-testid="key-backup-section">
            <h3 id="account-key" className="menu-section__title">
              Back up your secret key
            </h3>
            <p className="text-xs text-muted-foreground">This key is the account. Anyone with it controls it; without it there is no way back in. Keep a copy where only you can reach it.</p>
            <KeyBackup nsec={sessionNsec} />
          </section>
        )}
        {travelMode() === 'nostr' && loginType && loginType !== 'guest' && <ActivePresenceToggle pubkey={user.pubkey} prompts={loginType !== 'nsec'} />}
        <section className="menu-section" aria-labelledby="account-session">
          <h3 id="account-session" className="menu-section__title">
            Session
          </h3>
          <button type="button" onClick={logout} className="onboard-btn onboard-btn--secondary" data-testid="sign-out">
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
          <a href={DITTO_BLOBBI_URL} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-muted-foreground underline-offset-2 hover:underline">
            Adopt or manage Blobbis on Ditto
          </a>
        </section>
      </div>
    </GameOverlay>
  );
}

const PRESENCE_STATUS_LINE: Record<string, string> = {
  'paused-prompting': 'Paused: your signer asks each time, so Blobbi stopped asking. Allow these notes in your signer, then turn this on again.',
  declined: 'Paused: your signer said no. Turn this on again to try once more.',
  unavailable: 'Not available with this sign-in.',
};

/**
 * Active Presence (M16): off unless the player turns it on. With it on, while they play here the home signs a short
 * note at most once a minute that lasts two minutes (kind 21124; relays pass it on and do not keep it), so their other
 * Blobbi worlds can tell the Blobbi is being played. It never moves the Blobbi, and it never asks a signer over and
 * over: one that asks each time pauses it for the session.
 */
function ActivePresenceToggle({ pubkey, prompts }: { pubkey: string; prompts: boolean }) {
  const on = useActivePresenceChoice(pubkey);
  const status = usePresenceStatus(pubkey);
  return (
    <section className="menu-section" aria-labelledby="account-presence" data-testid="active-presence-section" data-world-travel="ignore">
      <h3 id="account-presence" className="menu-section__title">
        Other Blobbi worlds
      </h3>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => setActivePresence(pubkey, e.target.checked)} data-testid="active-presence-toggle" className="mt-1" />
        <span>Let my other Blobbi worlds know when I'm playing here</span>
      </label>
      <p className="text-xs text-muted-foreground">
        While you play, Blobbi signs a short note that lasts two minutes, at most once a minute. It never moves your Blobbi.
        {prompts ? ' If your signer asks you each time, Blobbi stops asking until you turn this on again.' : ''}
      </p>
      {on && status && PRESENCE_STATUS_LINE[status] && (
        <p className="text-xs text-muted-foreground" data-testid="active-presence-status" data-status={status}>
          {PRESENCE_STATUS_LINE[status]}
        </p>
      )}
    </section>
  );
}

/** The player's kind 0 (name, picture, a line), set whenever they like. Nothing is written until Save. */
function MenuProfile({ pubkey, metadata }: { pubkey: string; metadata: ReturnType<typeof useCurrentUser>['metadata'] }) {
  const { publish, upload } = useProfileSetup(pubkey);
  const { mutateAsync } = publish;
  return (
    <ProfileForm
      // A form opened before the profile arrived starts again once it has, so nothing set elsewhere is overwritten blank
      key={metadata ? 'loaded' : 'empty'}
      existing={metadata}
      onSave={(form) => mutateAsync(form).catch(() => undefined)}
      onUpload={upload.mutateAsync}
      pending={publish.isPending}
      error={publish.error}
      saved={publish.isSuccess}
    />
  );
}
