import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

interface BlobbiHeroProps {
  blobbi: BlobbiCompanion;
  /** One line under the name: how it is doing. */
  mood?: string;
  /** Bumps the "happy" hop; the stage plays it once per change. */
  happyKey?: number;
}

/**
 * The Blobbi at the centre of its home, on a lit patch of ground.
 *
 * The standalone decides what to show: which Blobbi, how big, facing front,
 * eyes closed while sleeping, and the scene around it (ground light, shadow,
 * idle sway, the hop after a care action). The renderer decides what the
 * Blobbi looks like; nothing here touches the generated SVG.
 */
export function BlobbiHero({ blobbi, mood, happyKey = 0 }: BlobbiHeroProps) {
  const isSleeping = blobbi.state === 'sleeping';
  const motion = isSleeping ? 'animate-blobbi-sleep' : 'animate-blobbi-idle';

  return (
    <figure className="flex flex-col items-center gap-3" data-testid="blobbi-hero">
      <div className="relative w-52 sm:w-64 lg:w-72">
        <div aria-hidden className="home-ground absolute -bottom-6 left-1/2 h-24 w-[140%] -translate-x-1/2 rounded-[100%]" />
        {isSleeping && (
          <span aria-hidden className="absolute -right-2 top-4 select-none text-2xl font-bold text-foreground/70 scene-text animate-sparkle">
            z<span className="text-lg">z</span>
          </span>
        )}
        <div key={happyKey} className={`relative aspect-square w-full ${happyKey > 0 ? 'animate-blobbi-happy' : ''}`}>
          <div className={`h-full w-full ${motion}`}>
            <BlobbiRenderer
              visual={toBlobbiVisual(blobbi)}
              instanceId={`home-${blobbi.d}`}
              size="100%"
              facing="front"
              isSleeping={isSleeping}
              label={blobbi.name}
              transparent
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
        <div
          aria-hidden
          className={`mx-auto -mt-3 h-3 w-2/3 rounded-full bg-black/25 blur-sm dark:bg-black/50 ${isSleeping ? '' : 'animate-blobbi-shadow'}`}
        />
      </div>
      <figcaption className="text-center">
        <span className="scene-text block text-3xl font-bold tracking-tight sm:text-4xl">{blobbi.name}</span>
        {mood && (
          <span className="scene-text mt-1 block text-sm font-medium text-foreground/80" data-testid="mood-line">
            {blobbi.name} {mood}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
