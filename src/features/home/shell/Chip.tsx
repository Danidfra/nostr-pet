import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-foreground/10 text-foreground',
  sleep: 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200',
  cold: 'bg-sky-500/20 text-sky-900 dark:text-sky-200',
  grow: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
} as const;

/** A small rounded label in the Blobbi's details (its stage, asleep, hibernating, growing up), in both homes. */
export function Chip({ children, testId, tone = 'neutral' }: { children: ReactNode; testId?: string; tone?: keyof typeof TONES }) {
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
