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
import { useCopyChoice } from '@/hooks/useRelaySync';
import { t } from '@/i18n';

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
}

/** How the player is signed in, in a line; nothing for a way the sheet does not describe. */
function signedInLine(loginType: string | null | undefined): string {
  return loginType === 'extension' || loginType === 'bunker' || loginType === 'nsec' ? t(`home.account.signedIn.${loginType}`) : '';
}

export function AccountSheet({ open, onClose }: AccountSheetProps) {
  const { user, metadata } = useCurrentUser();
  const { logout, sessionNsec, loginType } = useLoginActions();
  if (!user) return null;
  const name = metadata?.display_name || metadata?.name || shortNpub(user.pubkey);
  return (
    <GameOverlay
      open={open}
      onClose={onClose}
      title={t('home.account.title')}
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
          {signedInLine(loginType)}
        </p>
        <section className="menu-section" aria-labelledby="account-profile" data-testid="profile-section">
          <h3 id="account-profile" className="menu-section__title">
            {t('home.account.profile')}
          </h3>
          <MenuProfile pubkey={user.pubkey} metadata={metadata} />
        </section>
        {sessionNsec && (
          <section className="menu-section" aria-labelledby="account-key" data-testid="key-backup-section">
            <h3 id="account-key" className="menu-section__title">
              {t('home.account.backup')}
            </h3>
            <p className="text-xs text-muted-foreground">{t('home.account.backupHint')}</p>
            <KeyBackup nsec={sessionNsec} />
          </section>
        )}
        {travelMode() === 'nostr' && loginType && loginType !== 'guest' && <ActivePresenceToggle pubkey={user.pubkey} prompts={loginType !== 'nsec'} />}
        {loginType && loginType !== 'guest' && <RelayCopyToggle pubkey={user.pubkey} />}
        <section className="menu-section" aria-labelledby="account-session">
          <h3 id="account-session" className="menu-section__title">
            {t('home.account.session')}
          </h3>
          <button type="button" onClick={logout} className="onboard-btn onboard-btn--secondary" data-testid="sign-out">
            <LogOut className="h-4 w-4" aria-hidden />
            {t('home.account.signOut')}
          </button>
          <a href={DITTO_BLOBBI_URL} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-muted-foreground underline-offset-2 hover:underline">
            {t('home.account.ditto')}
          </a>
        </section>
      </div>
    </GameOverlay>
  );
}

/** Why Active Presence is paused, in a line; null for a status that says nothing. */
function presenceStatusLine(status: string): string | null {
  switch (status) {
    case 'paused-prompting':
      return t('home.account.presence.status.pausedPrompting');
    case 'declined':
      return t('home.account.presence.status.declined');
    case 'unavailable':
      return t('home.account.presence.status.unavailable');
    default:
      return null;
  }
}

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
        {t('home.account.presence.title')}
      </h3>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => setActivePresence(pubkey, e.target.checked)} data-testid="active-presence-toggle" className="mt-1" />
        <span>{t('home.account.presence.toggle')}</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {t('home.account.presence.hint')}
        {prompts ? t('home.account.presence.hintPrompts') : ''}
      </p>
      {on && status && presenceStatusLine(status) && (
        <p className="text-xs text-muted-foreground" data-testid="active-presence-status" data-status={status}>
          {presenceStatusLine(status)}
        </p>
      )}
    </section>
  );
}

/**
 * Copying what the player ALREADY has to the relays that lack it: off unless they turn it on here, for exactly the
 * relays listed (`lib/sync-consent.ts`). Off, the home only reads: opening it sends nothing. New things the player
 * does are saved to the relays either way. Nothing is signed by this: the copies are the events as they were signed.
 */
function RelayCopyToggle({ pubkey }: { pubkey: string }) {
  const copy = useCopyChoice(pubkey);
  return (
    <section className="menu-section" aria-labelledby="account-relay-copy" data-testid="relay-copy-section">
      <h3 id="account-relay-copy" className="menu-section__title">
        {t('home.account.relayCopy.title')}
      </h3>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={copy.on && !copy.stale} onChange={(e) => copy.set(e.target.checked)} data-testid="relay-copy-toggle" className="mt-1" />
        <span>{t('home.account.relayCopy.toggle')}</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {t('home.account.relayCopy.hint')}
      </p>
      <ul className="text-xs text-muted-foreground" data-testid="relay-copy-destinations">
        {copy.destinations.map((url) => (
          <li key={url}>{url.replace(/^wss:\/\//, '')}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('home.account.relayCopy.eitherWay')}</p>
      {copy.stale && (
        <p className="text-xs text-muted-foreground" data-testid="relay-copy-stale">
          {t('home.account.relayCopy.stale')}
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
