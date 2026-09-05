import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

interface BlobbiHeroProps {
  blobbi: BlobbiCompanion;
}

/**
 * The Blobbi at the centre of its home.
 *
 * The standalone decides what to show: which Blobbi, how big, facing front,
 * eyes closed while sleeping. The renderer decides what it looks like.
 */
export function BlobbiHero({ blobbi }: BlobbiHeroProps) {
  const isSleeping = blobbi.state === 'sleeping';

  return (
    <figure className="flex flex-col items-center gap-2" data-testid="blobbi-hero">
      <div className="relative w-48 sm:w-64">
        <div className={`aspect-square w-full ${isSleeping ? '' : 'animate-blobbi-idle'}`}>
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
        <div
          aria-hidden
          className={`mx-auto -mt-2 h-3 w-2/3 rounded-full bg-black/30 blur-sm dark:bg-black/50 ${isSleeping ? '' : 'animate-blobbi-shadow'}`}
        />
      </div>
      <figcaption className="text-center">
        <span className="block text-2xl font-bold">{blobbi.name}</span>
      </figcaption>
    </figure>
  );
}
