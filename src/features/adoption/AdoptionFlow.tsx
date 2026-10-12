import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSound } from '@/features/sound';
import { Egg, Loader2, MapPin, Sparkles } from 'lucide-react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { NostrEvent } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { EnterIslandButton } from '@/features/home/EnterIslandButton';
import { DEFAULT_EGG_NAME, NAME_MAX_LENGTH, newEggPreview, normalizeBlobbiName, previewCompanion, renamePreview, type EggPreview } from './adoption-plan';
import { useAdoptEgg } from './useAdoptEgg';

/** Three sentences a newcomer needs, and no more. Shared by the signed-out and the empty home. */
export function WhatIsBlobbi() {
  return (
    <ul className="what-is-blobbi" aria-label="What a Blobbi is">
      <li>
        <Egg className="h-4 w-4" aria-hidden />
        <span>A Blobbi is a small companion that hatches from an egg and grows as you care for it.</span>
      </li>
      <li>
        <Sparkles className="h-4 w-4" aria-hidden />
        <span>It is yours: it lives on Nostr under your own key, and only that key can care for it.</span>
      </li>
      <li>
        <MapPin className="h-4 w-4" aria-hidden />
        <span>This is its home. The same Blobbi goes out to Blobbi Island with you.</span>
      </li>
    </ul>
  );
}

interface AdoptionFlowProps {
  pubkey: string;
  /** The player's kind 0 name, for a brand-new profile. */
  suggestedName?: string;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  /**
   * The player just came through the welcome (this session): the three
   * lines about what a Blobbi is were said there, so the intro says only
   * what this step is for. A returning player who lands here directly
   * gets the full intro.
   */
  brief?: boolean;
  /** Another egg, for a player who already has Blobbis (the kit's level unlock allows it; checked again before signing). */
  additional?: boolean;
}

const STEP_COPY = { idle: '', checking: 'Checking your relays…', egg: 'Signing your egg…', profile: 'Noting it in your profile…' } as const;

/**
 * First run: understand, adopt, see it in the room. Two screens (why, then
 * the egg with a name) and one tap that signs two events. The preview is
 * generated once and is the source of truth for what gets published; nothing
 * is regenerated between the picture the player saw and the event.
 */
export function AdoptionFlow({ pubkey, suggestedName, updateCompanionEvent, refresh, brief = false, additional = false }: AdoptionFlowProps) {
  const [screen, setScreen] = useState<'intro' | 'egg'>(brief || additional ? 'egg' : 'intro');
  // The egg exists from the moment its screen does: made with the screen (never in an effect after it), so the first
  // frame of the egg screen already draws it and Adopt never sits under an empty pedestal
  const [preview, setPreview] = useState<EggPreview | null>(() => (brief || additional ? safePreview(pubkey) : null));
  const [nameInput, setNameInput] = useState('');
  const adoption = useAdoptEgg({ pubkey, suggestedName, updateCompanionEvent, refresh, additional });
  const openEgg = () => {
    setPreview((p) => (p && p.ownerPubkey === pubkey ? p : safePreview(pubkey)));
    setScreen('egg');
  };
  // Another account signed in under the same screen: an egg is only ever made for the key that will sign it
  const stale = preview !== null && preview.ownerPubkey !== pubkey;
  useEffect(() => {
    if (stale) setPreview(safePreview(pubkey));
  }, [stale, pubkey]);

  const name = normalizeBlobbiName(nameInput);
  const companion = useMemo(() => (preview && !stale ? previewCompanion(renamePreview(preview, name.ok ? name.name : DEFAULT_EGG_NAME)) : null), [preview, stale, name]);
  // The egg could not be made or drawn here: said so, with a way on (a new egg), never an Adopt over nothing
  const eggMissing = screen === 'egg' && !stale && companion === null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!preview || !companion || !name.ok || adoption.isPending) return;
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

  // A player who just came through the welcome goes straight to their egg: the why was said there
  if (screen === 'intro' && !brief) {
    return (
      <div className="welcome-card text-center" data-testid="adoption-intro" data-brief="false">
        <Egg className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h2 className="welcome-card__title">No Blobbi lives here yet</h2>
        <WhatIsBlobbi />
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="lifecycle-pill !animate-none" onClick={openEgg} data-testid="adoption-start">
            <Egg className="h-4 w-4" aria-hidden />
            Adopt an egg
          </button>
          <EnterIslandButton variant="secondary" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="welcome-card adopt text-center" data-testid="adoption-egg" data-brief={brief ? 'true' : 'false'} aria-busy={adoption.isPending}>
      <h2 className="welcome-card__title">{additional ? 'A new egg' : brief ? 'Here is your egg' : 'Your egg'}</h2>
      <AdoptionEgg companion={companion} d={companion ? preview?.d : undefined} pending={adoption.isPending} missing={eggMissing} onAnother={() => setPreview(safePreview(pubkey))} />
      <p className="text-sm text-muted-foreground">Nobody else has this one: its colours and shape come from your key. Give it a name, or keep "{DEFAULT_EGG_NAME}" for now.</p>
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
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <button type="submit" className="lifecycle-pill !animate-none" disabled={!preview || !companion || !name.ok || adoption.isPending} data-testid="adoption-adopt">
          {adoption.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {adoption.isPending ? STEP_COPY[adoption.step] || 'Adopting…' : adoption.error ? 'Try again' : 'Adopt'}
        </button>
        {!brief && !additional && (
          <button type="button" className="text-sm font-semibold text-muted-foreground underline" onClick={() => setScreen('intro')} disabled={adoption.isPending} data-testid="adoption-back">
            Back
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="adoption-footnote">
        {additional
          ? 'Adopting saves the egg to your account (two signatures). This egg hatches once its incubation tasks are done: its details list them.'
          : 'Adopting saves the egg to your account (two signatures). Your first egg is ready to hatch as soon as it is home: you choose the moment.'}
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
