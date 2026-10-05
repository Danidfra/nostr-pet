import { useState } from 'react';
import { getStatStatus, type BlobbiCompanion, type BlobbiProgressionState, type BlobbiStage, type BlobbiStats } from '@blobbi-kit/core';
import { BLOBBI_EMOTIONS, type BlobbiEmotion } from '@blobbi-kit/renderer';
import { useEnvironment } from '@/environment';
import type { Lifecycle } from '@/features/lifecycle';
import type { Facing } from '@/features/home/scene';
import { ALL_MISSIONS, FIXTURE_PRESETS, STAT_PRESETS, statsForPreset, type FixtureController } from './fixture-controller';
import { STAT_NAMES, type FixtureSpec } from './fixture-world';
import { FACINGS, PROGRESSIONS } from './dev-home';

/**
 * The dev controls, as sections a surface composes: the floating panel over
 * the game (`DevPanel`) and the Dev Lab page (`DevLab`) show the same
 * controls in different frames. Every section talks to the one fixture
 * controller; "Set" rewrites the in-memory world, "Perform" runs the kit's
 * real hooks against it. Dev bundle only.
 */

export function StageStateSection({ controller, spec }: { controller: FixtureController; spec: FixtureSpec }) {
  const set = (patch: Partial<FixtureSpec>) => controller.setSpec(patch);
  const setStage = (stage: BlobbiStage, generation: FixtureSpec['visualGeneration']) =>
    controller.setSpec((s) => {
      const preset = FIXTURE_PRESETS.find((p) => p.id === (stage === 'egg' ? 'fresh-egg' : stage === 'baby' ? 'healthy-baby' : 'healthy-adult'))!;
      return { ...preset.apply(s), visualGeneration: generation };
    });
  const is = (stage: BlobbiStage, generation: FixtureSpec['visualGeneration']) => spec.stage === stage && spec.visualGeneration === generation;
  return (
    <>
      <div className="dev-panel__row" data-testid="dev-quick-fixtures">
        {(['egg', 'baby', 'adult'] as const).map((stage) =>
          (['v1', 'v2', 'v3'] as const).map((generation) => (
            <button type="button" key={`${stage}-${generation}`} aria-pressed={is(stage, generation)} onClick={() => setStage(stage, generation)} data-testid={`dev-stage-${stage}-${generation}`} title={stage !== 'adult' && generation === 'v2' ? `A V2 ${stage} is valid identity; the renderer draws the V1 ${stage} artwork until a V2 one exists` : undefined}>
              {generation.toUpperCase()} {stage}
            </button>
          )),
        )}
      </div>
      <div className="dev-panel__row">
        <span className="dev-panel__label">generation</span>
        <button type="button" aria-pressed={spec.visualGeneration === 'v1'} onClick={() => set({ visualGeneration: 'v1' })} data-testid="dev-generation-v1">
          V1
        </button>
        <button type="button" aria-pressed={spec.visualGeneration === 'v2'} onClick={() => set({ visualGeneration: 'v2' })} data-testid="dev-generation-v2">
          V2
        </button>
        <button type="button" aria-pressed={spec.visualGeneration === 'v3'} onClick={() => set({ visualGeneration: 'v3' })} data-testid="dev-generation-v3" title="Procedural: the fixture's seed as an individual, its identity written at birth by the kit's creation rule">
          V3
        </button>
        <span className="dev-panel__hint">identity from birth; a transition never changes it</span>
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
    </>
  );
}

export function StatsSection({ controller, spec, blobbi }: { controller: FixtureController; spec: FixtureSpec; blobbi: BlobbiCompanion }) {
  const set = (patch: Partial<FixtureSpec>) => controller.setSpec(patch);
  const setStat = (stat: keyof BlobbiStats, value: number) => set({ stats: { ...spec.stats, [stat]: Number.isFinite(value) ? value : spec.stats[stat] } });
  return (
    <>
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
    </>
  );
}

export function LifecycleSection({ controller, spec, lifecycle, pipeline = false }: { controller: FixtureController; spec: FixtureSpec; lifecycle: Lifecycle; pipeline?: boolean }) {
  const set = (patch: Partial<FixtureSpec>) => controller.setSpec(patch);
  const { view, pending, error } = lifecycle;
  const busy = pending !== null;
  const steps: Array<{ id: string; label: string; on: boolean }> = [
    { id: 'fresh-egg', label: 'Egg', on: spec.stage === 'egg' && spec.progressionState === 'none' },
    { id: 'incubating-egg', label: 'incubating', on: spec.stage === 'egg' && spec.progressionState === 'incubating' && !view.ready && view.completed === 0 },
    { id: 'cracking-egg', label: 'cracking', on: spec.stage === 'egg' && spec.progressionState === 'incubating' && !view.ready && view.completed > 0 },
    { id: 'hatch-ready', label: 'hatch ready', on: spec.stage === 'egg' && view.ready },
    { id: 'healthy-baby', label: 'Baby', on: spec.stage === 'baby' && spec.progressionState === 'none' },
    { id: 'evolving-baby', label: 'evolving', on: spec.stage === 'baby' && spec.progressionState === 'evolving' && !view.ready },
    { id: 'evolution-ready', label: 'evolution ready', on: spec.stage === 'baby' && view.ready },
    { id: 'healthy-adult', label: 'Adult', on: spec.stage === 'adult' },
  ];
  return (
    <>
      {pipeline && (
        <ol className="dev-pipeline" data-testid="dev-pipeline">
          {steps.map((step) => (
            <li key={step.id}>
              <button type="button" className={step.on ? 'is-on' : ''} aria-current={step.on ? 'step' : undefined} onClick={() => controller.setSpec((s) => ({ ...FIXTURE_PRESETS.find((p) => p.id === step.id)!.apply(s), visualGeneration: s.visualGeneration }))} data-testid={`dev-step-${step.id}`} title={`Set: ${step.label}`}>
                {step.label}
              </button>
            </li>
          ))}
        </ol>
      )}
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
    </>
  );
}

export function PinsSection({ controller }: { controller: FixtureController }) {
  const pins = controller.pins();
  const env = useEnvironment();
  const emotionIndex = pins.expression ? BLOBBI_EMOTIONS.indexOf(pins.expression) : -1;
  const cycle = (dir: 1 | -1) => controller.setPins({ expression: BLOBBI_EMOTIONS[(emotionIndex + dir + BLOBBI_EMOTIONS.length) % BLOBBI_EMOTIONS.length] });
  const pinned = pins.expression !== null || pins.facing !== null || pins.gaze !== null || pins.motion !== null || pins.reducedMotion !== undefined;
  return (
    <>
      {pinned && (
        <p className="dev-panel__pinned" data-testid="dev-pins-active">
          overriding the game's presentation (the fixture's data is untouched)
        </p>
      )}
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
        <label htmlFor="dev-motion-pin">motion</label>
        <select id="dev-motion-pin" value={pins.motion ?? ''} onChange={(e) => controller.setPins({ motion: e.target.value ? (e.target.value as 'idle' | 'walking') : null })} data-testid="dev-motion-pin">
          <option value="">from movement</option>
          <option value="idle">idle</option>
          <option value="walking">walking (in place)</option>
        </select>
      </div>
      <div className="dev-panel__row">
        <label htmlFor="dev-gaze-x">gaze</label>
        <input id="dev-gaze-x" type="range" min={-1} max={1} step={0.1} value={pins.gaze?.x ?? 0} onChange={(e) => controller.setPins({ gaze: { x: Number(e.target.value), y: pins.gaze?.y ?? 0 } })} aria-label="gaze x" data-testid="dev-gaze-x" />
        <input id="dev-gaze-y" type="range" min={-1} max={1} step={0.1} value={pins.gaze?.y ?? 0} onChange={(e) => controller.setPins({ gaze: { x: pins.gaze?.x ?? 0, y: Number(e.target.value) } })} aria-label="gaze y" data-testid="dev-gaze-y" />
        <button type="button" disabled={pins.gaze === null} onClick={() => controller.setPins({ gaze: null })} data-testid="dev-gaze-clear">
          free
        </button>
      </div>
      <div className="dev-panel__row">
        <label htmlFor="dev-reduced-motion">reduced</label>
        <select id="dev-reduced-motion" value={pins.reducedMotion === undefined ? 'auto' : pins.reducedMotion ? 'reduced' : 'full'} onChange={(e) => controller.setPins({ reducedMotion: e.target.value === 'auto' ? undefined : e.target.value === 'reduced' })} data-testid="dev-reduced-motion">
          <option value="auto">system</option>
          <option value="full">full motion</option>
          <option value="reduced">reduced motion</option>
        </select>
        <span className="dev-panel__label">lighting</span>
        {env.appearances.map((id) => (
          <button type="button" key={id} aria-pressed={env.appearance === id} onClick={() => env.setAppearance(id)} data-testid={`dev-appearance-${id}`}>
            {id}
          </button>
        ))}
      </div>
      <div className="dev-panel__row">
        <button type="button" onClick={() => controller.clearPins()} disabled={!pinned} data-testid="dev-clear-pins">
          clear presentation overrides
        </button>
      </div>
      <p className="dev-panel__hint">A pinned face still lets a poke or a care result play over it. Lighting is a device preference, not fixture state.</p>
    </>
  );
}

export function WorldSection({ controller, blobbi }: { controller: FixtureController; blobbi: BlobbiCompanion }) {
  const published = controller.store.published();
  return (
    <>
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
    </>
  );
}

/** The parsed Blobbi, read-only, for understanding what the world says. */
export function InspectorSection({ blobbi }: { blobbi: BlobbiCompanion }) {
  const [raw, setRaw] = useState(false);
  const v3 = blobbi.v3Identity;
  const rows: Array<[string, string]> = [
    ['d', blobbi.d],
    ['name', blobbi.name],
    ['stage', blobbi.stage],
    ['state', blobbi.state],
    ['generation', blobbi.visualGeneration.toUpperCase()],
    ['adult form', blobbi.adultType ?? '(from seed at evolve)'],
    ['seed', blobbi.seed ?? '(none)'],
    ['stats', STAT_NAMES.map((s) => `${s} ${blobbi.stats[s] ?? '?'}`).join(' · ')],
    ['streak', String(blobbi.careStreak ?? 0)],
    ['xp', String(blobbi.experience ?? 0)],
    ['progression', `${blobbi.progressionState}${blobbi.progressionStartedAt ? ` since ${blobbi.progressionStartedAt}` : ''}`],
    ['missions', blobbi.evolution.length ? blobbi.evolution.map((m) => `${m.id} ${'count' in m ? m.count : m.events.length}/${m.target}`).join(' · ') : '(none)'],
    ['traits', `${blobbi.visualTraits.baseColor} ${blobbi.visualTraits.secondaryColor} ${blobbi.visualTraits.eyeColor} · ${blobbi.visualTraits.pattern} · ${blobbi.visualTraits.specialMark} · ${blobbi.visualTraits.size}`],
    // The V3 identity exactly as the event states it (the seed-mirror traits above are what an older client draws from).
    ...(v3
      ? ([
          ['v3 colours', `${v3.colors.base ?? '?'} ${v3.colors.secondary ?? '?'} ${v3.colors.eye ?? '?'} · accent ${v3.colors.accent ?? 'none'}`],
          ['v3 traits', `antenna ${v3.traits.antenna ?? '?'} · horns ${v3.traits.horns ?? '?'} · ears ${v3.traits.ears ?? '?'} · tail ${v3.traits.tail ?? '?'} · spots ${v3.traits.spots ?? '?'} · belly ${v3.traits.belly ?? '?'} · freckles ${v3.traits.freckles ?? '?'}`],
          ['v3 algorithm', `${v3.algorithm}${v3.missing.length ? ` · MISSING ${v3.missing.join(', ')}` : ' · identity complete'}`],
        ] as Array<[string, string]>)
      : []),
    ['event', `${blobbi.event.id.slice(0, 10)}… at ${blobbi.event.created_at}`],
  ];
  return (
    <>
      <dl className="dev-inspector" data-testid="dev-inspector">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd data-testid={`dev-inspector-${k.replace(/ /g, '-')}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" aria-pressed={raw} onClick={() => setRaw((r) => !r)} data-testid="dev-inspector-raw">
        {raw ? 'hide' : 'show'} fixture event tags
      </button>
      {raw && (
        <pre className="dev-inspector__raw" data-testid="dev-inspector-tags">
          {blobbi.event.tags.map((t) => t.join(' = ')).join('\n')}
        </pre>
      )}
    </>
  );
}

