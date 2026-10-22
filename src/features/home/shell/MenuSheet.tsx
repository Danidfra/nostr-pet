import { useState, type ReactNode } from 'react';
import { Check, ChevronRight, HelpCircle, KeyRound, Moon, Sparkles, Sun, Sunrise, UserRound, Volume2, VolumeX } from 'lucide-react';
import { deviceOnlyLine, noStorageLine, useGuestSnapshot, useGuestUi } from '@/features/guest';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';
import { guestBlobbiEvent } from '@/features/guest/guest-world';
import { GameOverlay } from './GameOverlay';
import { AccountSheet } from './AccountSheet';
import { useEnvironment } from '@/environment';
import { useSound } from '@/features/sound';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { shortNpub } from '@/lib/format';
import { AboutBlobbiSheet } from '@/features/onboarding/screens';

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
  /** Opened from the 3D room: the Island is one of the Worlds there, so the menu does not repeat it. */
  inRoom?: boolean;
  /** The 3D room's own settings (how the Blobbi is drawn, graphics, the view), shown as one section when in the room. */
  roomSettings?: ReactNode;
}

const APPEARANCE_ICON = { island: Sunrise, day: Sun, night: Moon } as const;

/**
 * The game menu: the one settings entry of the game, a screen over the home
 * with a few large controls, not a settings list. On the classic home the
 * way out to the Island first; in the room the Island is one of the Worlds
 * (the globe in the header), so the menu does not repeat it (M12.1). The
 * Worlds themselves are the globe at the top left of both homes, not a tile
 * here. Then
 * the account as one clearly named tile (its own screen: the profile, the
 * key backup, sign out; M14.1), the room's settings when in the room, sound
 * and lighting as big toggles. Which home opens is the switch in the upper
 * right of both homes, not a setting here (M14.1). A guest sees Save my
 * Blobbi and I already have an account instead of the account.
 */
export function MenuSheet({ open, onClose, inRoom = false, roomSettings }: MenuSheetProps) {
  const env = useEnvironment();
  const sound = useSound();
  const { user, metadata } = useCurrentUser();
  const { loginType } = useLoginActions();
  // A guest (M14): the Blobbi lives on this device; the account block is the way to save it, or to sign in
  const guest = loginType === 'guest';
  const guestUi = useGuestUi();
  const guestSnapshot = useGuestSnapshot();
  const saveBegun = !!guestSnapshot.doc?.migration;
  // The guest Blobbi's name, for the words (M14.2): "Save Lupa", not "Save my Blobbi"
  const guestRecord = guestSnapshot.doc ? guestBlobbiEvent(guestSnapshot.doc.events, guestSnapshot.doc.blobbiD) : null;
  const guestName = (guestRecord && parseModernBlobbiEvent(guestRecord)?.name) || 'your Blobbi';
  const ask = (what: 'save' | 'sign-in') => {
    onClose();
    if (what === 'save') guestUi.requestSave();
    else guestUi.requestSignIn();
  };
  const [accountOpen, setAccountOpen] = useState(false);
  const openAccount = () => {
    onClose();
    setAccountOpen(true);
  };
  const [aboutOpen, setAboutOpen] = useState(false);
  const openAbout = () => {
    onClose();
    setAboutOpen(true);
  };

  return (
    <>
      <GameOverlay open={open} onClose={onClose} title="Menu" testId="menu-sheet" size="medium">
        <div className="menu">
          {guest && (
            <section className="menu-section" aria-labelledby="menu-guest" data-testid="menu-guest">
              <h3 id="menu-guest" className="menu-section__title">
                {guestName === 'your Blobbi' ? 'Your Blobbi' : guestName}
              </h3>
              <p className="menu-section__hint" data-testid="menu-guest-line">
                {guestSnapshot.storageOk ? deviceOnlyLine(guestName) : noStorageLine(guestName)}
              </p>
              <button type="button" onClick={() => ask('save')} data-testid="menu-save-blobbi" className="menu-tile menu-tile--hero">
                <span className="menu-tile__icon">
                  <Sparkles className="h-7 w-7" aria-hidden />
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">{saveBegun ? `Finish saving ${guestName}` : `Save ${guestName}`}</span>
                  <span className="menu-tile__sub">A home you can return to from other devices, and the door to new worlds. The very same Blobbi.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </button>
              <button type="button" onClick={() => ask('sign-in')} data-testid="menu-sign-in" className="menu-tile">
                <span className="menu-tile__icon">
                  <KeyRound className="h-6 w-6" aria-hidden />
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">I already have an account</span>
                  <span className="menu-tile__sub">Sign in with the account your Blobbis live in. {guestName === 'your Blobbi' ? 'The guest Blobbi' : guestName} stays here on this device.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </button>
            </section>
          )}

          {user && !guest && (
            <section className="menu-section" aria-labelledby="menu-account">
              <h3 id="menu-account" className="menu-section__title">
                Account
              </h3>
              <button type="button" onClick={openAccount} data-testid="menu-account" className="menu-tile">
                <span className="menu-tile__icon">
                  {metadata?.picture ? <img src={metadata.picture} alt="" className="h-full w-full rounded-full object-cover" /> : <UserRound className="h-6 w-6" aria-hidden />}
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">{metadata?.display_name || metadata?.name || shortNpub(user.pubkey)}</span>
                  <span className="menu-tile__sub">Your name and picture, your key backup, and sign out.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </button>
            </section>
          )}

          {inRoom && roomSettings && (
            <section className="menu-section" aria-labelledby="menu-room-settings" data-testid="menu-room-settings">
              <h3 id="menu-room-settings" className="menu-section__title">
                3D room
              </h3>
              {roomSettings}
            </section>
          )}

          <section className="menu-section" aria-labelledby="menu-sound">
            <h3 id="menu-sound" className="menu-section__title">
              Sound
            </h3>
            <button type="button" role="switch" aria-checked={sound.enabled} onClick={() => sound.setEnabled(!sound.enabled)} data-testid="sound-toggle" className={`menu-tile ${sound.enabled ? 'menu-tile--on' : ''}`}>
              <span className="menu-tile__icon">{sound.enabled ? <Volume2 className="h-6 w-6" aria-hidden /> : <VolumeX className="h-6 w-6" aria-hidden />}</span>
              <span className="menu-tile__text">
                <span className="menu-tile__title">{sound.enabled ? 'Sounds on' : 'Sounds off'}</span>
                <span className="menu-tile__sub">A few soft sounds when you care for your Blobbi.</span>
              </span>
              <span className="menu-switch" aria-hidden data-on={sound.enabled ? 'true' : 'false'} />
            </button>
          </section>

          <section className="menu-section" aria-labelledby="menu-help">
            <h3 id="menu-help" className="menu-section__title">
              Help
            </h3>
            <button type="button" onClick={openAbout} data-testid="menu-about" className="menu-tile">
              <span className="menu-tile__icon">
                <HelpCircle className="h-6 w-6" aria-hidden />
              </span>
              <span className="menu-tile__text">
                <span className="menu-tile__title">What is Blobbi?</span>
                <span className="menu-tile__sub">What a Blobbi is, what Nostr is, and where the worlds are.</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
            </button>
          </section>

          <section className="menu-section" aria-labelledby="menu-appearance">
            <h3 id="menu-appearance" className="menu-section__title">
              Home lighting
            </h3>
            <p className="menu-section__hint">It is {env.island.phase} on the Island right now. Your Blobbi looks the same in every light.</p>
            <div role="radiogroup" aria-labelledby="menu-appearance" className="menu-choices">
              {env.appearances.map((id) => {
                const selected = env.appearance === id;
                const Icon = APPEARANCE_ICON[id as keyof typeof APPEARANCE_ICON] ?? Sun;
                return (
                  <button key={id} type="button" role="radio" aria-checked={selected} onClick={() => env.setAppearance(id)} data-testid={`appearance-${id}`} className={`menu-choice ${selected ? 'menu-choice--on' : ''}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                    <span className="menu-choice__title">{env.copy[id].name}</span>
                    <span className="menu-choice__sub">{env.copy[id].tagline}</span>
                    {selected && <Check className="menu-choice__check h-4 w-4" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </GameOverlay>
      {user && !guest && <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />}
      <AboutBlobbiSheet open={aboutOpen} onClose={() => setAboutOpen(false)} testId="menu-about-sheet" />
    </>
  );
}
