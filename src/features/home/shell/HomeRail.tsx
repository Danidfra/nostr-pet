import { MapPin } from 'lucide-react';
import type { BlobbiCompanion, BlobbonautProfile } from '@blobbi-kit/core';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import { BlobbiStatusPanel, type StatItem } from '../BlobbiStatusPanel';
import { ProgressionStrip } from '../ProgressionStrip';
import { roomById, type RoomState } from '../rooms';

interface HomeRailProps {
  blobbi: BlobbiCompanion;
  mood: string;
  statItems: readonly StatItem[];
  profile: BlobbonautProfile | null | undefined;
  rooms: RoomState;
  onOpenBlobbi: () => void;
}

/**
 * The desktop rail: what a phone keeps in the Blobbi sheet, standing beside
 * the room where there is width for it. Condition, progression, the rooms,
 * the way to the Island. Nothing here is a second source of truth: the
 * same items the sheet shows, the same room state the scene uses.
 */
export function HomeRail({ blobbi, mood, statItems, profile, rooms, onOpenBlobbi }: HomeRailProps) {
  return (
    <div className="rail" data-testid="home-rail">
      <section className="rail-card" aria-label="Condition">
        <header className="rail-card__head">
          <h2 className="rail-card__title">{blobbi.name}</h2>
          <p className="rail-card__sub">{mood}</p>
        </header>
        <BlobbiStatusPanel items={statItems} />
        <div className="mt-3 border-t border-border/60 pt-3">
          <ProgressionStrip blobbi={blobbi} profile={profile} />
        </div>
        <button type="button" className="rail-link" onClick={onOpenBlobbi}>
          Missions and details
        </button>
      </section>
      <section className="rail-card" aria-label="Rooms">
        <h2 className="rail-card__title">Rooms</h2>
        <ul className="rail-rooms" role="list">
          {rooms.order.map((id) => {
            const def = roomById(id);
            const current = id === rooms.room.id;
            return (
              <li key={id}>
                <button type="button" className={`rail-room ${current ? 'rail-room--current' : ''}`} onClick={() => rooms.go(id)} disabled={!rooms.canMove || current} aria-current={current ? 'location' : undefined} data-testid={`rail-room-${id}`}>
                  <span className="rail-room__name">{def.label}</span>
                  <span className="rail-room__tag">{def.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" className="rail-island">
        <MapPin className="h-4 w-4" aria-hidden />
        Go to Blobbi Island
      </a>
    </div>
  );
}
