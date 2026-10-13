/**
 * Ditto's `RoomActionButton` (`ditto/src/blobbi/rooms/components/RoomActionButton.tsx`),
 * verbatim but for `cn` → `cx`: the round action button of a room's bottom
 * bar, sized in em so it grows with the room, a soft glow of its colour on
 * hover, its label under it.
 */
import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cx } from '../lib/cx';
import { ROOM_ACTION_SLOT, ROOM_GUIDE_HIGHLIGHT } from '../lib/room-ui';

interface RoomActionButtonProps {
  icon: ReactNode;
  label: string;
  /** The icon's colour, a text-* class. */
  color: string;
  glowHex: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Pulses with the guide ring. */
  glow?: boolean;
  className?: string;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  testId?: string;
  /** What the button is for a reader, when the label under it is not the whole story (why it is off). */
  ariaLabel?: string;
}

export function RoomActionButton({ icon, label, color, glowHex, onClick, disabled, loading, glow, className, onPointerDown, testId, ariaLabel }: RoomActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerDown={onPointerDown}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid={testId}
      className={cx(
        'flex flex-col items-center gap-[0.3em] transition-all duration-300 ease-out rounded-2xl',
        ROOM_ACTION_SLOT,
        'active:scale-95 motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      <div
        className={cx(
          'size-[3.6em] rounded-full flex items-center justify-center',
          'bg-background/70 backdrop-blur-sm border border-border/30 shadow-sm transition-shadow duration-200',
          'hover:shadow-[0_0_12px_var(--glow)]',
          color,
          glow && ROOM_GUIDE_HIGHLIGHT,
        )}
        style={{
          '--glow': `color-mix(in srgb, ${glowHex} 50%, transparent)`,
          backgroundImage: `radial-gradient(circle at 40% 35%, color-mix(in srgb, ${glowHex} 14%, transparent), color-mix(in srgb, ${glowHex} 4%, transparent) 70%)`,
        } as CSSProperties}
      >
        {loading ? <Loader2 className="size-[1.5em] animate-spin" /> : <span className="[&>svg]:size-[1.5em]">{icon}</span>}
      </div>
      <span className="text-[0.8em] font-medium text-foreground/80 whitespace-nowrap">{label}</span>
    </button>
  );
}
