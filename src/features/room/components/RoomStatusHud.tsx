/**
 * The Blobbi's stats in the room's HUD: Ditto's `BlobbiRoomStatusHud` and
 * `SegmentedRing` (`ditto/src/blobbi/rooms/components/BlobbiRoomStatusHud.tsx`,
 * `ditto/src/blobbi/ui/StatIndicator.tsx`): a gently arced row of segmented
 * rings, a stat's icon in each, the low ones glowing with a warning mark.
 * The segments and care states are the kit's (`getBlobbiStatDisplayState`),
 * the same numbers Ditto draws.
 *
 * A tap takes the player to the room that restores that stat (Ditto's stat
 * guide, its first step): navigation only, never a write.
 */
import { useMemo } from 'react';
import { AlertTriangle, Droplets, Gamepad2, Heart, Utensils, Zap, type LucideIcon } from 'lucide-react';
import { getBlobbiStatDisplayState, getVisibleStats, type BlobbiCompanion, type BlobbiStats, type CareState } from '@blobbi-kit/core';

import { roomById, type RoomId } from '@/features/home/rooms/rooms';
import { cx } from '../lib/cx';

type StatKey = keyof BlobbiStats;

const STAT_STYLE: Record<StatKey, { text: string; bg: string; hex: string; icon: LucideIcon; label: string }> = {
  hunger: { text: 'text-orange-500', bg: 'bg-orange-500/10', hex: '#f97316', icon: Utensils, label: 'Hunger' },
  happiness: { text: 'text-yellow-500', bg: 'bg-yellow-500/10', hex: '#eab308', icon: Gamepad2, label: 'Happiness' },
  health: { text: 'text-green-500', bg: 'bg-green-500/10', hex: '#22c55e', icon: Heart, label: 'Health' },
  hygiene: { text: 'text-blue-500', bg: 'bg-blue-500/10', hex: '#3b82f6', icon: Droplets, label: 'Hygiene' },
  energy: { text: 'text-violet-500', bg: 'bg-violet-500/10', hex: '#8b5cf6', icon: Zap, label: 'Energy' },
};

/** The room that restores each stat (Ditto's `STAT_ROOM_MAP`). */
const STAT_ROOM: Record<StatKey, RoomId> = { health: 'care', hygiene: 'care', hunger: 'kitchen', happiness: 'home', energy: 'rest' };

/** Ditto's downward arc: the middle icon lowest, the edges highest, at most 10 px. */
function arcOffset(index: number, count: number): number {
  if (count <= 1) return 0;
  const center = (count - 1) / 2;
  const normalized = 1 - Math.abs(index - center) / Math.max(center, count - 1 - center);
  return Math.round(normalized * 10);
}

interface RoomStatusHudProps {
  stage: BlobbiCompanion['stage'];
  stats: BlobbiStats | undefined;
  /** Go to the room that restores a stat. */
  onGuide?: (room: RoomId) => void;
}

export function RoomStatusHud({ stage, stats, onGuide }: RoomStatusHudProps) {
  const shown = useMemo(
    () =>
      stats
        ? getVisibleStats(stage).map((stat) => {
            const key = stat as StatKey;
            const value = stats[key] ?? 100;
            const display = getBlobbiStatDisplayState({ stage, stat: key, value });
            return { stat: key, value, careState: display.careState, filled: display.filled, max: display.max };
          })
        : [],
    [stage, stats],
  );
  if (shown.length === 0) return null;

  return (
    <div className="flex items-start justify-center gap-[0.6em]" role="group" aria-label="Your Blobbi's needs" data-testid="room-status-hud">
      {shown.map((s, i) => {
        const room = STAT_ROOM[s.stat];
        const style = STAT_STYLE[s.stat];
        const percent = Math.round(s.value);
        return (
          <div key={s.stat} style={{ transform: `translateY(${arcOffset(i, shown.length) / 16}em)` }}>
            <button
              type="button"
              className={cx('rounded-full transition-transform duration-200 active:scale-90 motion-reduce:active:scale-100', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', onGuide && 'cursor-pointer')}
              aria-label={onGuide ? `${style.label} ${percent}%, go to the ${roomById(room).label}` : `${style.label} ${percent}%`}
              title={style.label}
              onClick={onGuide ? () => onGuide(room) : undefined}
              data-testid={`room-stat-${s.stat}`}
              data-care={s.careState}
            >
              <StatRing stat={s.stat} careState={s.careState} filled={s.filled} max={s.max} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StatRing({ stat, careState, filled, max }: { stat: StatKey; careState: CareState; filled: number; max: number }) {
  const style = STAT_STYLE[stat];
  const low = careState === 'attention' || careState === 'urgent';
  const Icon = style.icon;
  return (
    <div
      className={cx(
        'relative size-[2.75em] rounded-full flex items-center justify-center',
        'bg-background/50 backdrop-blur-[2px] border border-border/20 shadow-sm',
        style.bg,
        low && style.text,
        careState === 'attention' && 'stat-glow-attention',
        careState === 'urgent' && 'stat-glow-urgent',
      )}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <SegmentedRing filled={filled} max={max} fillHex={style.hex} strokeWidth={2.5} gapDeg={16} />
      </svg>
      <div className="relative">
        <Icon className={cx('size-[1.15em]', style.text)} strokeWidth={2.5} />
        {low && <AlertTriangle className={cx('absolute -top-[0.3em] -right-[0.4em] size-[0.65em]', careState === 'urgent' ? 'text-red-500' : 'text-amber-500')} strokeWidth={3} />}
      </div>
    </div>
  );
}

const R = 15;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** A ring of `max` arcs, the first `filled` coloured, the rest a faint track; butt caps keep the gaps exact. Ditto's. */
function SegmentedRing({ filled, max, fillHex, strokeWidth, gapDeg }: { filled: number; max: number; fillHex: string; strokeWidth: number; gapDeg: number }) {
  const segDeg = (360 - gapDeg * max) / max;
  const segLen = (segDeg / 360) * CIRCUMFERENCE;
  const segments = [];
  let offsetDeg = gapDeg / 2;
  for (let i = 0; i < max; i++) {
    const on = i < filled;
    segments.push(
      <circle
        key={i}
        cx={18}
        cy={18}
        r={R}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        stroke={on ? fillHex : 'currentColor'}
        opacity={on ? 1 : 0.12}
        strokeDasharray={`${segLen} ${CIRCUMFERENCE - segLen}`}
        strokeDashoffset={-(offsetDeg / 360) * CIRCUMFERENCE}
        className="transition-all duration-500"
      />,
    );
    offsetDeg += segDeg + gapDeg;
  }
  return <>{segments}</>;
}
