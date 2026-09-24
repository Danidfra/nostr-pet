import { ChevronLeft, ChevronRight } from 'lucide-react';
import { roomById, type RoomId } from './rooms';
import type { RoomState } from './useRoom';

/**
 * Moving between rooms: a chevron on each side of the scene (the line
 * wraps, so both are always there) and, in the scene's top bar, the room's
 * name with one dot per room. Swiping the scene does the same thing (see
 * `HomeScene`).
 */
export function RoomArrows({ rooms, disabled = false }: { rooms: RoomState; disabled?: boolean }) {
  const left = rooms.neighbour('left');
  const right = rooms.neighbour('right');
  const canMove = rooms.canMove && !disabled;
  return (
    <>
      <button type="button" className="room-arrow room-arrow--left" onClick={() => rooms.go(left)} disabled={!canMove} aria-label={`Go to the ${roomById(left).label.toLowerCase()}`} data-testid="room-arrow-left">
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <button type="button" className="room-arrow room-arrow--right" onClick={() => rooms.go(right)} disabled={!canMove} aria-label={`Go to the ${roomById(right).label.toLowerCase()}`} data-testid="room-arrow-right">
        <ChevronRight className="h-6 w-6" aria-hidden />
      </button>
    </>
  );
}

export function RoomIndicator({ rooms, disabled = false }: { rooms: RoomState; disabled?: boolean }) {
  const canMove = rooms.canMove && !disabled;
  return (
    <div className="room-pill" data-testid="room-pill" data-room={rooms.room.id}>
      <span className="room-pill__name">{rooms.room.label}</span>
      <span className="room-pill__dots" role="group" aria-label="Rooms">
        {rooms.order.map((id: RoomId) => {
          const def = roomById(id);
          const current = id === rooms.room.id;
          return (
            <button key={id} type="button" className={`room-dot ${current ? 'room-dot--current' : ''}`} onClick={() => rooms.go(id)} disabled={!canMove || current} aria-label={current ? `${def.label} (here)` : `Go to the ${def.label.toLowerCase()}`} aria-current={current ? 'location' : undefined} data-testid={`room-dot-${id}`} />
          );
        })}
      </span>
    </div>
  );
}
