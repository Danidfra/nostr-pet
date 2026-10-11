/**
 * The bar above the room (the shell's `header`): the way back to the home
 * and whose room this is. Ditto keeps its navigation above the room too, on
 * its sub-header's downward arc (`SubHeaderBar`, `ArcBackground variant="down"`),
 * and leaves the dock to the room's own bar; so does this.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { ArcBackground } from './ArcBackground';

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

export function RoomHeader({ name, stage }: { name: string; stage: BlobbiCompanion['stage'] }) {
  return (
    <div className="room-header relative z-10" data-testid="room-header">
      <ArcBackground variant="down" />
      <div className="relative flex min-h-[3.25em] items-center gap-[0.5em] px-3 pb-[0.4em] pt-[0.25em]">
        <Link to="/" className="room-header-back" aria-label="Back to the home" data-testid="room-back">
          <ArrowLeft />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-[0.95em] font-semibold" data-testid="room-header-name">
          {name}
          <span className="font-normal text-foreground/60"> · {STAGE_WORD[stage]}</span>
        </p>
        {/* The size of the back button, so the name stays centred */}
        <span className="size-[2.25em] shrink-0" aria-hidden />
      </div>
    </div>
  );
}
