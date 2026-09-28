import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VISUAL_GENERATION_TAG, getStatStatus, parseModernBlobbiEvent, type BlobbiCompanion, type BlobbiProgressionState, type BlobbiStage, type BlobbiStats, type BlobbonautProfile } from '@blobbi-kit/core';
import { BLOBBI_EMOTIONS, BlobbiRenderer, type BlobbiEmotion } from '@blobbi-kit/renderer';
import type { NostrEvent } from '@nostrify/nostrify';
import { useEnvironment } from '@/environment';
import { useLifecycle } from '@/features/lifecycle';
import type { Facing } from '@/features/home/scene';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { ALL_MISSIONS, FIXTURE_PRESETS, STAT_PRESETS, statsForPreset, type FixtureController } from './fixture-controller';
import { STAT_NAMES, specFromCompanion, type FixtureSpec } from './fixture-world';

const FACINGS: readonly Facing[] = ['front', 'left', 'right', 'back'];
const PROGRESSIONS: readonly BlobbiProgressionState[] = ['none', 'incubating', 'evolving'];
const COLLAPSED_KEY = 'blobbi:dev-panel:collapsed';

/** Remembered on this device; on a phone-width screen the panel starts collapsed so the game stays visible. */
function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    /* no storage */
  }
  return typeof window !== 'undefined' && window.innerWidth < 640;
}

/**
 * The dev panel: rewrite the fixture Blobbi while the app runs, pin its
 * presentation, and run the real lifecycle hooks against the fixture pool.
 * An engineering tool over the game, not part of it: its own stylesheet,
 * its own layer, a dev bundle only. Two vocabularies, kept visibly apart:
 * "Set" buttons rewrite the world (the Blobbi simply *is* that now);
 * "Perform" buttons run the kit's own hooks and show whatever they answer.
 */
export function DevPanel({ controller }: { controller: FixtureController }) {
  const home = useHomeBlobbi();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [, bump] = useState(0);
  const { updateCompanionEvent } = home;

  // A rewrite reaches the app the way a published event does: the collection
  // cache first, then the task queries that read the missions.
  useEffect(
    () =>
      controller.subscribe((change) => {
        if (change.kind === 'blobbi') {
          updateCompanionEvent(change.event);
          void queryClient.invalidateQueries({ queryKey: ['hatch-tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['evolve-tasks'] });
        }
        if (change.kind === 'reset') void queryClient.invalidateQueries();
        bump((n) => n + 1);
      }),
    [controller, updateCompanionEvent, queryClient],
  );

  const toggle = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1');
      } catch {
        /* fine */
      }
      return !c;
    });
  };

  const blobbi = home.current;
  const summary = blobbi ? `${blobbi.name} · ${blobbi.stage}${blobbi.visualGeneration === 'v2' ? ' v2' : ''} · ${blobbi.state}${blobbi.progressionState !== 'none' ? ` · ${blobbi.progressionState}` : ''}` : home.status;

  return (
    <aside className={`dev-panel ${collapsed ? 'dev-panel--collapsed' : ''}`} data-testid="dev-panel" aria-label="Dev panel">
      <div className="dev-panel__head">
        <span className="dev-panel__title" data-testid="dev-summary">
          DEV · {summary}
        </span>
        <button type="button" className="dev-panel__danger" onClick={() => controller.reset()} data-testid="dev-reset" title="Back to the world the URL asked for; clears pins and the kit's session stores">
          Reset fixture
        </button>
        <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Open dev panel' : 'Collapse dev panel'} data-testid="dev-toggle">
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      {!collapsed &&
        (blobbi ? (
          <DevPanelBody key={blobbi.d} controller={controller} blobbi={blobbi} profile={home.profile} pubkey={home.pubkey} updateCompanionEvent={updateCompanionEvent} refresh={home.refresh} />
        ) : (
          <div className="dev-panel__body dev-panel__hint">Fixture loading ({home.status})…</div>
        ))}
    </aside>
  );
}

interface BodyProps {
  controller: FixtureController;
  blobbi: BlobbiCompanion;
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
}

function DevPanelBody({ controller, blobbi, profile, pubkey, updateCompanionEvent, refresh }: BodyProps) {
  const spec = useMemo(() => specFromCompanion(blobbi), [blobbi]);
  const pins = controller.pins();
  const set = (patch: Partial<FixtureSpec>) => controller.setSpec(patch);
  const setStat = (stat: keyof BlobbiStats, value: number) => set({ stats: { ...spec.stats, [stat]: Number.isFinite(value) ? value : spec.stats[stat] } });
  const setStage = (stage: BlobbiStage, generation: 'v1' | 'v2') => controller.applyPreset(stage === 'egg' ? 'fresh-egg' : stage === 'baby' ? 'healthy-baby' : generation === 'v2' ? 'healthy-adult-v2' : 'healthy-adult');
  const env = useEnvironment();
  const [sheet, setSheet] = useState(false);

  // The real thing: the kit's lifecycle over the fixture pool, exactly the
  // hook the home runs. What it accepts or refuses is shown, never faked.
  const lifecycle = useLifecycle({ blobbi, profile, pubkey, updateCompanionEvent, invalidate: refresh });
  const { view, pending, error } = lifecycle;
  const busy = pending !== null;
  const emotionIndex = pins.expression ? BLOBBI_EMOTIONS.indexOf(pins.expression) : -1;
  const cycle = (dir: 1 | -1) => controller.setPins({ expression: BLOBBI_EMOTIONS[(emotionIndex + dir + BLOBBI_EMOTIONS.length) % BLOBBI_EMOTIONS.length] });
  const pinned = pins.expression !== null || pins.facing !== null || pins.reducedMotion !== undefined;
  const published = controller.store.published();

  return (
    <div className="dev-panel__body">
      <details open>
        <summary>Set: stage &amp; state</summary>
        <div className="dev-panel__row">
          <button type="button" aria-pressed={spec.stage === 'egg'} onClick={() => setStage('egg', 'v1')} data-testid="dev-stage-egg">
            Egg
          </button>
          <button type="button" aria-pressed={spec.stage === 'baby'} onClick={() => setStage('baby', 'v1')} data-testid="dev-stage-baby">
            Baby
          </button>
          <button type="button" aria-pressed={spec.stage === 'adult' && spec.visualGeneration === 'v1'} onClick={() => setStage('adult', 'v1')} data-testid="dev-stage-adult">
            Adult V1
          </button>
          <button type="button" aria-pressed={spec.stage === 'adult' && spec.visualGeneration === 'v2'} onClick={() => setStage('adult', 'v2')} data-testid="dev-stage-adult-v2">
            Adult V2
          </button>
        </div>
        <div className="dev-panel__row">
          <span className="dev-panel__label">state</span>
          <button type="button" aria-pressed={spec.state === 'active'} onClick={() => set({ state: 'active' })} data-testid="dev-state-active">
            active
          </button>
          <button type="button" aria-pressed={spec.state === 'sleeping'} disabled={spec.stage === 'egg'} onClick={() => set({ state: 'sleeping' })} data-testid="dev-state-sleeping" title={spec.stage === 'egg' ? 'An egg does not sleep' : undefined}>
            sleeping
          </button>
        </div>
        <div className="dev-panel__row">
          <label htmlFor="dev-preset">preset</label>
          <select
            id="dev-preset"
            className="dev-panel__grow"
            value=""
            onChange={(e) => {
              if (e.target.value) controller.applyPreset(e.target.value);
            }}
            data-testid="dev-preset"
          >
            <option value="">Apply a preset…</option>
            {(['egg', 'baby', 'adult'] as const).map((group) => (
              <optgroup key={group} label={group}>
                {FIXTURE_PRESETS.filter((p) => p.group === group).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </details>

      <details open>
        <summary>Set: stats</summary>
        {STAT_NAMES.map((stat) => {
          const value = spec.stats[stat];
          const status = getStatStatus(blobbi.stage, stat, value);
          return (
            <div className="dev-panel__row" key={stat}>
              <label htmlFor={`dev-stat-${stat}`} className={status === 'critical' ? 'dev-panel__error' : status === 'warning' ? 'dev-panel__warn' : undefined} title={status}>
                {stat}
              </label>
              <input id={`dev-stat-${stat}`} type="range" min={1} max={100} value={value} onChange={(e) => setStat(stat, Number(e.target.value))} data-testid={`dev-stat-${stat}`} />
              <input type="number" min={1} max={100} value={value} onChange={(e) => setStat(stat, Number(e.target.value))} aria-label={`${stat} exact`} data-testid={`dev-stat-${stat}-number`} />
            </div>
          );
        })}
        <div className="dev-panel__row">
          {STAT_PRESETS.map((p) => (
            <button type="button" key={p} onClick={() => set({ stats: statsForPreset(blobbi.stage, p) })} data-testid={`dev-stats-${p}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="dev-panel__row">
          <label htmlFor="dev-streak">streak</label>
          <input id="dev-streak" type="number" min={0} value={spec.careStreak} onChange={(e) => set({ careStreak: Number(e.target.value) })} data-testid="dev-streak" />
          <label htmlFor="dev-xp">xp</label>
          <input id="dev-xp" type="number" min={0} value={spec.experience} onChange={(e) => set({ experience: Number(e.target.value) })} data-testid="dev-xp" />
        </div>
      </details>

      <details open>
        <summary>Lifecycle</summary>
        <div className="dev-panel__row">
          <label htmlFor="dev-progression">set</label>
          <select id="dev-progression" value={spec.progressionState} onChange={(e) => set({ progressionState: e.target.value as BlobbiProgressionState })} data-testid="dev-progression" disabled={spec.stage === 'adult'}>
            {PROGRESSIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => set({ missions: ALL_MISSIONS })} disabled={spec.progressionState === 'none'} data-testid="dev-missions-complete">
            complete missions
          </button>
        </div>
        {spec.progressionState !== 'none' && (
          <div className="dev-panel__row">
            <label htmlFor="dev-mission-interactions">interactions</label>
            <input id="dev-mission-interactions" type="number" min={0} value={spec.missions.interactions} onChange={(e) => set({ missions: { ...spec.missions, interactions: Number(e.target.value) } })} data-testid="dev-mission-interactions" />
            <label htmlFor="dev-mission-themes">themes</label>
            <input id="dev-mission-themes" type="number" min={0} value={spec.missions.themes} onChange={(e) => set({ missions: { ...spec.missions, themes: Number(e.target.value) } })} data-testid="dev-mission-themes" />
            <label htmlFor="dev-mission-colors">colours</label>
            <input id="dev-mission-colors" type="number" min={0} value={spec.missions.colorMoments} onChange={(e) => set({ missions: { ...spec.missions, colorMoments: Number(e.target.value) } })} data-testid="dev-mission-colors" />
            {spec.progressionState === 'evolving' && (
              <label>
                <input type="checkbox" checked={spec.missions.editProfile} onChange={(e) => set({ missions: { ...spec.missions, editProfile: e.target.checked } })} data-testid="dev-mission-profile" /> profile
              </label>
            )}
          </div>
        )}
        <p className="dev-panel__hint">
          kit says: next <b data-testid="dev-lifecycle-next">{view.next}</b>
          {view.stage !== 'adult' && (
            <>
              {' '}
              · <span className={view.ready ? 'dev-panel__ok' : ''} data-testid="dev-lifecycle-ready">{view.ready ? 'ready' : `${view.completed}/${view.total} missions`}</span>
              {view.stage === 'egg' && ` · shell ${view.eggCrack}`}
            </>
          )}
        </p>
        {view.tasks.length > 0 && (
          <ul className="dev-panel__tasks" data-testid="dev-lifecycle-tasks">
            {view.tasks.map((t) => (
              <li key={t.id} className={t.completed ? 'dev-panel__ok' : undefined}>
                <span>{t.name}</span>
                <span>
                  {t.current}/{t.required}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="dev-panel__row">
          <span className="dev-panel__label">perform</span>
          {view.stage === 'egg' && (
            <>
              <button type="button" disabled={busy} onClick={() => void lifecycle.startIncubation()} data-testid="dev-action-start-incubation">
                start incubation
              </button>
              <button type="button" disabled={busy} onClick={() => void lifecycle.stopIncubation()} data-testid="dev-action-stop-incubation">
                stop
              </button>
              <button type="button" disabled={busy} onClick={() => void lifecycle.hatch()} data-testid="dev-action-hatch">
                hatch (kit hook)
              </button>
            </>
          )}
          {view.stage === 'baby' && (
            <>
              <button type="button" disabled={busy} onClick={() => void lifecycle.startEvolution()} data-testid="dev-action-start-evolution">
                start evolution
              </button>
              <button type="button" disabled={busy} onClick={() => void lifecycle.stopEvolution()} data-testid="dev-action-stop-evolution">
                stop
              </button>
              <button type="button" disabled={busy} onClick={() => void lifecycle.evolve()} data-testid="dev-action-evolve">
                evolve (kit hook)
              </button>
            </>
          )}
          {view.stage === 'adult' && <span className="dev-panel__hint">grown: nothing left to perform</span>}
        </div>
        {pending && (
          <p className="dev-panel__hint" data-testid="dev-lifecycle-pending">
            running {pending}…
          </p>
        )}
        {error && (
          <p className="dev-panel__error" role="alert" data-testid="dev-lifecycle-error">
            kit refused: {error.message}{' '}
            <button type="button" onClick={lifecycle.clearError}>
              ok
            </button>
          </p>
        )}
        {view.ready && <p className="dev-panel__hint">The ceremony (the app's own flow, mission-gated): the {view.stage === 'egg' ? 'Hatch!' : 'Evolve!'} button in the dock. The kit-hook button above skips the ceremony and the gate, as the kit itself does.</p>}
      </details>

      <details open>
        <summary>
          Presentation pins{pinned && <span className="dev-panel__pinned"> · overriding</span>}
        </summary>
        <div className="dev-panel__row">
          <label htmlFor="dev-expression">face</label>
          <select id="dev-expression" value={pins.expression ?? ''} onChange={(e) => controller.setPins({ expression: e.target.value ? (e.target.value as BlobbiEmotion) : null })} data-testid="dev-expression">
            <option value="">from condition</option>
            {BLOBBI_EMOTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => cycle(-1)} aria-label="Previous expression" data-testid="dev-expression-prev">
            ‹
          </button>
          <button type="button" onClick={() => cycle(1)} aria-label="Next expression" data-testid="dev-expression-next">
            ›
          </button>
        </div>
        <div className="dev-panel__row">
          <label htmlFor="dev-facing">facing</label>
          <select id="dev-facing" value={pins.facing ?? ''} onChange={(e) => controller.setPins({ facing: e.target.value ? (e.target.value as Facing) : null })} data-testid="dev-facing">
            <option value="">from movement</option>
            {FACINGS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <label htmlFor="dev-motion">motion</label>
          <select id="dev-motion" value={pins.reducedMotion === undefined ? 'auto' : pins.reducedMotion ? 'reduced' : 'full'} onChange={(e) => controller.setPins({ reducedMotion: e.target.value === 'auto' ? undefined : e.target.value === 'reduced' })} data-testid="dev-reduced-motion">
            <option value="auto">system</option>
            <option value="full">full</option>
            <option value="reduced">reduced</option>
          </select>
        </div>
        <div className="dev-panel__row">
          <span className="dev-panel__label">lighting</span>
          {env.appearances.map((id) => (
            <button type="button" key={id} aria-pressed={env.appearance === id} onClick={() => env.setAppearance(id)} data-testid={`dev-appearance-${id}`}>
              {id}
            </button>
          ))}
        </div>
        <div className="dev-panel__row">
          <button type="button" onClick={() => controller.clearPins()} disabled={!pinned} data-testid="dev-clear-pins">
            clear pins (game logic)
          </button>
          <button type="button" aria-pressed={sheet} onClick={() => setSheet((s) => !s)} data-testid="dev-sheet-toggle">
            expression sheet
          </button>
        </div>
        <p className="dev-panel__hint">A pinned face still lets a poke or a care result play over it. Lighting is a device preference, not fixture state.</p>
        {sheet && <ExpressionSheet blobbi={blobbi} />}
      </details>

      <details>
        <summary>World</summary>
        <p className="dev-panel__hint">
          In-memory pool only; nothing reaches a relay. Published into it: <b data-testid="dev-published">{published.length}</b> event{published.length === 1 ? '' : 's'}
          {published.length > 0 && ` (last kind ${published[published.length - 1].kind})`}.
        </p>
        <p className="dev-panel__hint">
          seed <code data-testid="dev-seed">{blobbi.seed}</code> (colours and the adult form derive from it; a rewrite never changes it)
        </p>
        <p className="dev-panel__hint">
          state content: <code data-testid="dev-content">{blobbi.event.content || '(empty)'}</code>
        </p>
      </details>
    </div>
  );
}

/**
 * Every face on every drawing that has one, side by side: the fixture's
 * own event with only the stage and the generation swapped, so the seed
 * (colours, adult form) is the one on screen.
 */
function ExpressionSheet({ blobbi }: { blobbi: BlobbiCompanion }) {
  const rows = useMemo(() => {
    const make = (stage: 'baby' | 'adult', generation: 'v1' | 'v2') => {
      const tags = blobbi.event.tags.filter((t) => t[0] !== 'stage' && t[0] !== VISUAL_GENERATION_TAG && t[0] !== 'state');
      tags.push(['stage', stage], ['state', 'active']);
      if (generation === 'v2') tags.push([VISUAL_GENERATION_TAG, 'v2']);
      const parsed = parseModernBlobbiEvent({ ...blobbi.event, tags });
      return parsed ? { label: `${stage} ${generation}`, visual: toBlobbiVisual(parsed) } : null;
    };
    return [make('baby', 'v1'), make('adult', 'v1'), make('adult', 'v2')].filter((r): r is NonNullable<typeof r> => r !== null);
  }, [blobbi.event]);
  return (
    <div className="dev-panel__sheet" data-testid="dev-expression-sheet">
      <span />
      {BLOBBI_EMOTIONS.map((e) => (
        <span key={e} className="dev-panel__sheet-head">
          {e}
        </span>
      ))}
      {rows.map((row) => (
        <ExpressionRow key={row.label} label={row.label} visual={row.visual} />
      ))}
    </div>
  );
}

function ExpressionRow({ label, visual }: { label: string; visual: ReturnType<typeof toBlobbiVisual> }) {
  return (
    <>
      <span className="dev-panel__sheet-head">{label}</span>
      {BLOBBI_EMOTIONS.map((e) => (
        <span key={e} className="dev-panel__sheet-cell">
          <BlobbiRenderer visual={visual} instanceId={`sheet-${label}-${e}`} size="100%" expression={e} transparent style={{ width: '100%', height: '100%' }} />
        </span>
      ))}
    </>
  );
}
