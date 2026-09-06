import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

interface BlobbiSelectorProps {
  companions: readonly BlobbiCompanion[];
  currentD: string;
  onSelect: (d: string) => void;
}

/**
 * The player's other Blobbis, as small round portraits drawn by the canonical
 * renderer. Shown only when there is more than one; the picked one is ringed
 * and named. Selecting is one tap.
 */
export function BlobbiSelector({ companions, currentD, onSelect }: BlobbiSelectorProps) {
  if (companions.length < 2) return null;

  return (
    <div role="radiogroup" aria-label="Choose your Blobbi" className="flex flex-wrap items-end justify-center gap-2 sm:gap-3">
      {companions.map((c) => {
        const selected = c.d === currentD;
        return (
          <button
            key={c.d}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            onClick={() => onSelect(c.d)}
            className="group flex flex-col items-center gap-1 focus-visible:outline-none"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card/80 shadow-sm transition group-focus-visible:ring-2 group-focus-visible:ring-ring sm:h-14 sm:w-14 ${
                selected ? 'border-primary ring-2 ring-primary/40' : 'border-border/70 opacity-80 group-hover:opacity-100'
              }`}
            >
              <BlobbiRenderer
                visual={toBlobbiVisual(c)}
                instanceId={`pick-${c.d}`}
                size={36}
                isSleeping={c.state === 'sleeping'}
                transparent
              />
            </span>
            <span className={`scene-text max-w-[4.5rem] truncate text-[11px] font-semibold ${selected ? '' : 'text-foreground/70'}`} aria-hidden>
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
