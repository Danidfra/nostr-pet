import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check, ChevronRight, HelpCircle, KeyRound, Moon, Music, RadioTower, Sparkles, Sun, Sunrise, UserRound, Volume2, VolumeX } from 'lucide-react';
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
import { RelaySettingsSheet } from '@/features/relays/RelaySettingsSheet';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { DEFAULT_RELAYS, readRelaySettings } from '@/features/relays/relay-settings';
import { LOCALES, LOCALE_NAMES, changeLocale, getLocale, t, type Locale } from '@/i18n';
import { hasUnsaved, pendingWrites, subscribePendingWrites, whenWritesSettle } from '@/lib/pending-writes';

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
  const recordName = (guestRecord && parseModernBlobbiEvent(guestRecord)?.name) || null;
  const guestName = recordName ?? t('menu.guest.yourBlobbiInSentence');
  const locale = getLocale();
  // Switching the language reloads the page: never in the middle of a save, never over unsaved work
  const writing = useSyncExternalStore(subscribePendingWrites, pendingWrites, pendingWrites) > 0;
  const unsavedWork = useSyncExternalStore(subscribePendingWrites, hasUnsaved, hasUnsaved);
  const [switchingTo, setSwitchingTo] = useState<Locale | null>(null);
  const chooseLocale = (id: Locale) => {
    if (id === locale || unsavedWork || switchingTo) return;
    setSwitchingTo(id);
    void whenWritesSettle().then(() => changeLocale(id));
  };
  const languageHint = unsavedWork ? t('menu.language.unsaved') : switchingTo && writing ? t('menu.language.waiting') : t('menu.language.hint');
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
  const [relaysOpen, setRelaysOpen] = useState(false);
  const openRelays = () => {
    onClose();
    setRelaysOpen(true);
  };
  const { health } = useRelayHealth();
  const relayTotal = DEFAULT_RELAYS.length + readRelaySettings().extras.length;
  const relayConnected = [...Object.values(health.relays), ...Object.values(health.extras)].filter((m) => m === 'ok').length;
  const [aboutOpen, setAboutOpen] = useState(false);
  const openAbout = () => {
    onClose();
    setAboutOpen(true);
  };

  return (
    <>
      <GameOverlay open={open} onClose={onClose} title={t('menu.title')} testId="menu-sheet" size="medium">
        <div className="menu">
          {guest && (
            <section className="menu-section" aria-labelledby="menu-guest" data-testid="menu-guest">
              <h3 id="menu-guest" className="menu-section__title">
                {recordName ?? t('menu.guest.yourBlobbi')}
              </h3>
              <p className="menu-section__hint" data-testid="menu-guest-line">
                {guestSnapshot.storageOk ? deviceOnlyLine(guestName) : noStorageLine(guestName)}
              </p>
              <button type="button" onClick={() => ask('save')} data-testid="menu-save-blobbi" className="menu-tile menu-tile--hero">
                <span className="menu-tile__icon">
                  <Sparkles className="h-7 w-7" aria-hidden />
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">{saveBegun ? t('menu.guest.finishSaving', { name: guestName }) : t('menu.guest.save', { name: guestName })}</span>
                  <span className="menu-tile__sub">{t('menu.guest.saveSub')}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </button>
              <button type="button" onClick={() => ask('sign-in')} data-testid="menu-sign-in" className="menu-tile">
                <span className="menu-tile__icon">
                  <KeyRound className="h-6 w-6" aria-hidden />
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">{t('menu.guest.signIn')}</span>
                  <span className="menu-tile__sub">{t('menu.guest.signInSub', { name: recordName ?? t('menu.guest.theGuestBlobbi') })}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </button>
            </section>
          )}

          {user && !guest && (
            <section className="menu-section" aria-labelledby="menu-account">
              <h3 id="menu-account" className="menu-section__title">
                {t('menu.account.title')}
              </h3>
              <button type="button" onClick={openAccount} data-testid="menu-account" className="menu-tile">
                <span className="menu-tile__icon">
                  {metadata?.picture ? <img src={metadata.picture} alt="" className="h-full w-full rounded-full object-cover" /> : <UserRound className="h-6 w-6" aria-hidden />}
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">{metadata?.display_name || metadata?.name || shortNpub(user.pubkey)}</span>
                  <span className="menu-tile__sub">{t('menu.account.sub')}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </button>
            </section>
          )}

          {inRoom && roomSettings && (
            <section className="menu-section" aria-labelledby="menu-room-settings" data-testid="menu-room-settings">
              <h3 id="menu-room-settings" className="menu-section__title">
                {t('menu.room.title')}
              </h3>
              {roomSettings}
            </section>
          )}

          <section className="menu-section" aria-labelledby="menu-sound">
            <h3 id="menu-sound" className="menu-section__title">
              {t('menu.sound.title')}
            </h3>
            <button type="button" role="switch" aria-checked={sound.music} onClick={() => sound.setMusic(!sound.music)} data-testid="music-toggle" className={`menu-tile ${sound.music ? 'menu-tile--on' : ''}`}>
              <span className="menu-tile__icon">
                <Music className={`h-6 w-6 ${sound.music ? '' : 'opacity-50'}`} aria-hidden />
              </span>
              <span className="menu-tile__text">
                <span className="menu-tile__title">{sound.music ? t('menu.music.on') : t('menu.music.off')}</span>
                <span className="menu-tile__sub">{t('menu.music.sub')}</span>
              </span>
              <span className="menu-switch" aria-hidden data-on={sound.music ? 'true' : 'false'} />
            </button>
            <button type="button" role="switch" aria-checked={sound.enabled} onClick={() => sound.setEnabled(!sound.enabled)} data-testid="sound-toggle" className={`menu-tile ${sound.enabled ? 'menu-tile--on' : ''}`}>
              <span className="menu-tile__icon">{sound.enabled ? <Volume2 className="h-6 w-6" aria-hidden /> : <VolumeX className="h-6 w-6" aria-hidden />}</span>
              <span className="menu-tile__text">
                <span className="menu-tile__title">{sound.enabled ? t('menu.sound.on') : t('menu.sound.off')}</span>
                <span className="menu-tile__sub">{t('menu.sound.sub')}</span>
              </span>
              <span className="menu-switch" aria-hidden data-on={sound.enabled ? 'true' : 'false'} />
            </button>
          </section>

          <section className="menu-section" aria-labelledby="menu-relays">
            <h3 id="menu-relays" className="menu-section__title">
              {t('relays.title')}
            </h3>
            <button type="button" onClick={openRelays} data-testid="menu-relays" className="menu-tile">
              <span className="menu-tile__icon">
                <RadioTower className="h-6 w-6" aria-hidden />
              </span>
              <span className="menu-tile__text">
                <span className="menu-tile__title">{t('relays.title')}</span>
                <span className="menu-tile__sub">{t('relays.tile.sub', { connected: relayConnected, total: relayTotal })}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
            </button>
          </section>

          <section className="menu-section" aria-labelledby="menu-language" data-testid="menu-language">
            <h3 id="menu-language" className="menu-section__title">
              {t('menu.language.title')}
            </h3>
            <p className="menu-section__hint" aria-live="polite" data-testid="menu-language-hint">
              {languageHint}
            </p>
            <div role="radiogroup" aria-labelledby="menu-language" className="menu-choices">
              {LOCALES.map((id) => {
                const selected = locale === id;
                return (
                  <button key={id} type="button" role="radio" lang={id} aria-checked={selected} disabled={unsavedWork || (switchingTo !== null && switchingTo !== id)} onClick={() => chooseLocale(id)} data-testid={`locale-${id}`} className={`menu-choice ${selected ? 'menu-choice--on' : ''}`}>
                    <span className="menu-choice__title">{LOCALE_NAMES[id]}</span>
                    {selected && <Check className="menu-choice__check h-4 w-4" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="menu-section" aria-labelledby="menu-help">
            <h3 id="menu-help" className="menu-section__title">
              {t('menu.help.title')}
            </h3>
            <button type="button" onClick={openAbout} data-testid="menu-about" className="menu-tile">
              <span className="menu-tile__icon">
                <HelpCircle className="h-6 w-6" aria-hidden />
              </span>
              <span className="menu-tile__text">
                <span className="menu-tile__title">{t('menu.help.about')}</span>
                <span className="menu-tile__sub">{t('menu.help.aboutSub')}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
            </button>
          </section>

          <section className="menu-section" aria-labelledby="menu-appearance">
            <h3 id="menu-appearance" className="menu-section__title">
              {t('menu.lighting.title')}
            </h3>
            <p className="menu-section__hint">{t('menu.lighting.hint', { phase: t(`common.phase.${env.island.phase}`) })}</p>
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
      <RelaySettingsSheet open={relaysOpen} onClose={() => setRelaysOpen(false)} />
    </>
  );
}
