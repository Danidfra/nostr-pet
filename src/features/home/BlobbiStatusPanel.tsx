import type { BlobbiStats } from '@blobbi-kit/core';
import { Droplets, Heart, Smile, Utensils, Zap, type LucideIcon } from 'lucide-react';

export type StatStatus = 'critical' | 'warning' | 'normal';

export interface StatItem {
  stat: keyof BlobbiStats;
  value: number;
  status: StatStatus;
}

const STAT_META: Record<keyof BlobbiStats, { label: string; color: string; icon: LucideIcon }> = {
  hunger: { label: 'Food', color: '#F97316', icon: Utensils },
  happiness: { label: 'Joy', color: '#EAB308', icon: Smile },
  hygiene: { label: 'Clean', color: '#06B6D4', icon: Droplets },
  energy: { label: 'Energy', color: '#8B5CF6', icon: Zap },
  health: { label: 'Health', color: '#10B981', icon: Heart },
};

const STATUS_COLOR: Record<Exclude<StatStatus, 'normal'>, string> = {
  warning: '#F59E0B',
  critical: '#EF4444',
};

const STATUS_WORD: Record<StatStatus, string> = {
  normal: 'fine',
  warning: 'low',
  critical: 'very low',
};

function StatRing({ stat, value, status }: StatItem) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const meta = STAT_META[stat];
  const Icon = meta.icon;
  const strokeColor = status === 'normal' ? meta.color : STATUS_COLOR[status];
  const rounded = Math.round(clamped);

  return (
    <div
      className="flex flex-col items-center gap-1"
      data-testid={`stat-${stat}`}
      data-status={status}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-label={`${meta.label}: ${rounded} of 100, ${STATUS_WORD[status]}`}
      title={`${meta.label} ${rounded}`}
    >
      <div className="relative h-12 w-12 sm:h-16 sm:w-16">
        <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="30" cy="30" r={radius} stroke="currentColor" strokeWidth="5" fill="none" className="text-foreground/10" />
          <circle
            cx="30"
            cy="30"
            r={radius}
            stroke={strokeColor}
            strokeWidth="5"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset,stroke] duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Icon className="h-4 w-4 sm:h-6 sm:w-6" style={{ color: strokeColor }} />
        </span>
        {status !== 'normal' && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 rounded-full px-1 text-[9px] font-bold uppercase leading-4 text-white"
            style={{ background: strokeColor }}
          >
            {status === 'critical' ? '!!' : '!'}
          </span>
        )}
      </div>
      <span className="text-[11px] font-semibold leading-none text-foreground/80" aria-hidden>
        {meta.label}
      </span>
      <span className="text-xs font-bold leading-none" style={{ color: strokeColor }} aria-hidden>
        {rounded}
      </span>
    </div>
  );
}

interface BlobbiStatusPanelProps {
  items: readonly StatItem[];
}

/**
 * Care rings: one per stat the stage shows. Presentational only: values and
 * their warning/critical status arrive computed by the shared kit (projected
 * decay, kit thresholds); the panel adds colour, an icon and a badge so no
 * state is carried by colour alone.
 */
export function BlobbiStatusPanel({ items }: BlobbiStatusPanelProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-5" role="group" aria-label="Care status">
      {items.map((item) => (
        <StatRing key={item.stat} {...item} />
      ))}
    </div>
  );
}
