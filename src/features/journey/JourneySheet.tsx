/**
 * The journey as one screen over the room. At the top, where the player
 * stands: their Blobbonaut level and today's missions (the ecosystem's daily
 * missions, which pay the XP the level is made of; `features/progression`),
 * and, whenever the kit's unlock allows it, the way to another egg. Then the
 * chapters in order: the current one open with its objectives, each saying
 * where it stands (done, started, to do, waiting for another day); done ones
 * folded to a line; locked ones naming what is inside and what opens them.
 * An objective that can be done here has a button that takes the player
 * there; a link goes to the app that does it.
 *
 * Nothing here grants anything: the rewards it names are the kit's own (XP
 * from the daily missions; another Blobbi at level 5).
 */
import { Check, Circle, Clock, Egg, Hourglass, Loader2, Lock, RefreshCw, Smartphone, Sparkles, Star } from 'lucide-react';
import { levelToXp, xpProgress, xpToNextLevel, MAX_LEVEL } from '@blobbi-kit/core';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import type { DailyXp } from '@/features/progression/useDailyXp';
import type { Chapter, Objective, ObjectiveAction, ObjectiveStatus } from './journey';

interface JourneySheetProps {
  open: boolean;
  onClose: () => void;
  chapters: readonly Chapter[];
  onAction: (action: ObjectiveAction) => void;
  /** The player's Blobbonaut XP and level (kind 11125), when known. */
  progress?: { xp: number | undefined; level: number };
  /** Today's missions; absent where the home does not run them. */
  daily?: DailyXp;
  /** The kit's unlock allows another Blobbi now. */
  canAdoptMore?: boolean;
}

const ACTION_LABEL: Record<Exclude<ObjectiveAction['kind'], 'link'>, string> = { room: 'Go there', details: 'Open details', adopt: 'Adopt an egg' };
const STATUS_LABEL: Record<ObjectiveStatus, string> = { done: 'Done', 'in-progress': 'In progress', available: 'To do', waiting: 'Come back later', locked: 'Locked' };

function StatusMark({ status }: { status: ObjectiveStatus }) {
  if (status === 'done') return <Check />;
  if (status === 'waiting') return <Hourglass />;
  if (status === 'locked') return <Lock />;
  return <Circle />;
}

function ObjectiveRow({ o, onAction, live }: { o: Objective; onAction: (a: ObjectiveAction) => void; live: boolean }) {
  return (
    <li className={`journey-objective journey-objective--${o.status} ${o.done ? 'journey-objective--done' : ''}`} data-testid={`objective-${o.id}`} data-done={o.done} data-status={o.status}>
      <span className="journey-objective__mark" aria-hidden>
        <StatusMark status={o.status} />
      </span>
      <span className="journey-objective__text">
        <span className="journey-objective__title">
          {o.title}
          {o.source === 'device' && (
            <span className="journey-objective__device" title="Remembered on this device only" aria-label="remembered on this device only">
              <Smartphone aria-hidden />
            </span>
          )}
          <span className={`journey-status journey-status--${o.status}`} data-testid={`objective-${o.id}-status`}>
            {STATUS_LABEL[o.status]}
          </span>
        </span>
        {o.status === 'waiting' && o.waitingFor ? (
          <span className="journey-objective__hint journey-objective__hint--waiting">
            <Clock aria-hidden /> {o.waitingFor}
          </span>
        ) : (
          !o.done && <span className="journey-objective__hint">{o.hint}</span>
        )}
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

/** The Blobbonaut level, as the kit counts it: XP into the level, and how much is left to the next. */
function LevelCard({ xp, level }: { xp: number | undefined; level: number }) {
  const total = xp ?? 0;
  const max = level >= MAX_LEVEL;
  const into = total - levelToXp(level);
  const span = max ? 1 : levelToXp(level + 1) - levelToXp(level);
  return (
    <section className="journey-level" data-testid="journey-level" aria-label="Blobbonaut level">
      <span className="journey-level__badge" aria-hidden>
        <Star />
        <span>{level}</span>
      </span>
      <span className="journey-level__text">
        <span className="journey-level__title">Blobbonaut level {level}</span>
        <span className="journey-progress" role="progressbar" aria-valuemin={0} aria-valuemax={span} aria-valuenow={max ? span : into} aria-label={max ? 'Highest level' : `${into} of ${span} XP to level ${level + 1}`}>
          <span className="journey-progress__bar" style={{ width: `${Math.round(xpProgress(total) * 100)}%` }} />
          <span className="journey-progress__count">{max ? `${total} XP` : `${total} XP · ${xpToNextLevel(total)} to level ${level + 1}`}</span>
        </span>
      </span>
    </section>
  );
}

/** Today's three, what each pays, and the day's award. */
function TodayMissions({ daily }: { daily: DailyXp }) {
  if (!daily.available) {
    return (
      <section className="journey-today" data-testid="journey-today" data-state="unavailable">
        <h3 className="journey-today__title">Today's missions</h3>
        <p className="journey-today__note">Daily missions begin once your Blobbi has hatched. They earn XP towards your Blobbonaut level.</p>
      </section>
    );
  }
  const award = daily.award;
  return (
    <section className="journey-today" data-testid="journey-today" data-state={daily.loading ? 'loading' : award.kind}>
      <h3 className="journey-today__title">
        Today's missions <span className="journey-today__bonus">+{daily.bonusXp} XP for all three</span>
      </h3>
      {daily.loading ? (
        <p className="journey-today__note">
          <Loader2 className="animate-spin" aria-hidden /> Finding today's missions…
        </p>
      ) : (
        <ul className="journey-missions">
          {daily.missions.map((m) => (
            <li key={m.id} className={`journey-mission ${m.complete ? 'journey-mission--done' : ''}`} data-testid={`daily-${m.id}`} data-complete={m.complete} data-here={m.here}>
              <span className="journey-objective__mark" aria-hidden>
                {m.complete ? <Check /> : <Circle />}
              </span>
              <span className="journey-objective__text">
                <span className="journey-objective__title">
                  {m.title}
                  <span className="journey-mission__xp">+{m.xp} XP</span>
                </span>
                {!m.complete && <span className="journey-objective__hint">{m.here ? m.description : `${m.description}. That one happens in Ditto for now.`}</span>}
                {!m.complete && m.target > 1 && (
                  <span className="journey-progress" role="progressbar" aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.progress} aria-label={`${m.title}: ${m.progress} of ${m.target}`}>
                    <span className="journey-progress__bar" style={{ width: `${Math.round((m.progress / m.target) * 100)}%` }} />
                    <span className="journey-progress__count">
                      {m.progress} / {m.target}
                    </span>
                  </span>
                )}
              </span>
              {!m.complete && !m.here && daily.rerollsLeft > 0 && (
                <button type="button" className="journey-objective__go" onClick={() => daily.swap(m.id)} disabled={daily.swapping} data-testid={`daily-${m.id}-swap`} title={`Swap it for another mission (${daily.rerollsLeft} swap${daily.rerollsLeft === 1 ? '' : 's'} left today)`}>
                  <RefreshCw aria-hidden /> Swap
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="journey-today__note" role="status" data-testid="journey-today-award">
        {award.kind === 'saving' ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Saving today's XP to your account…
          </>
        ) : award.kind === 'paid' ? (
          <>
            <Sparkles aria-hidden /> Well done! +{award.xp} XP today. New missions tomorrow.
          </>
        ) : award.kind === 'already' ? (
          <>
            <Check aria-hidden /> Today's XP is already yours. New missions tomorrow.
          </>
        ) : award.kind === 'failed' ? (
          <>
            Today's XP is not saved yet: {award.message}{' '}
            <button type="button" className="journey-today__retry" onClick={daily.retryAward} data-testid="journey-today-retry">
              Try again
            </button>
          </>
        ) : (
          <>Care in the room counts. New missions every day; a missed day costs nothing.</>
        )}
      </p>
    </section>
  );
}

export function JourneySheet({ open, onClose, chapters, onAction, progress, daily, canAdoptMore = false }: JourneySheetProps) {
  const current = chapters.find((c) => c.status === 'current');
  return (
    <GameOverlay open={open} onClose={onClose} title="Journey" testId="journey-sheet" subtitle={current ? `Chapter ${current.number}: ${current.title}` : 'Every chapter done. What a team!'}>
      {progress && <LevelCard xp={progress.xp} level={progress.level} />}
      {daily && <TodayMissions daily={daily} />}
      {canAdoptMore && (
        <button type="button" className="journey-adopt" onClick={() => onAction({ kind: 'adopt' })} data-testid="journey-adopt">
          <Egg aria-hidden />
          <span>
            <span className="journey-adopt__title">A new egg can join you</span>
            <span className="journey-adopt__sub">Your level allows another Blobbi. Adopt an egg</span>
          </span>
        </button>
      )}
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
                  <span className="journey-chapter__story">{c.status === 'locked' ? `Opens after Chapter ${c.number - 1}. ${c.story}` : c.story}</span>
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
              {c.status === 'locked' && (
                <p className="journey-chapter__inside" data-testid={`chapter-${c.id}-inside`}>
                  Inside: {c.objectives.map((o) => o.title).join(' · ')}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="journey-note">Ticks come from your Blobbi's own record on Nostr, so they follow you to any device. The phone mark means "remembered on this device".</p>
    </GameOverlay>
  );
}
