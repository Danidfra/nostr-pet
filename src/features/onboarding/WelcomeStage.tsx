/**
 * The world a visitor walks into: a warm sky, a few Blobbis bobbing on soft
 * clouds (the canonical renderer, `welcome-cast.ts`), the name, and the card
 * of the step they are on under them. Used while nobody is signed in and
 * while a signed-in player has no Blobbi yet (adoption), so the way in has
 * one look from the first screen to the egg.
 *
 * Light by design: no images beyond the logo, no animation library; the
 * bobbing is CSS and stops under reduced motion. A tap on a Blobbi makes it
 * hop and coo (sound only when the player turned sound on).
 */
import { useState, type ReactNode } from 'react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { useSound } from '@/features/sound';
import { welcomeCast } from './welcome-cast';

export function WelcomeStage({ children, cast = true }: { children: ReactNode; cast?: boolean }) {
  return (
    <div className="welcome" data-testid="welcome-stage">
      <div className="welcome__sky" aria-hidden>
        <span className="welcome__cloud welcome__cloud--a" />
        <span className="welcome__cloud welcome__cloud--b" />
        <span className="welcome__cloud welcome__cloud--c" />
        <span className="welcome__spark welcome__spark--a" />
        <span className="welcome__spark welcome__spark--b" />
        <span className="welcome__spark welcome__spark--c" />
      </div>
      <div className="welcome__scroll">
        {cast && <WelcomeCast />}
        <div className="welcome__card">{children}</div>
      </div>
    </div>
  );
}

function WelcomeCast() {
  const members = welcomeCast();
  const { play } = useSound();
  const [hop, setHop] = useState<{ d: string; key: number } | null>(null);
  return (
    <div className="welcome__cast" data-testid="welcome-cast">
      {members.map((b, i) => (
        <button
          key={b.d}
          type="button"
          className="welcome__member"
          data-stage={b.stage}
          data-hop={hop?.d === b.d ? hop.key % 2 : undefined}
          style={{ animationDelay: `${i * -1.3}s` }}
          onClick={() => {
            setHop((h) => ({ d: b.d, key: (h?.key ?? 0) + 1 }));
            play(b.stage === 'egg' ? 'poke' : 'happy');
          }}
          aria-label={b.stage === 'egg' ? 'A Blobbi egg' : `A Blobbi ${b.stage}`}
          tabIndex={-1}
        >
          <BlobbiRenderer visual={toBlobbiVisual(b)} instanceId={`welcome-${b.d}`} size="100%" eggCrack="none" transparent style={{ width: '100%', height: '100%' }} expression={b.stage === 'egg' ? undefined : 'happy'} />
          <span className="welcome__shadow" aria-hidden />
        </button>
      ))}
    </div>
  );
}
