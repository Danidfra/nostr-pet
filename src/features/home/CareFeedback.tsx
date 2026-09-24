import type { BlobbiStats } from '@blobbi-kit/core';
import { STAT_WORD, describeCareResult, type FeedbackResult } from './care-feedback-text';

interface CareFeedbackProps {
  result: FeedbackResult | undefined;
  /** Changes with each result so the chips replay. */
  resultKey: number;
}

/**
 * Feedback for a care action: floating stat chips above the Blobbi and a
 * polite live region. Presentational: it only reports what the canonical
 * write actually changed. Rendered inside the actor so it floats wherever
 * the Blobbi stands.
 */
export function CareFeedback({ result, resultKey }: CareFeedbackProps) {
  const changes = result ? Object.entries(result.statsChanged) : [];
  const hearts = result && result.action !== 'rest' ? [0, 1, 2] : [];
  return (
    <>
      {hearts.length > 0 && (
        <div className="scene-hearts" aria-hidden data-testid="care-hearts">
          {hearts.map((i) => (
            <span key={`${resultKey}-${i}`} className="scene-heart" style={{ left: `${20 + i * 30}%`, animationDelay: `${i * 140}ms`, color: '#ec4899' }}>
              ♥
            </span>
          ))}
        </div>
      )}
      <div className="scene-feedback" aria-hidden>
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
    </>
  );
}

/** A failed care write, shown over the scene rather than on the Blobbi. */
export function CareError({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mx-auto max-w-sm rounded-xl border border-destructive/40 bg-card/90 px-3 py-2 text-center text-sm text-destructive" data-testid="care-error">
      {error.message}
    </p>
  );
}
