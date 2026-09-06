import type { BlobbiStats } from '@blobbi-kit/core';
import type { CareResult } from '@/features/care';
import { STAT_WORD, describeCareResult } from './care-feedback-text';

interface CareFeedbackProps {
  result: CareResult | undefined;
  error: Error | null;
  /** Changes with each result so the chips replay. */
  resultKey: number;
}

/**
 * Feedback for a care action: floating stat chips by the Blobbi and a polite
 * live region; errors get an alert. Presentational: it only reports what the
 * canonical write actually changed.
 */
export function CareFeedback({ result, error, resultKey }: CareFeedbackProps) {
  const changes = result ? Object.entries(result.statsChanged) : [];
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center gap-2" aria-hidden>
        {result &&
          changes.map(([stat, delta], index) => (
            <span
              key={`${resultKey}-${stat}`}
              className="animate-float-up rounded-full bg-card/90 px-2.5 py-1 text-sm font-bold shadow"
              style={{ animationDelay: `${index * 120}ms`, color: delta > 0 ? '#16a34a' : '#dc2626' }}
            >
              {delta > 0 ? '+' : ''}
              {delta} {STAT_WORD[stat as keyof BlobbiStats]}
            </span>
          ))}
        {result && result.xpGained > 0 && (
          <span key={`${resultKey}-xp`} className="animate-float-up rounded-full bg-primary/90 px-2.5 py-1 text-sm font-bold text-primary-foreground shadow" style={{ animationDelay: `${changes.length * 120}ms` }}>
            +{result.xpGained} XP
          </span>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only" data-testid="care-status">
        {result ? describeCareResult(result) : ''}
      </p>
      {error && (
        <p role="alert" className="mx-auto max-w-sm rounded-xl border border-destructive/40 bg-card/90 px-3 py-2 text-center text-sm text-destructive" data-testid="care-error">
          {error.message}
        </p>
      )}
    </>
  );
}
