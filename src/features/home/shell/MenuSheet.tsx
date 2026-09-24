import { Check, LogOut, Map as MapIcon, Volume2, VolumeX } from 'lucide-react';
import { Sheet } from './Sheet';
import { useEnvironment } from '@/environment';
import { useSound } from '@/features/sound';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { shortNpub } from '@/lib/format';
import { BLOBBI_ISLAND_URL, DITTO_BLOBBI_URL } from '@/config/ecosystem';

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Everything that is not play: how the home looks, sound, the way out to
 * the Island, and the account. One sheet, no settings page.
 */
export function MenuSheet({ open, onClose }: MenuSheetProps) {
  const env = useEnvironment();
  const sound = useSound();
  const { user, metadata } = useCurrentUser();
  const { logout } = useLoginActions();

  return (
    <Sheet open={open} onClose={onClose} title="Menu" testId="menu-sheet">
      <div className="flex flex-col gap-5">
        <section aria-labelledby="menu-appearance">
          <h3 id="menu-appearance" className="mb-2 text-sm font-semibold">
            Home lighting
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            It is {env.island.phase} on the Island right now. Your Blobbi looks the same in every light.
          </p>
          <div role="radiogroup" aria-labelledby="menu-appearance" className="flex flex-col gap-1.5">
            {env.appearances.map((id) => {
              const selected = env.appearance === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => env.setAppearance(id)}
                  data-testid={`appearance-${id}`}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent'}`}
                >
                  <span>
                    <span className="block text-sm font-semibold">{env.copy[id].name}</span>
                    <span className="block text-xs text-muted-foreground">{env.copy[id].tagline}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="menu-sound">
          <h3 id="menu-sound" className="mb-2 text-sm font-semibold">
            Sound
          </h3>
          <button
            type="button"
            role="switch"
            aria-checked={sound.enabled}
            onClick={() => sound.setEnabled(!sound.enabled)}
            data-testid="sound-toggle"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left hover:bg-accent"
          >
            <span>
              <span className="block text-sm font-semibold">{sound.enabled ? 'Sounds on' : 'Sounds off'}</span>
              <span className="block text-xs text-muted-foreground">A few soft sounds when you care for your Blobbi. Off unless you turn it on.</span>
            </span>
            {sound.enabled ? <Volume2 className="h-5 w-5 shrink-0" aria-hidden /> : <VolumeX className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
          </button>
        </section>

        <section aria-labelledby="menu-world">
          <h3 id="menu-world" className="mb-2 text-sm font-semibold">
            The wider world
          </h3>
          <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" data-testid="enter-island" className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 hover:bg-accent">
            <MapIcon className="h-5 w-5 text-primary" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">Blobbi Island</span>
              <span className="block text-xs text-muted-foreground">A separate world. The same Blobbi; a new tab. Or use the door in the home.</span>
            </span>
          </a>
          <a href={DITTO_BLOBBI_URL} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-xs text-muted-foreground underline-offset-2 hover:underline">
            Adopt or manage Blobbis on Ditto
          </a>
        </section>

        {user && (
          <section aria-labelledby="menu-account">
            <h3 id="menu-account" className="mb-2 text-sm font-semibold">
              Account
            </h3>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                {metadata?.picture ? <img src={metadata.picture} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span aria-hidden className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{metadata?.display_name || metadata?.name || shortNpub(user.pubkey)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{shortNpub(user.pubkey)}</span>
                </span>
              </span>
              <button type="button" onClick={logout} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent" data-testid="sign-out">
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}
