/**
 * Development only: the room's engineering controls, as ONE surface over
 * the room instead of cards competing for a phone's screen. Closed, it is
 * a small "Dev Tools" pill in a corner (and, when asked, a frames-per-second
 * indicator beside it); open, it is a bottom sheet on a phone and a side
 * panel on a wide screen, with one view at a time:
 *
 *   Animations   the room transitions by hand (which one, to which room,
 *                replay, cancel, a scrubber that holds a moment, speed),
 *                the care presentations (feeding, petting), and Reset
 *   Teleport     leave, arrive, a round trip, cancel; a scrubber for one
 *                exact moment of either journey
 *   Room         the room to stand in, and the other fixtures
 *   Visual       2D or the 3D model, the graphics quality, every face by
 *                name (the one worn is marked)
 *   Performance  the live numbers, Record 10 s, Copy report, Select all,
 *                the report; and this page's runtime errors, copyable
 *   Fixture      the fixture world's own panel (stage, stats, lifecycle),
 *                when a `?fixture=` link provides one
 *
 * Starting something to watch (a scene, a journey, feeding, petting) closes
 * the sheet on a phone so the room is in view; the pill says what is
 * playing and reopens the same view. Nothing in here publishes; the
 * functionality is the room's own (`useRoomTransitions`, `usePresence`,
 * `useRoomPerf`), only arranged. Never in a production build (the room
 * renders it behind the dev tools flag).
 */
import { useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type MutableRefObject, type PointerEvent, type ReactNode } from 'react';

import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { ROOM_ORDER, roomById, type RoomId } from '@/features/home/rooms/rooms';
import { EXPRESSIONS, type ExpressionName } from '@/features/expression/faces';
import type { Presence } from '@/features/teleport/react/usePresence';
import { journeyDuration, type JourneyKind } from '@/features/teleport/timeline';
import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import type { RoomTransitions } from '../hooks/useRoomTransitions';
import type { TransitionKind } from '../lib/room-transitions';
import { QUALITY_LEVELS, type QualityLevel, type QualityPreference } from '../lib/room-quality';
import { useRoomPerf } from '../hooks/useRoomPerf';
import { clearRuntimeErrors, formatRuntimeErrors, runtimeErrors, subscribeRuntimeErrors } from '../lib/runtime-errors';
import type { RoomControl } from './RoomShell';
import { RoomPerfPanel, RoomPerfPill } from './RoomPerfOverlay';

export type DevView = 'animations' | 'teleport' | 'room' | 'visual' | 'performance' | 'fixture';

const VIEWS: { id: DevView; label: string }[] = [
  { id: 'animations', label: 'Animations' },
  { id: 'teleport', label: 'Teleport' },
  { id: 'room', label: 'Room' },
  { id: 'visual', label: 'Visual' },
  { id: 'performance', label: 'Performance' },
  { id: 'fixture', label: 'Fixture' },
];

interface Scene {
  id: string;
  label: string;
  kind: TransitionKind;
  intro?: 'build' | 'quick';
}

const SCENES: Scene[] = [
  { id: 'construct', label: 'Room construction', kind: 'fade', intro: 'build' },
  { id: 'quick', label: 'Fast transition', kind: 'quick' },
  { id: 'big-jump', label: 'Big Jump', kind: 'big-jump' },
  { id: 'outside', label: 'Outside the Room', kind: 'outside' },
  { id: 'floor-gag', label: 'Invisible Floor', kind: 'floor-gag' },
  { id: 'behind-wall', label: 'Behind the Wall', kind: 'behind-wall' },
];

const SCENE_LABEL: Record<string, string> = Object.fromEntries(SCENES.map((s) => [s.kind, s.label]));

/** A round trip's pause while away. */
const AWAY_MS = 900;
/** Below this width the tools are a bottom sheet (a phone upright). */
const NARROW_QUERY = '(max-width: 767px)';
/** Below this height (a phone on its side) the side panel still closes to let a scene play: it covers too much to watch past. */
const SHORT_QUERY = '(max-height: 500px)';

export interface JourneyPreview {
  kind: JourneyKind;
  t: number;
  reduced: boolean;
}

export interface RoomDevToolsProps {
  transitions: RoomTransitions;
  /** The room on screen. */
  roomId: RoomId;
  /** Ask for a room, as the header does (a scene forced beforehand plays). */
  onRoom: (room: RoomId) => void;
  appearance: BlobbiAppearance;
  onAppearance: (appearance: BlobbiAppearance) => void;
  /** Why the 3D model cannot be drawn here, when it cannot. */
  unavailable3d?: string | null;
  quality: { preference: QualityPreference; level: QualityLevel; reason: string; onChange: (preference: QualityPreference) => void };
  /** Wear a face by name, or the Blobbi's own again. */
  onFace: (name: ExpressionName | null) => void;
  /** Play the eating animation and the petting reaction, presentation only. */
  onFeed: () => void;
  onPet: () => void;
  presence: Presence;
  preview: JourneyPreview | null;
  onPreview: (preview: JourneyPreview | null) => void;
  controlRef: MutableRefObject<RoomControl | null>;
  /** What draws the Blobbi now, for the report. */
  mode: string;
  /** Open on the Performance view with the indicator on (`?perf`). */
  perfOnOpen?: boolean;
}

function useMatches(query: string): boolean {
  const [on, setOn] = useState(() => {
    try {
      return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setOn(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return on;
}

function useRuntimeErrors() {
  return useSyncExternalStore(subscribeRuntimeErrors, runtimeErrors, runtimeErrors);
}

/** Nothing that happens in the tools reaches the room: no petting, no walking, no gaze. */
const isolate = (e: PointerEvent | React.MouseEvent | React.TouchEvent) => e.stopPropagation();

export function RoomDevTools(props: RoomDevToolsProps) {
  const { transitions, roomId, onRoom, appearance, onAppearance, unavailable3d, quality, onFace, onFeed, onPet, presence, preview, onPreview, controlRef, mode, perfOnOpen = false } = props;
  const narrow = useMatches(NARROW_QUERY);
  const short = useMatches(SHORT_QUERY);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DevView>(perfOnOpen ? 'performance' : 'animations');
  const [fpsPill, setFpsPill] = useState(perfOnOpen);
  // On a phone, starting something to watch closes the sheet; on a wide screen the panel stays beside the room
  const [closeToWatch, setCloseToWatch] = useState<boolean | null>(null);
  const watchCloses = closeToWatch ?? (narrow || short);

  // The fixture world's panel, when a `?fixture=` link provides one: shown here instead of floating on its own
  const fixture = useContext(DevFixtureContext);
  const fixturePanel = fixture?.panel;
  useEffect(() => fixturePanel?.claim(), [fixturePanel]);

  const errors = useRuntimeErrors();
  const perf = useRoomPerf({ controlRef, quality, mode, active: fpsPill || (open && view === 'performance') });

  // ─── Animations ───
  const [scene, setScene] = useState<Scene>(SCENES[2]);
  const nextRoom = ROOM_ORDER[(ROOM_ORDER.indexOf(roomId) + 1) % ROOM_ORDER.length];
  const [target, setTarget] = useState<RoomId | null>(null);
  const to = target && target !== roomId ? target : nextRoom;
  const [held, setHeld] = useState<number | null>(null);
  const [face, setFace] = useState<ExpressionName | null>(null);

  const watch = useCallback(() => {
    if (watchCloses) setOpen(false);
  }, [watchCloses]);

  const play = (s = scene) => {
    setHeld(null);
    setScene(s);
    transitions.cancel();
    transitions.forceNext(s.kind, { intro: s.intro });
    onRoom(to);
    watch();
  };
  // Hold a moment: the scene starts held on its first scrub, and moves with the scrubber after
  const hold = (t: number) => {
    setHeld(t);
    if (held !== null && transitions.seek(t)) return;
    transitions.cancel();
    transitions.forceNext(scene.kind, { intro: scene.intro, holdAt: t });
    onRoom(to);
  };
  const release = () => {
    setHeld(null);
    transitions.cancel();
  };
  const wear = (name: ExpressionName | null) => {
    setFace(name);
    onFace(name);
  };

  // ─── Teleport ───
  const [roundTrip, setRoundTrip] = useState(false);
  const [kind, setKind] = useState<JourneyKind>('depart');
  const [reduced, setReduced] = useState(false);
  const { state, enter } = presence;
  useEffect(() => {
    if (!roundTrip || state !== 'absent') return;
    const timer = setTimeout(() => {
      setRoundTrip(false);
      enter();
    }, AWAY_MS);
    return () => clearTimeout(timer);
  }, [roundTrip, state, enter]);
  const total = journeyDuration(kind, reduced);

  /** Everything back to neutral: no scene, no held moment, its own face, no journey, no preview. */
  const reset = () => {
    setHeld(null);
    transitions.cancel();
    wear(null);
    onPreview(null);
    setRoundTrip(false);
    presence.cancel();
  };

  const playing = transitions.kind ? SCENE_LABEL[transitions.kind] ?? transitions.kind : state !== 'present' ? `Teleport · ${state}` : null;
  const views = useMemo(() => VIEWS.filter((v) => v.id !== 'fixture' || !!fixturePanel), [fixturePanel]);
  const openAt = (v: DevView) => {
    setView(v);
    setOpen(true);
  };

  const pill = (
    <div className="devtools__pills" data-testid="dev-tools-pills" onPointerDown={isolate} onPointerUp={isolate} onClick={isolate}>
      {fpsPill && <RoomPerfPill perf={perf} onOpen={() => openAt('performance')} />}
      {errors.length > 0 && (
        <button type="button" className="devtools__pill devtools__pill--error" onClick={() => openAt('performance')} data-testid="dev-tools-errors" aria-label={`${errors.length} runtime errors; open the dev tools`}>
          ⚠ {errors.length}
        </button>
      )}
      <button type="button" className="devtools__pill" onClick={() => setOpen(true)} data-testid="dev-tools-open" aria-expanded={open} data-playing={playing ? 'true' : 'false'}>
        {playing ? `▶ ${playing}` : 'Dev Tools'}
      </button>
    </div>
  );

  // Closed: the pills alone. Open: the sheet alone (it has its own close), so nothing shows through it.
  if (!open) return pill;

  return (
    <>
      <section
        className={`devtools ${narrow ? 'devtools--sheet' : 'devtools--side'}`}
        role="dialog"
        aria-label="Dev tools"
        data-testid="dev-tools"
        data-view={view}
        data-layout={narrow ? 'sheet' : 'side'}
        onPointerDown={isolate}
        onPointerMove={isolate}
        onPointerUp={isolate}
        onClick={isolate}
      >
        <header className="devtools__head">
          <strong className="devtools__title" data-testid="dev-tools-status">
            {playing ?? 'Dev Tools'}
          </strong>
          <label className="devtools__check" title="Close the tools when something starts to play">
            <input type="checkbox" checked={watchCloses} onChange={(e) => setCloseToWatch(e.target.checked)} data-testid="dev-tools-close-to-watch" /> close to watch
          </label>
          <button type="button" className="devtools__close" onClick={() => setOpen(false)} aria-label="Close the dev tools" data-testid="dev-tools-close">
            ✕
          </button>
        </header>
        <nav className="devtools__tabs" aria-label="Dev tool views">
          {views.map((v) => (
            <button key={v.id} type="button" className="devtools__tab" aria-pressed={view === v.id} onClick={() => setView(v.id)} data-testid={`dev-tools-tab-${v.id}`}>
              {v.label}
              {v.id === 'performance' && errors.length > 0 ? ` ⚠${errors.length}` : ''}
            </button>
          ))}
        </nav>
        <div className="devtools__body">
          {view === 'animations' && (
            <div className="devtools__view" data-testid="playground" data-state={transitions.kind ?? 'idle'}>
              <Group title="Room transitions" hint={`Playing: ${transitions.kind ? SCENE_LABEL[transitions.kind] ?? transitions.kind : 'none'}`}>
                <div className="devtools__grid">
                  {SCENES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={scene.id === s.id}
                      data-active={scene.id === s.id}
                      data-playing={transitions.kind === s.kind}
                      onClick={() => {
                        setScene(s);
                        if (held === null) play(s);
                        else release();
                      }}
                      data-testid={`playground-scene-${s.id}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <label className="devtools__row">
                  to
                  <select value={to} onChange={(e) => setTarget(e.target.value as RoomId)} data-testid="playground-room">
                    {ROOM_ORDER.filter((r) => r !== roomId).map((r) => (
                      <option key={r} value={r}>
                        {roomById(r).label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => play()} data-testid="playground-replay">
                    Replay
                  </button>
                  <button type="button" onClick={release} data-testid="playground-cancel">
                    Cancel
                  </button>
                </label>
                <label className="devtools__row">
                  speed
                  <input type="range" min={0.1} max={2} step={0.1} value={transitions.speed} onChange={(e) => transitions.setSpeed(Number(e.target.value))} data-testid="playground-speed" />
                  <span>{transitions.speed.toFixed(1)}×</span>
                </label>
                <label className="devtools__row">
                  hold
                  <input type="range" min={0} max={Math.max(1, transitions.durationMs || 3000)} step={10} value={held ?? 0} onChange={(e) => hold(Number(e.target.value))} aria-label="Scene time" data-testid="playground-scrub" />
                  {held !== null && (
                    <button type="button" onClick={release} data-testid="playground-release">
                      Release
                    </button>
                  )}
                </label>
                <div className="devtools__hint">{held !== null ? `${scene.label} held at ${held} ms` : 'drag to hold a moment of the chosen scene'}</div>
              </Group>
              <Group title="Care">
                <div className="devtools__row">
                  <button
                    type="button"
                    onClick={() => {
                      onFeed();
                      watch();
                    }}
                    data-testid="playground-feed"
                  >
                    Feeding
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPet();
                      watch();
                    }}
                    data-testid="playground-pet"
                  >
                    Petting
                  </button>
                </div>
              </Group>
              <div className="devtools__row">
                <button type="button" className="devtools__reset" onClick={reset} data-testid="dev-tools-reset">
                  Reset to neutral
                </button>
              </div>
            </div>
          )}

          {view === 'teleport' && (
            <div className="devtools__view" data-testid="teleport-dev" data-state={state}>
              <Group title="Journeys" hint={`Now: ${state}`}>
                <div className="devtools__grid">
                  <button
                    type="button"
                    onClick={() => {
                      onPreview(null);
                      presence.leave();
                      watch();
                    }}
                    data-testid="teleport-dev-leave"
                  >
                    Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPreview(null);
                      presence.enter();
                      watch();
                    }}
                    data-testid="teleport-dev-arrive"
                  >
                    Arrive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPreview(null);
                      setRoundTrip(true);
                      if (!presence.leave() && state === 'absent') enter();
                      watch();
                    }}
                    data-testid="teleport-dev-round-trip"
                  >
                    Round trip
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPreview(null);
                      setRoundTrip(false);
                      presence.cancel();
                    }}
                    data-testid="teleport-dev-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </Group>
              <Group title="Hold a moment">
                <div className="devtools__row">
                  <label>
                    <input type="radio" checked={kind === 'depart'} onChange={() => { setKind('depart'); onPreview(preview ? { ...preview, kind: 'depart', t: Math.min(preview.t, journeyDuration('depart', reduced)) } : null); }} /> depart
                  </label>
                  <label>
                    <input type="radio" checked={kind === 'arrive'} onChange={() => { setKind('arrive'); onPreview(preview ? { ...preview, kind: 'arrive', t: Math.min(preview.t, journeyDuration('arrive', reduced)) } : null); }} /> arrive
                  </label>
                  <label>
                    <input type="checkbox" checked={reduced} onChange={(e) => { setReduced(e.target.checked); if (preview) onPreview({ ...preview, reduced: e.target.checked }); }} /> reduced
                  </label>
                </div>
                <div className="devtools__row">
                  <input type="range" min={0} max={total} step={10} value={preview?.kind === kind ? preview.t : 0} onChange={(e) => onPreview({ kind, t: Number(e.target.value), reduced })} aria-label="Journey time" data-testid="teleport-dev-scrub" />
                  {preview && (
                    <button type="button" onClick={() => onPreview(null)} data-testid="teleport-dev-release">
                      Release
                    </button>
                  )}
                </div>
                <div className="devtools__hint">{preview ? `${preview.kind} at ${Math.round(preview.t)} ms of ${total}` : 'drag to hold a moment of the chosen journey'}</div>
              </Group>
            </div>
          )}

          {view === 'room' && (
            <div className="devtools__view" data-testid="dev-tools-room">
              <Group title="Go to" hint={`Here: ${roomById(roomId).label}`}>
                <div className="devtools__grid">
                  {ROOM_ORDER.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={r === roomId}
                      disabled={r === roomId}
                      onClick={() => {
                        onRoom(r);
                        watch();
                      }}
                      data-testid={`dev-tools-room-${r}`}
                    >
                      {roomById(r).label}
                    </button>
                  ))}
                </div>
              </Group>
              <Group title="Fixtures" hint="Reloads the page with another simulated Blobbi">
                <div className="devtools__row">
                  <a className="devtools__link" href="?fixture=adult-v3&perf" data-testid="dev-tools-fixture-adult">
                    Adult V3
                  </a>
                  <a className="devtools__link" href="?fixture=baby-v3&perf" data-testid="dev-tools-fixture-baby">
                    Baby V3
                  </a>
                </div>
              </Group>
            </div>
          )}

          {view === 'visual' && (
            <div className="devtools__view" data-testid="dev-tools-visual">
              <Group title="Drawing" hint={unavailable3d ?? undefined}>
                <div className="devtools__row">
                  <button type="button" aria-pressed={appearance === '2d'} onClick={() => onAppearance('2d')} data-testid="dev-tools-2d">
                    2D drawing
                  </button>
                  <button type="button" aria-pressed={appearance === '3d'} onClick={() => onAppearance('3d')} disabled={!!unavailable3d} data-testid="dev-tools-3d">
                    3D model
                  </button>
                  <button type="button" onClick={() => onAppearance(appearance === '3d' ? '2d' : '3d')} data-testid="playground-appearance" className="sr-only">
                    {appearance === '3d' ? 'Show 2D' : 'Show 3D'}
                  </button>
                </div>
              </Group>
              <Group title="Graphics quality" hint={`Now: ${quality.level}${quality.preference === 'auto' ? ` (auto, ${quality.reason})` : ''}`}>
                <div className="devtools__grid">
                  <button type="button" aria-pressed={quality.preference === 'auto'} onClick={() => quality.onChange('auto')} data-testid="dev-tools-quality-auto">
                    Auto
                  </button>
                  {QUALITY_LEVELS.map((level) => (
                    <button key={level} type="button" aria-pressed={quality.preference === level} onClick={() => quality.onChange(level)} data-testid={`dev-tools-quality-${level}`}>
                      {level}
                    </button>
                  ))}
                </div>
              </Group>
              <Group title="Face" hint={`Wearing: ${face ?? 'its own'}`}>
                <div className="devtools__grid">
                  <button type="button" aria-pressed={face === null} onClick={() => wear(null)} data-testid="playground-face-clear">
                    own face
                  </button>
                  {(Object.keys(EXPRESSIONS) as ExpressionName[]).map((name) => (
                    <button key={name} type="button" aria-pressed={face === name} onClick={() => wear(name)} data-testid={`playground-face-${name}`}>
                      {name}
                    </button>
                  ))}
                </div>
              </Group>
            </div>
          )}

          {view === 'performance' && (
            <div className="devtools__view" data-testid="dev-tools-performance">
              <Group title="Measured here">
                <label className="devtools__check">
                  <input type="checkbox" checked={fpsPill} onChange={(e) => setFpsPill(e.target.checked)} data-testid="dev-tools-fps-pill" /> show fps in the corner while closed
                </label>
                <RoomPerfPanel perf={perf} quality={quality} mode={mode} />
              </Group>
              <Group title={`Runtime errors (${errors.length})`} hint="Uncaught errors, unhandled rejections and room render errors on this page">
                {errors.length === 0 ? (
                  <div className="devtools__hint" data-testid="dev-tools-no-errors">
                    none so far
                  </div>
                ) : (
                  <>
                    <ul className="devtools__errors" data-testid="dev-tools-error-list">
                      {errors.map((e, i) => (
                        <li key={`${e.at}-${i}`}>
                          <span className="opacity-70">{e.at.slice(11, 19)}</span> {e.kind}: {e.message}
                        </li>
                      ))}
                    </ul>
                    <ErrorReport text={formatRuntimeErrors(errors)} onClear={clearRuntimeErrors} />
                  </>
                )}
              </Group>
            </div>
          )}

          {view === 'fixture' && fixturePanel && (
            <div className="devtools__view" data-testid="dev-tools-fixture">
              {fixturePanel.node}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="devtools__group">
      <h3 className="devtools__group-title">
        {title}
        {hint && <span className="devtools__hint"> · {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

function ErrorReport({ text, onClear }: { text: string; onClear: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard here');
      await navigator.clipboard.writeText(text);
      setCopied('copied');
    } catch {
      setCopied('clipboard unavailable: select the text below and copy it');
    }
  };
  const selectAll = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  };
  return (
    <>
      <div className="devtools__row">
        <button type="button" onClick={() => void copy()} data-testid="dev-tools-errors-copy">
          Copy errors
        </button>
        <button type="button" onClick={onClear} data-testid="dev-tools-errors-clear">
          Clear
        </button>
      </div>
      {copied && <div>{copied}</div>}
      <textarea className="devtools__report" readOnly rows={6} value={text} onFocus={(e) => selectAll(e.currentTarget)} data-testid="dev-tools-errors-report" />
    </>
  );
}
