/**
 * The room's props drawn by the page, for the simple room (no WebGL): a dish
 * with the food on it, the food smaller with each bite; a ball on its
 * shadow. Anchored to the floor by the shell (`data-anchor="floor"`), sized
 * by the room's scale there (`--anchor-px`). The 3D room draws the same
 * props itself, among the furniture (`RoomScene.setProps`).
 */
import type { CSSProperties } from 'react';
import { ItemGlyph } from '@/features/inventory';
import type { RoomProp } from '../lib/room-props';

export function RoomFlatProp({ prop, onTap }: { prop: RoomProp; onTap?: (id: string) => void }) {
  if (prop.kind === 'ball') {
    return (
      <button
        type="button"
        className="room-prop room-prop--ball"
        data-testid="room-prop"
        data-kind="ball"
        data-leaving={prop.leaving ? 'true' : undefined}
        aria-label="Ball"
        onClick={() => onTap?.(prop.id)}
      >
        <span className="room-prop__shadow" aria-hidden />
        <svg viewBox="0 0 64 64" className="room-prop__ball" aria-hidden>
          <defs>
            <clipPath id={`room-ball-${prop.id}`}>
              <circle cx="32" cy="32" r="30" />
            </clipPath>
          </defs>
          <circle cx="32" cy="32" r="30" fill="#f6efe2" />
          <g clipPath={`url(#room-ball-${prop.id})`}>
            <path d="M-4 22 Q 32 10 68 22 L 68 34 Q 32 22 -4 34 Z" fill="#e8705f" />
            <path d="M-4 44 Q 32 32 68 44 L 68 54 Q 32 42 -4 54 Z" fill="#5b93d6" />
          </g>
          <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(60,40,30,0.25)" strokeWidth="1.5" />
          <ellipse cx="22" cy="20" rx="7" ry="4" fill="rgba(255,255,255,0.45)" transform="rotate(-30 22 20)" />
        </svg>
      </button>
    );
  }
  const taken = prop.bites?.taken ?? 0;
  const of = prop.bites?.of ?? 4;
  const left = Math.max(0, 1 - taken / Math.max(1, of));
  const glyph = prop.food?.url ? { type: 'image' as const, url: prop.food.url } : prop.food?.emoji ? { type: 'emoji' as const, text: prop.food.emoji } : { type: 'category' as const, category: prop.food?.category ?? 'food' };
  return (
    <div className="room-prop room-prop--dish" data-testid="room-prop" data-kind="dish" data-bites={taken} data-leaving={prop.leaving ? 'true' : undefined} style={{ '--left': left } as CSSProperties}>
      <span className="room-prop__plate" aria-hidden />
      {left > 0 && (
        <span className="room-prop__food" aria-hidden>
          <ItemGlyph glyph={glyph} fill />
        </span>
      )}
    </div>
  );
}
