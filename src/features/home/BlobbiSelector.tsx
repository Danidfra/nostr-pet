import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

interface BlobbiSelectorProps {
  companions: readonly BlobbiCompanion[];
  currentD: string;
  onSelect: (d: string) => void;
}

/** A small row of the player's Blobbis, shown only when there is more than one. */
export function BlobbiSelector({ companions, currentD, onSelect }: BlobbiSelectorProps) {
  if (companions.length < 2) return null;

  return (
    <div role="radiogroup" aria-label="Choose your Blobbi" className="flex flex-wrap justify-center gap-2">
      {companions.map((c) => {
        const selected = c.d === currentD;
        return (
          <button
            key={c.d}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(c.d)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected ? 'border-primary bg-primary/10 font-semibold' : 'border-border bg-card/60 hover:bg-accent'
            }`}
          >
            <BlobbiRenderer
              visual={toBlobbiVisual(c)}
              instanceId={`pick-${c.d}`}
              size="sm"
              isSleeping={c.state === 'sleeping'}
              transparent
            />
            <span>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
