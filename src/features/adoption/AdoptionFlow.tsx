import { useMemo, useState, type FormEvent } from 'react';
import { useSound } from '@/features/sound';
import { Loader2, Sparkles } from 'lucide-react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { NostrEvent } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { DEFAULT_EGG_NAME, NAME_MAX_LENGTH, newEggPreview, normalizeBlobbiName, previewCompanion, renamePreview, type EggPreview } from './adoption-plan';
import { useAdoptEgg } from './useAdoptEgg';

interface AdoptionFlowProps {
  pubkey: string;
  /** The player's kind 0 name, for a brand-new profile. */
  suggestedName?: string;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  /** Another egg, for a player who already has Blobbis (the kit's level unlock allows it; checked again before signing). */
  additional?: boolean;
  /** A guest's egg (M14): kept on this device, nothing signed, nothing sent; the words say so. */
  guest?: boolean;
}

const STEP_COPY = { idle: '', checking: 'Checking your relays…', egg: 'Signing your egg…', profile: 'Noting it in your profile…' } as const;
const GUEST_STEP_COPY = { idle: '', checking: 'Making room…', egg: 'Settling your egg in…', profile: 'Nearly there…' } as const;

/**
 * The egg, with a name, and one tap that signs two events. Straight away: no
 * screen about having no Blobbi first (the welcome said what a Blobbi is),
 * after a refresh as on the first visit. The preview is the source of truth
 * for what gets published; nothing is regenerated between the picture the
 * player saw and the event.
 *
 * The egg exists from the moment its screen does, made for the key that is
 * signed in during the very render that shows it (never in an effect after
 * it): the first frame draws it, and an egg made for another key is never on
 * screen, not even for a frame (M12.3: that frame was an empty pedestal over
 * a disabled Adopt, with nothing said).
 */
export function AdoptionFlow({ pubkey, suggestedName, updateCompanionEvent, refresh, additional = false, guest = false }: AdoptionFlowProps) {
  const stepCopy = guest ? GUEST_STEP_COPY : STEP_COPY;
  const [made, setMade] = useState<{ pubkey: string; preview: EggPreview | null }>(() => ({ pubkey, preview: safePreview(pubkey) }));
  if (made.pubkey !== pubkey) setMade({ pubkey, preview: safePreview(pubkey) });
  const preview = made.pubkey === pubkey ? made.preview : null;
  const [nameInput, setNameInput] = useState('');
  const adoption = useAdoptEgg({ pubkey, suggestedName, updateCompanionEvent, refresh, additional });

  const name = normalizeBlobbiName(nameInput);
  const companion = useMemo(() => (preview ? previewCompanion(renamePreview(preview, name.ok ? name.name : DEFAULT_EGG_NAME)) : null), [preview, name]);
  // The egg could not be made or drawn here: said so, with a way on (a new egg), never an Adopt over nothing
  const eggMissing = companion === null;
  // Adopt is offered only over an egg that is drawn, named and not already on its way
  const canAdopt = !!preview && !!companion && name.ok && !adoption.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canAdopt || !preview || !name.ok) return;
    adoption.reset();
    adoption.adopt(renamePreview(preview, name.name));
  };

  const result = adoption.result;

  if (result?.kind === 'existing') {
    return (
      <div className="home-glass mx-auto w-full max-w-md space-y-3 rounded-3xl p-6 text-center" data-testid="adoption-existing" role="status">
        <p className="text-lg font-semibold">You already have a Blobbi.</p>
        <p className="text-sm text-muted-foreground">Bringing it home…</p>
      </div>
    );
  }

  if (result?.kind === 'limit') {
    return (
      <div className="welcome-card text-center" data-testid="adoption-limit" role="status">
        <p className="welcome-card__title">Not quite yet</p>
        <p className="text-sm text-muted-foreground">
          Your Blobbonaut level allows {result.max} Blobbi{result.max === 1 ? '' : 's'}, and you have {result.count}. A new egg can join at the next unlock.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="welcome-card adopt text-center" data-testid="adoption-egg" data-ready={canAdopt ? 'true' : 'false'} aria-busy={adoption.isPending}>
      <h2 className="welcome-card__title">{additional ? 'A new egg' : 'Here is your egg'}</h2>
      <AdoptionEgg companion={companion} d={companion ? preview?.d : undefined} pending={adoption.isPending} missing={eggMissing} onAnother={() => setMade({ pubkey, preview: safePreview(pubkey) })} />
      <p className="text-sm text-muted-foreground">
        {guest ? `Nobody else has this one: its colours and shape are its own. Give it a name, or keep "${DEFAULT_EGG_NAME}" for now.` : `Nobody else has this one: its colours and shape come from your key. Give it a name, or keep "${DEFAULT_EGG_NAME}" for now.`}
      </p>
      <div className="text-left">
        <label htmlFor="egg-name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="egg-name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder={DEFAULT_EGG_NAME}
          maxLength={NAME_MAX_LENGTH + 8}
          autoComplete="off"
          spellCheck={false}
          disabled={adoption.isPending}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="adoption-name"
        />
        {!name.ok && (
          <p className="mt-1 text-xs text-destructive" data-testid="adoption-name-error">
            {name.reason}
          </p>
        )}
      </div>
      {adoption.error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="adoption-error">
          {adoption.error.message}
        </p>
      )}
      {result?.kind === 'adopted' && result.profileError && (
        <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" data-testid="adoption-profile-warning">
          Your egg is here. Its note in your profile did not save ({result.profileError}); choosing it later will fix that.
        </p>
      )}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button type="submit" className="lifecycle-pill !animate-none" disabled={!canAdopt} data-testid="adoption-adopt">
          {adoption.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {adoption.isPending ? stepCopy[adoption.step] || 'Adopting…' : adoption.error ? 'Try again' : 'Adopt'}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="adoption-footnote">
        {guest
          ? 'Your egg stays on this device for now: no account, no key, nothing sent anywhere. Whenever you like, you can save your Blobbi to take it further.'
          : additional
            ? 'Adopting saves the egg to your account (two signatures). This egg hatches once its incubation tasks are done: its details list them.'
            : 'Adopting saves the egg to your account (two signatures). Then it is home, and ready to hatch under your taps.'}
      </p>
    </form>
  );
}

/**
 * The egg itself, presented: on a little lit pedestal, rocking now and then as
 * if something inside stirs; a tap makes it wobble (and coo, with sound on).
 * It is the canonical drawing of the very egg that will be published (the
 * preview is the event), not a stand-in.
 */
function AdoptionEgg({ companion, d, pending, missing, onAnother }: { companion: ReturnType<typeof previewCompanion>; d: string | undefined; pending: boolean; missing: boolean; onAnother: () => void }) {
  const { play } = useSound();
  const [wobble, setWobble] = useState(0);
  return (
    <div className="adopt__stage" data-testid="adoption-preview" data-d={d} data-pending={pending ? 'true' : undefined} data-drawn={companion ? 'true' : 'false'}>
      <span className="adopt__light" aria-hidden />
      <span className="adopt__pedestal" aria-hidden />
      {companion && (
        <div className="adopt__frame">
          <button
            type="button"
            className="adopt__egg"
            data-wobble={wobble % 2}
            key={wobble}
            onClick={() => {
              setWobble((w) => w + 1);
              play('poke');
            }}
            aria-label="Your egg. Tap it."
            data-testid="adoption-egg-art"
          >
            <BlobbiRenderer visual={toBlobbiVisual(companion)} instanceId={`adopt-${companion.d}`} size="100%" eggCrack="none" transparent style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      )}
      {missing && (
        <div className="adopt__missing" role="alert" data-testid="adoption-egg-missing">
          <p>Your egg did not appear.</p>
          <button type="button" className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-sm" onClick={onAnother} data-testid="adoption-egg-retry">
            Try another egg
          </button>
        </div>
      )}
    </div>
  );
}

/** A new egg for this key, or null if one could not be made here (the screen says so and offers another). */
function safePreview(pubkey: string): EggPreview | null {
  try {
    return newEggPreview(pubkey);
  } catch {
    return null;
  }
}
