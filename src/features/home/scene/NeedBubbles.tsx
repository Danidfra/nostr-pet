import { Droplets, Heart, Smile, Utensils, Zap, type LucideIcon } from 'lucide-react';
import type { BlobbiStats } from '@blobbi-kit/core';
import type { StatItem } from '../BlobbiStatusPanel';
import { t } from '@/i18n';
import { needWord } from '../labels';

const ICON: Record<keyof BlobbiStats, LucideIcon> = { hunger: Utensils, happiness: Smile, hygiene: Droplets, energy: Zap, health: Heart };

interface NeedBubblesProps {
  items: readonly StatItem[];
  /** How many to show at once; the worst come first. */
  max?: number;
}

/**
 * Needs, said by the Blobbi rather than by a panel: small thought bubbles
 * above its head for anything the kit flags as warning or critical, worst
 * first, at most two. The full rings live in the Blobbi sheet; this is the
 * glance.
 */
export function NeedBubbles({ items, max = 2 }: NeedBubblesProps) {
  const needs = items
    .filter((i) => i.status !== 'normal')
    .sort((a, b) => Number(b.status === 'critical') - Number(a.status === 'critical') || a.value - b.value)
    .slice(0, max);
  if (needs.length === 0) return null;
  return (
    <div className="need-bubbles" role="list" aria-label={t('home.stats.needs')} data-testid="need-bubbles">
      {needs.map(({ stat, status }) => {
        const Icon = ICON[stat];
        return (
          <span key={stat} role="listitem" className={status === 'critical' ? 'need-bubble need-bubble--critical' : 'need-bubble'} aria-label={status === 'critical' ? t('home.stats.needUrgent', { need: needWord(stat) }) : needWord(stat)} data-testid={`need-${stat}`} data-status={status}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        );
      })}
    </div>
  );
}
