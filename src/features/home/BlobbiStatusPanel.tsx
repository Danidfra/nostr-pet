import type { BlobbiStats } from '@blobbi-kit/core';

export type StatStatus = 'critical' | 'warning' | 'normal';

export interface StatItem {
  stat: keyof BlobbiStats;
  value: number;
  status: StatStatus;
}

const STAT_META: Record<keyof BlobbiStats, { label: string; color: string; icon: string }> = {
  hunger: { label: 'Hunger', color: '#F97316', icon: '🍴' },
  happiness: { label: 'Happy', color: '#EAB308', icon: '😊' },
  hygiene: { label: 'Hygiene', color: '#06B6D4', icon: '💧' },
  energy: { label: 'Energy', color: '#8B5CF6', icon: '⚡' },
  health: { label: 'Health', color: '#10B981', icon: '❤️' },
};

const STATUS_COLOR: Record<Exclude<StatStatus, 'normal'>, string> = {
  warning: '#F59E0B',
  critical: '#EF4444',
};

function StatRing({ stat, value, status }: StatItem) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const meta = STAT_META[stat];
  const strokeColor = status === 'normal' ? meta.color : STATUS_COLOR[status];

  return (
    <div className="flex flex-col items-center gap-0.5" data-testid={`stat-${stat}`} data-status={status}>
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={radius} stroke="currentColor" strokeWidth="4" fill="none" className="text-muted" />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={strokeColor}
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm" aria-hidden>
          {meta.icon}
        </span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">
        {meta.label} <span className="sr-only">{Math.round(clamped)} percent</span>
      </span>
      <span className="text-xs font-semibold" style={{ color: strokeColor }} aria-hidden>
        {Math.round(clamped)}
      </span>
    </div>
  );
}

interface BlobbiStatusPanelProps {
  items: readonly StatItem[];
}

/**
 * Care rings. Presentational only: values and their warning/critical status
 * arrive already computed by the shared kit (projected decay), so no care
 * formula lives here. Adapted from the pre-nuke CircularStatusIndicators.
 */
export function BlobbiStatusPanel({ items }: BlobbiStatusPanelProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-4" role="group" aria-label="Care status">
      {items.map((item) => (
        <StatRing key={item.stat} {...item} />
      ))}
    </div>
  );
}
