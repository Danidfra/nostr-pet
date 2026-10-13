import { Armchair, Check, ChevronRight, ExternalLink, House, LogOut, Map as MapIcon, Moon, Sun, Sunrise, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GameOverlay } from './GameOverlay';
import { useEnvironment } from '@/environment';
import { useSound } from '@/features/sound';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { shortNpub } from '@/lib/format';
import { BLOBBI_ISLAND_URL, DITTO_BLOBBI_URL } from '@/config/ecosystem';
import { KeyBackup } from '@/features/onboarding/KeyBackup';
import { ProfileForm } from '@/features/onboarding/screens';
import { useProfileSetup } from '@/features/onboarding/useProfileSetup';
import { ROOM_PATH, useHomeExperience, type FromRoomState } from '@/lib/home-experience';

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
  /** Opened from the 3D room: the way to the classic home is offered instead of the way to the room. */
  inRoom?: boolean;
}

/** The way back from the room says where it came from, so a player who opens in the room is not sent straight back. */
const BACK_HOME: FromRoomState = { fromRoom: true };

const APPEARANCE_ICON = { island: Sunrise, day: Sun, night: Moon } as const;

/**
 * The game menu: a screen over the home with a few large controls, not a
 * settings list. On the classic home the way out to the Island first; in the
 * room the Island is one of the Worlds (the globe in the header), so the menu
 * does not repeat it (M12.1). Then sound and lighting as big toggles, then
 * the account (who, how signed in, sign out, the profile, and the key backup
 * for a secret-key session). The profile is here, not on the way in (M12.3).
 */
export function MenuSheet({ open, onClose, inRoom = false }: MenuSheetProps) {
  const env = useEnvironment();
  const sound = useSound();
  const { user, metadata } = useCurrentUser();
  const { logout, sessionNsec, loginType } = useLoginActions();
  const [experience, setExperience] = useHomeExperience();
  const opensOnRoom = experience === 'room';

  return (
    <GameOverlay open={open} onClose={onClose} title="Menu" testId="menu-sheet" size="medium">
      <div className="menu">
        {!inRoom && (
          <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" data-testid="enter-island" className="menu-tile menu-tile--hero">
            <span className="menu-tile__icon">
              <MapIcon className="h-7 w-7" aria-hidden />
            </span>
            <span className="menu-tile__text">
              <span className="menu-tile__title">Blobbi Island</span>
              <span className="menu-tile__sub">The wider world, in a new tab. The same Blobbi goes with you. Or use the door.</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </a>
        )}

        {user && (
          <section className="menu-section" aria-labelledby="menu-room">
            <h3 id="menu-room" className="menu-section__title">
              {inRoom ? 'The 2D home' : 'Your 3D room'}
            </h3>
            {inRoom ? (
              <Link
                to="/"
                state={BACK_HOME}
                onClick={() => {
                  setExperience('classic');
                  onClose();
                }}
                data-testid="open-classic"
                className="menu-tile"
              >
                <span className="menu-tile__icon">
                  <House className="h-6 w-6" aria-hidden />
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">2D home</span>
                  <span className="menu-tile__sub">Back to the 2D home. The same Blobbi, the same care; the 3D room is one tap away from it.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </Link>
            ) : (
              <Link
                to={ROOM_PATH}
                onClick={() => {
                  setExperience('room');
                  onClose();
                }}
                data-testid="open-room"
                className="menu-tile"
              >
                <span className="menu-tile__icon">
                  <Armchair className="h-6 w-6" aria-hidden />
                </span>
                <span className="menu-tile__text">
                  <span className="menu-tile__title">Explore in 3D</span>
                  <span className="menu-tile__sub">Rooms to walk around, decorate and care in. The same Blobbi; the 2D home stays one tap away.</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              </Link>
            )}
            <button type="button" role="switch" aria-checked={opensOnRoom} onClick={() => setExperience(opensOnRoom ? 'classic' : 'room')} data-testid="room-first-toggle" className={`menu-tile ${opensOnRoom ? 'menu-tile--on' : ''}`}>
              <span className="menu-tile__text">
                <span className="menu-tile__title">Open in 3D</span>
                <span className="menu-tile__sub">On: Blobbi opens in your 3D room. Off: it opens in the 2D home.</span>
              </span>
              <span className="menu-switch" aria-hidden data-on={opensOnRoom ? 'true' : 'false'} />
            </button>
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

        {user && (
          <section className="menu-section" aria-labelledby="menu-account">
            <h3 id="menu-account" className="menu-section__title">
              Account
            </h3>
            <div className="menu-account">
              {metadata?.picture ? <img src={metadata.picture} alt="" className="menu-account__avatar object-cover" /> : <span aria-hidden className="menu-account__avatar bg-gradient-to-br from-purple-400 to-pink-400" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold">{metadata?.display_name || metadata?.name || shortNpub(user.pubkey)}</span>
                <span className="block truncate text-xs text-muted-foreground">{shortNpub(user.pubkey)}</span>
                <span className="block text-xs text-muted-foreground" data-testid="login-type">
                  {loginType === 'extension' ? 'Signed in with a browser extension. Your key stays with it.' : loginType === 'bunker' ? 'Signed in with a remote signer. Your key stays with it.' : loginType === 'nsec' ? 'Signed in with a secret key kept on this device.' : ''}
                </span>
              </span>
              <button type="button" onClick={logout} className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-xs" data-testid="sign-out">
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </div>
            <details className="menu-details" data-testid="profile-section">
              <summary className="cursor-pointer text-sm font-semibold">Edit your profile</summary>
              <div className="mt-2">
                <MenuProfile pubkey={user.pubkey} metadata={metadata} />
              </div>
            </details>
            {sessionNsec && (
              <details className="menu-details" data-testid="key-backup-section">
                <summary className="cursor-pointer text-sm font-semibold">Back up your secret key</summary>
                <p className="my-2 text-xs text-muted-foreground">This key is the account. Anyone with it controls it; without it there is no way back in. Keep a copy where only you can reach it.</p>
                <KeyBackup nsec={sessionNsec} />
              </details>
            )}
            <a href={DITTO_BLOBBI_URL} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-xs text-muted-foreground underline-offset-2 hover:underline">
              Adopt or manage Blobbis on Ditto
            </a>
          </section>
        )}
      </div>
    </GameOverlay>
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
