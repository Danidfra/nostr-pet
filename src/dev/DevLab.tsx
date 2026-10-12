import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BLOBBI_EMOTIONS, type BlobbiEmotion } from '@blobbi-kit/renderer';
import { FLOOR_BOUNDS, clampToFloor, type BlobbiSceneController, type Facing } from '@/features/home/scene';
import { BLOBBI_SOUNDS, useSound, type BlobbiSoundId } from '@/features/sound';
import Home from '@/pages/Home';
import { DebugOverlay } from './DebugOverlay';
import { ExpressionSheet } from './ExpressionSheet';
import { V3Sheet } from './V3Sheet';
import { useFixtureController } from './FixtureControllerContext';
import { FIXTURE_PRESETS } from './fixture-controller';
import { AdoptedSections, InspectorSection, LifecycleSection, PinsSection, StageStateSection, StatsSection, WorldSection } from './sections';
import { FIXTURE_D } from './fixture-world';
import { FACINGS, specFromCompanion, summaryOf, useDevHome, useDevLifecycle, type DevHome } from './dev-home';
import './dev-lab.css';

const OVERLAY_KEY = 'blobbi:dev-lab:overlay';
const DRAWER_KEY = 'blobbi:dev-lab:drawer';
const remembered = (key: string, fallback: boolean) => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};
const remember = (key: string, value: boolean) => {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* fine */
  }
};

/**
 * The Blobbi Dev Lab (`/dev`): the real home, driven by the fixture
 * controller, inside an engineering layout. The controls are the shared
 * dev sections; the preview is the actual standalone scene (renderer,
 * movement, bed and nest, shadows, interactions) over the in-memory pool,
 * with an optional debug overlay drawn into the real room canvas. Nothing
 * here is a second implementation of Blobbi behaviour, and nothing here can
 * reach a relay. Dev bundle only, reachable only in a dev build.
 */
export default function DevLab() {
  const controller = useFixtureController();
  const home = useDevHome(controller);
  const [overlay, setOverlay] = useState(() => remembered(OVERLAY_KEY, false));
  const [drawer, setDrawer] = useState(() => remembered(DRAWER_KEY, true));
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageRoot, setStageRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setStageRoot(stageRef.current), []);
  const blobbi = home.current;

  return (
    <div className={`dev-lab ${drawer ? '' : 'dev-lab--drawer-closed'}`} data-testid="dev-lab">
      <header className="dev-lab__banner" data-testid="dev-lab-banner">
        <strong>DEV FIXTURE — IN-MEMORY NOSTR</strong>
        <span>Blobbi Dev Lab · nothing here reaches a relay or a real account</span>
        <span className="dev-lab__summary" data-testid="dev-summary">
          {summaryOf(blobbi, home.status)}
        </span>
        {blobbi && (
          <span className={`dev-lab__generation dev-lab__generation--${blobbi.visualGeneration}`} data-testid="dev-lab-generation">
            Generation: {blobbi.visualGeneration.toUpperCase()}
          </span>
        )}
        <button type="button" className="dev-panel__danger" onClick={() => controller.reset()} data-testid="dev-reset">
          Reset fixture
        </button>
        <button type="button" className="dev-lab__drawer-toggle" aria-expanded={drawer} onClick={() => setDrawer((d) => (remember(DRAWER_KEY, !d), !d))} data-testid="dev-lab-drawer">
          {drawer ? 'hide controls' : 'show controls'}
        </button>
      </header>
      <aside className="dev-lab__controls dev-panel dev-panel--lab" aria-label="Dev Lab controls" data-testid="dev-lab-controls">
        {blobbi && blobbi.d !== FIXTURE_D ? (
          <div className="dev-panel__body">
            <AdoptedSections controller={controller} blobbi={blobbi} />
          </div>
        ) : blobbi ? (
          <LabControls key={blobbi.d} home={{ blobbi, profile: home.profile, pubkey: home.pubkey, updateCompanionEvent: home.updateCompanionEvent, refresh: home.refresh }} overlay={overlay} onOverlay={(v) => (remember(OVERLAY_KEY, v), setOverlay(v))} />
        ) : (
          <div className="dev-panel__body dev-panel__hint" data-testid="dev-no-blobbi">
            {home.status === 'empty' ? 'This account owns no Blobbi yet: adopt one in the app. It will be its first Blobbi, so its egg hatches by itself.' : `Fixture loading (${home.status})…`}
          </div>
        )}
      </aside>
      <main className="dev-lab__stage" ref={stageRef} data-testid="dev-lab-stage">
        {/* The Dev Lab drives the classic home's scene controller: it stays there, whatever the device prefers */}
        <Home classic />
        {overlay && <DebugOverlay scene={controller.scene()} stageRoot={stageRoot} />}
      </main>
    </div>
  );
}

function Section({ title, children, open = true, testId }: { title: string; children: ReactNode; open?: boolean; testId?: string }) {
  return (
    <details open={open} data-testid={testId}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

function LabControls({ home, overlay, onOverlay }: { home: DevHome; overlay: boolean; onOverlay: (v: boolean) => void }) {
  const controller = useFixtureController();
  const { blobbi } = home;
  const spec = specFromCompanion(blobbi);
  const lifecycle = useDevLifecycle(home);
  return (
    <div className="dev-panel__body">
      <Section title="Quick fixtures" testId="dev-lab-quick">
        <StageStateSection controller={controller} spec={spec} />
        <div className="dev-panel__row dev-lab__presets">
          {FIXTURE_PRESETS.map((p) => (
            <button type="button" key={p.id} onClick={() => controller.applyPreset(p.id)} data-testid={`dev-preset-${p.id}`}>
              {p.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Lifecycle playground" testId="dev-lab-lifecycle">
        <p className="dev-panel__hint">Set places the fixture in a state at once; Perform runs the kit's real hooks against the in-memory pool and shows their answer.</p>
        <LifecycleSection controller={controller} spec={spec} lifecycle={lifecycle} pipeline />
      </Section>
      <Section title="Stats (authoritative fixture data)" testId="dev-lab-stats">
        <StatsSection controller={controller} spec={spec} blobbi={blobbi} />
      </Section>
      <Section title="Presentation overrides (not data)" testId="dev-lab-pins">
        <PinsSection controller={controller} />
      </Section>
      <Section title="Movement lab" testId="dev-lab-movement">
        <MovementLab />
        <div className="dev-panel__row">
          <label>
            <input type="checkbox" checked={overlay} onChange={(e) => onOverlay(e.target.checked)} data-testid="dev-overlay-toggle" /> show debug bounds
          </label>
        </div>
      </Section>
      <Section title="Expression lab" testId="dev-lab-expressions">
        <ExpressionLab home={home} />
      </Section>
      <Section title="V3 population (renderer only)" open={false} testId="dev-lab-v3">
        <p className="dev-panel__hint">The kit's twelve reference Blobbis (the ones algorithm 1 is pinned with), or real seeds as the kit's creation rule makes them: egg, baby and adult of one identity. Not the fixture, not an event.</p>
        <V3Sheet cell={46} />
      </Section>
      <Section title="Sound lab" testId="dev-lab-sound">
        <SoundLab />
      </Section>
      <Section title="Inspect" open={false} testId="dev-lab-inspect">
        <InspectorSection blobbi={blobbi} />
      </Section>
      <Section title="World" open={false} testId="dev-lab-world">
        <WorldSection controller={controller} blobbi={blobbi} />
      </Section>
    </div>
  );
}

/** Drives the SAME scene controller the game uses (walks, pokes); the renderer draws whatever gait the artwork has. */
function MovementLab() {
  const controller = useFixtureController();
  const [scene, setScene] = useState<BlobbiSceneController | null>(() => controller.scene());
  useEffect(() => controller.subscribe((change) => change.kind === 'scene' && setScene(change.scene)), [controller]);
  const p = scene?.presentation;
  const walkBy = (dx: number, dy: number) => {
    if (!scene) return;
    const from = scene.presentation.position;
    void scene.walkTo(clampToFloor({ x: from.x + dx, y: from.y + dy }));
  };
  const canWalk = !!scene?.canWalk;
  return (
    <>
      <p className="dev-panel__hint" data-testid="dev-movement-state">
        {p ? `${p.motion} · facing ${p.facing} · at ${p.position.x.toFixed(2)},${p.position.y.toFixed(2)}${scene?.destination ? ` → ${scene.destination.x.toFixed(2)},${scene.destination.y.toFixed(2)}` : ''} · ${scene?.mode}` : 'no scene mounted'}
      </p>
      <div className="dev-panel__row">
        <span className="dev-panel__label">walk</span>
        <button type="button" disabled={!canWalk} onClick={() => walkBy(-0.3, 0)} data-testid="dev-walk-left">
          left
        </button>
        <button type="button" disabled={!canWalk} onClick={() => walkBy(0.3, 0)} data-testid="dev-walk-right">
          right
        </button>
        <button type="button" disabled={!canWalk} onClick={() => walkBy(0, 0.35)} data-testid="dev-walk-toward">
          toward viewer
        </button>
        <button type="button" disabled={!canWalk} onClick={() => walkBy(0, -0.35)} data-testid="dev-walk-away">
          away
        </button>
        <button type="button" disabled={!scene} onClick={() => scene && scene.placeAt(scene.presentation.position)} data-testid="dev-walk-stop">
          stop
        </button>
      </div>
      <div className="dev-panel__row">
        {/* A standing Blobbi faces the viewer: the game never turns it on the spot. To LOOK at another view, pin it (a presentation override, like the face). */}
        <span className="dev-panel__label">view</span>
        {FACINGS.map((f) => (
          <button type="button" key={f} aria-pressed={controller.pins().facing === f} onClick={() => controller.setPins({ facing: controller.pins().facing === f ? null : f })} data-testid={`dev-turn-${f}`} title="Pin this view (press again to let the game decide)">
            {f}
          </button>
        ))}
        <button type="button" disabled={!scene} onClick={() => scene?.poke()} data-testid="dev-poke">
          poke
        </button>
      </div>
      <div className="dev-panel__row">
        <span className="dev-panel__label">go to</span>
        <button
          type="button"
          className="dev-floor"
          disabled={!canWalk}
          aria-label="Walk to a point on the floor"
          data-testid="dev-floor"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = FLOOR_BOUNDS.minX + ((e.clientX - rect.left) / rect.width) * (FLOOR_BOUNDS.maxX - FLOOR_BOUNDS.minX);
            const y = FLOOR_BOUNDS.minY + ((e.clientY - rect.top) / rect.height) * (FLOOR_BOUNDS.maxY - FLOOR_BOUNDS.minY);
            void scene?.walkTo(clampToFloor({ x, y }));
          }}
        >
          {p && <span className="dev-floor__dot" style={{ left: `${((p.position.x - FLOOR_BOUNDS.minX) / (FLOOR_BOUNDS.maxX - FLOOR_BOUNDS.minX)) * 100}%`, top: `${((p.position.y - FLOOR_BOUNDS.minY) / (FLOOR_BOUNDS.maxY - FLOOR_BOUNDS.minY)) * 100}%` }} />}
        </button>
        <span className="dev-panel__hint">a small floor: click where it should walk (the real floor works too)</span>
      </div>
    </>
  );
}

/** Every expression on the three faces at once, under one facing and gaze; a click pins that face on the live Blobbi. */
function ExpressionLab({ home }: { home: DevHome }) {
  const controller = useFixtureController();
  const pins = controller.pins();
  const [facing, setFacing] = useState<Facing>('front');
  const [gaze, setGaze] = useState(0);
  return (
    <>
      <div className="dev-panel__row">
        <span className="dev-panel__label">compare</span>
        {FACINGS.map((f) => (
          <button type="button" key={f} aria-pressed={facing === f} onClick={() => setFacing(f)} data-testid={`dev-sheet-facing-${f}`}>
            {f}
          </button>
        ))}
        <label htmlFor="dev-sheet-gaze">gaze</label>
        <input id="dev-sheet-gaze" type="range" min={-1} max={1} step={0.25} value={gaze} onChange={(e) => setGaze(Number(e.target.value))} data-testid="dev-sheet-gaze" />
      </div>
      <div className="dev-panel__row">
        {BLOBBI_EMOTIONS.map((e: BlobbiEmotion) => (
          <button type="button" key={e} aria-pressed={pins.expression === e} onClick={() => controller.setPins({ expression: pins.expression === e ? null : e })} data-testid={`dev-expression-${e}`}>
            {e}
          </button>
        ))}
      </div>
      <ExpressionSheet blobbi={home.blobbi} facing={facing} eyeOffset={gaze === 0 ? undefined : { x: gaze, y: 0 }} selected={pins.expression} onSelect={(e) => controller.setPins({ expression: pins.expression === e ? null : e })} cell={44} />
      <p className="dev-panel__hint">Isolated renderer previews with the fixture's own seed; the back view has no face and is left out. A click pins that face on the Blobbi in the scene.</p>
    </>
  );
}

/** Every recipe the voice has, auditioned without any care action or Nostr write. */
function SoundLab() {
  const sound = useSound();
  const audition = (id: BlobbiSoundId) => {
    if (!sound.enabled) sound.setEnabled(true);
    sound.play(id);
  };
  return (
    <>
      <div className="dev-panel__row">
        <span className="dev-panel__label">sound</span>
        <button type="button" role="switch" aria-checked={sound.enabled} onClick={() => sound.setEnabled(!sound.enabled)} data-testid="dev-sound-toggle">
          {sound.enabled ? 'on' : 'off'}
        </button>
        <span className="dev-panel__hint">turning it on here is the device setting the menu also sets</span>
      </div>
      <div className="dev-panel__row">
        {BLOBBI_SOUNDS.map((id) => (
          <button type="button" key={id} onClick={() => audition(id)} data-testid={`dev-sound-${id}`}>
            {id}
          </button>
        ))}
      </div>
      <p className="dev-panel__hint">The list is the voice's own recipe table (`features/sound/blobbi-voice.ts`): poke and its glad, upset and sleepy answers, eat, clean, hatch, evolve.</p>
    </>
  );
}
