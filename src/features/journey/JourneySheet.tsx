/**
 * The journey as one screen over the room: the chapters in order, the
 * current one open with its objectives, done ones folded to a line, locked
 * ones named with what opens them. An objective that can be done here has a
 * button that takes the player there; a link goes to the app that does it.
 */
import { Check, Circle, Lock, Smartphone } from 'lucide-react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import type { Chapter, Objective, ObjectiveAction } from './journey';

interface JourneySheetProps {
  open: boolean;
  onClose: () => void;
  chapters: readonly Chapter[];
  onAction: (action: ObjectiveAction) => void;
}

const ACTION_LABEL: Record<Exclude<ObjectiveAction['kind'], 'link'>, string> = { room: 'Go there', details: 'Open details', adopt: 'Adopt an egg' };

function ObjectiveRow({ o, onAction, live }: { o: Objective; onAction: (a: ObjectiveAction) => void; live: boolean }) {
  return (
    <li className={`journey-objective ${o.done ? 'journey-objective--done' : ''}`} data-testid={`objective-${o.id}`} data-done={o.done}>
      <span className="journey-objective__mark" aria-hidden>
        {o.done ? <Check /> : <Circle />}
      </span>
      <span className="journey-objective__text">
        <span className="journey-objective__title">
          {o.title}
          {o.source === 'device' && (
            <span className="journey-objective__device" title="Remembered on this device only" aria-label="remembered on this device only">
              <Smartphone aria-hidden />
            </span>
          )}
        </span>
        {!o.done && <span className="journey-objective__hint">{o.hint}</span>}
        {o.progress && !o.done && (
          <span className="journey-progress" role="progressbar" aria-valuemin={0} aria-valuemax={o.progress.required} aria-valuenow={o.progress.current} aria-label={`${o.title}: ${o.progress.current} of ${o.progress.required}`}>
            <span className="journey-progress__bar" style={{ width: `${Math.round((o.progress.current / Math.max(1, o.progress.required)) * 100)}%` }} />
            <span className="journey-progress__count">
              {o.progress.current} / {o.progress.required}
            </span>
          </span>
        )}
      </span>
      {live && !o.done && o.action && (
        o.action.kind === 'link' ? (
          <a className="journey-objective__go" href={o.action.href} target="_blank" rel="noopener noreferrer" data-testid={`objective-${o.id}-go`}>
            {o.action.label}
          </a>
        ) : (
          <button type="button" className="journey-objective__go" onClick={() => onAction(o.action!)} data-testid={`objective-${o.id}-go`}>
            {ACTION_LABEL[o.action.kind]}
          </button>
        )
      )}
    </li>
  );
}

export function JourneySheet({ open, onClose, chapters, onAction }: JourneySheetProps) {
  const current = chapters.find((c) => c.status === 'current');
  return (
    <GameOverlay open={open} onClose={onClose} title="Journey" testId="journey-sheet" subtitle={current ? `Chapter ${current.number}: ${current.title}` : 'Every chapter done. What a team!'}>
      <ol className="journey-chapters">
        {chapters.map((c) => {
          const done = c.objectives.filter((o) => o.done).length;
          return (
            <li key={c.id} className={`journey-chapter journey-chapter--${c.status}`} data-testid={`chapter-${c.id}`} data-status={c.status}>
              <div className="journey-chapter__head">
                <span className="journey-chapter__number" aria-hidden>
                  {c.status === 'done' ? <Check /> : c.status === 'locked' ? <Lock /> : c.number}
                </span>
                <span className="journey-chapter__titles">
                  <span className="journey-chapter__title">
                    Chapter {c.number}: {c.title}
                  </span>
                  <span className="journey-chapter__story">{c.status === 'locked' ? 'Opens after the chapter before it.' : c.story}</span>
                </span>
                {c.status !== 'locked' && (
                  <span className="journey-chapter__count">
                    {done}/{c.objectives.length}
                  </span>
                )}
              </div>
              {c.status === 'current' && (
                <>
                  <ul className="journey-objectives">
                    {c.objectives.map((o) => (
                      <ObjectiveRow key={o.id} o={o} onAction={onAction} live />
                    ))}
                  </ul>
                  <p className="journey-chapter__opens">Finishing it opens {c.opens}.</p>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <p className="journey-note">Ticks come from your Blobbi's own record on Nostr, so they follow you to any device. The phone mark means "remembered on this device".</p>
    </GameOverlay>
  );
}
