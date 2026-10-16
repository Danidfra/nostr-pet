/**
 * The iPhone crash of M14.3 and what came with its fix (M14.3.1). On iOS
 * Safari a lost WebGL context answers `createShader` with null and
 * `shaderSource(null)` throws "Argument 1 ('shader') to
 * WebGL2RenderingContext.shaderSource must be an instance of WebGLShader".
 * The introduction's 3D preview was disposed (context forced lost, program
 * cache emptied) and then, in the next cleanup, asked to draw once more:
 * the shaders compiled again on the dead context and the room fell to its
 * error boundary on "Let's explore". Desktop Chrome and WebKit hand out a
 * placeholder shader on a lost context, so automation never saw it.
 *
 * The renderer here behaves like the phone: drawing on a lost context
 * throws that TypeError. The stage draws nothing once disposed or lost, a
 * preview's failure stays in the preview, the introduction's cards select
 * the look, the crash card's way out leads to the 2D home and stays there,
 * and nothing about the Blobbi is lost or published.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { parseBlobbiEvent } from '@blobbi-kit/core';

const IOS_SHADER_ERROR = "Argument 1 ('shader') to WebGL2RenderingContext.shaderSource must be an instance of WebGLShader";

const fake = vi.hoisted(() => ({
  made: 0,
  renders: 0,
  /** Every renderer made, newest last. */
  all: [] as { lost: boolean; domElement: HTMLCanvasElement }[],
  /** A render that fails for another reason (a broken shader, a driver). */
  explode: false,
}));
vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  class PhoneRenderer {
    shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    toneMapping = 0;
    localClippingEnabled = false;
    domElement: HTMLCanvasElement;
    lost = false;
    private gl = { isContextLost: () => this.lost };
    constructor(options: { canvas?: HTMLCanvasElement } = {}) {
      this.domElement = options.canvas ?? document.createElement('canvas');
      fake.made++;
      fake.all.push(this);
    }
    getContext() {
      return this.gl;
    }
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    compileAsync() {
      return Promise.resolve();
    }
    render() {
      // iOS Safari: a lost context compiles nothing, and three's shaderSource call throws
      if (this.lost) throw new TypeError(IOS_SHADER_ERROR);
      if (fake.explode) throw new Error('the GPU said no');
      fake.renders++;
    }
    dispose() {}
    forceContextLoss() {
      this.lost = true;
    }
  }
  return { ...three, WebGLRenderer: PhoneRenderer };
});

const gl = vi.hoisted(() => ({ pretend: true }));
vi.mock('./hooks/useRoomScene', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./hooks/useRoomScene')>();
  return { ...mod, webglAvailable: () => gl.pretend };
});

// A room that throws while rendering, for the crash card's way out
const crash = vi.hoisted(() => ({ on: false }));
vi.mock('./components/RoomIntro', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./components/RoomIntro')>();
  return {
    ...mod,
    RoomIntro: (props: Parameters<typeof mod.RoomIntro>[0]) => {
      if (crash.on) throw new Error('the room broke');
      return mod.RoomIntro(props);
    },
  };
});

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { EXPERIENCE_STORAGE_KEY, ROOM_INTRO_STORAGE_KEY } from '@/lib/home-experience';
import { APPEARANCE_STORAGE_KEY } from './lib/blobbi-appearance';
import { buildBlobbiModel } from './lib/blobbi3d/model';
import { genomeOf, morphologyOf } from './lib/blobbi3d/identity';
import { BlobbiStage } from './lib/blobbi3d/stage';
import { Blobbi3dStage } from './components/Blobbi3dStage';
import { RoomErrorBoundary } from './components/RoomErrorBoundary';
import { RoomIntro } from './components/RoomIntro';
import { clearRuntimeErrors, runtimeErrors } from './lib/runtime-errors';

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
  }),
} as unknown as NPool;

function renderApp(path = '/room') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion: false, idleEnabled: false, walkSpeed: 4 }}>
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
              <AppRouter />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
}

const adultEvent = () => blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' });
const adult = () => parseBlobbiEvent(adultEvent())!;
const egg = () => parseBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'egg', state: 'active', visualGeneration: 'v3' }))!;

function modelOf() {
  const genome = genomeOf(toBlobbiVisual(adult()))!;
  return buildBlobbiModel(morphologyOf(genome, 'adult'), genome.seed);
}

/** The storage that is the Blobbi and the account (everything but this device's view preferences). */
function heldState(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key === EXPERIENCE_STORAGE_KEY || key === APPEARANCE_STORAGE_KEY || key.startsWith('blobbi:room') || key.startsWith('blobbi:home:3d-intro')) continue;
    out[key] = localStorage.getItem(key);
  }
  return out;
}

/** Nothing held before is gone or changed (records the app seeds later, such as the Journey's, may join). */
function expectKept(held: Record<string, string | null>) {
  const now = heldState();
  for (const [key, value] of Object.entries(held)) expect(now[key], key).toBe(value);
}

let rafs: FrameRequestCallback[] = [];
/** This file's own spies, restored one by one (restoring every mock would undo the setup's matchMedia). */
const spies: { mockRestore: () => void }[] = [];
const quietErrors = () => spies.push(vi.spyOn(console, 'error').mockImplementation(() => {}));
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  fake.made = 0;
  fake.renders = 0;
  fake.all = [];
  fake.explode = false;
  gl.pretend = true;
  crash.on = false;
  relay.all = [];
  relay.published = [];
  localStorage.clear();
  clearRuntimeErrors();
  rafs = [];
  spies.push(
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafs.push(cb);
      return rafs.length;
    }),
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {}),
  );
});
afterEach(() => {
  localStorage.clear();
  for (const spy of spies.splice(0)) spy.mockRestore();
});

/** Run the frames asked for so far (the stage's loop). */
function runFrames() {
  const due = rafs;
  rafs = [];
  for (const cb of due) cb(performance.now());
}

describe('the stage on a phone: nothing drawn once disposed or lost', () => {
  it('a disposed stage asked to draw again (the preview\'s cleanup after its dispose) does not touch the dead context', () => {
    const host = document.createElement('div');
    const stage = new BlobbiStage(host);
    const model = modelOf();
    stage.setModel(model);
    expect(fake.renders).toBeGreaterThan(0);
    const before = fake.renders;
    stage.dispose();
    // The order React ran the cleanups in on "Let's explore": the stage first, then the model set to none
    expect(() => stage.setModel(null)).not.toThrow();
    expect(() => stage.setView('side')).not.toThrow();
    expect(() => stage.setMotion('walking')).not.toThrow();
    expect(() => stage.resize(80, 80)).not.toThrow();
    expect(() => stage.lookAtNothing()).not.toThrow();
    expect(() => runFrames()).not.toThrow();
    expect(fake.renders).toBe(before);
    // Disposing twice is harmless
    expect(() => stage.dispose()).not.toThrow();
    model.dispose();
  });

  it('a context the browser took away before three heard of it: nothing drawn, said once, the loop stops', () => {
    const host = document.createElement('div');
    const stage = new BlobbiStage(host);
    const lost = vi.fn();
    stage.onContextLost = lost;
    stage.setModel(modelOf());
    fake.all[0].lost = true;
    expect(() => stage.setView('side')).not.toThrow();
    expect(() => runFrames()).not.toThrow();
    expect(lost).toHaveBeenCalledTimes(1);
    // The event arriving later says nothing new
    stage.canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(lost).toHaveBeenCalledTimes(1);
    stage.dispose();
  });

  it('the webglcontextlost event alone stops the stage and says so', () => {
    const stage = new BlobbiStage(document.createElement('div'));
    const lost = vi.fn();
    stage.onContextLost = lost;
    stage.canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(lost).toHaveBeenCalledTimes(1);
    const before = fake.renders;
    stage.setModel(modelOf());
    expect(fake.renders).toBe(before);
    stage.dispose();
  });
});

describe('a 3D preview is never worth the room', () => {
  const genome = () => genomeOf(toBlobbiVisual(adult()))!;
  function inRoom(node: React.ReactNode) {
    return (
      <MemoryRouter>
        <RoomErrorBoundary>
          <div data-testid="room-ok">{node}</div>
        </RoomErrorBoundary>
      </MemoryRouter>
    );
  }

  it('unmounting a drawn preview leaves the room standing (the iPhone\'s crash on "Let\'s explore")', () => {
    const view = render(inRoom(<Blobbi3dStage genome={genome()} stage="adult" view="front" motion="idle" size={120} testId="preview" />));
    expect(screen.getByTestId('preview')).toHaveAttribute('data-stage', 'ready');
    view.rerender(inRoom(null));
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(screen.getByTestId('room-ok')).toBeInTheDocument();
    expect(runtimeErrors()).toHaveLength(0);
  });

  it('a context lost while shown: the preview becomes a line and no new context is made', () => {
    render(inRoom(<Blobbi3dStage genome={genome()} stage="adult" view="front" motion="idle" size={120} testId="preview" />));
    expect(fake.made).toBe(1);
    act(() => {
      fake.all[0].lost = true;
      fake.all[0].domElement.dispatchEvent(new Event('webglcontextlost'));
    });
    expect(screen.getByTestId('preview')).toHaveAttribute('data-stage', 'lost');
    expect(screen.getByTestId('preview-note')).toHaveTextContent('The 3D preview stopped on this device.');
    act(() => runFrames());
    expect(fake.made).toBe(1);
    expect(screen.queryByTestId('room-crash')).toBeNull();
  });

  it('an error thrown inside the preview stays in the preview, a line in its place, and is still reported', () => {
    quietErrors();
    fake.explode = true;
    render(inRoom(<Blobbi3dStage genome={genome()} stage="adult" view="front" motion="idle" size={120} testId="preview" />));
    expect(screen.getByTestId('preview')).toHaveAttribute('data-stage', 'failed');
    expect(screen.getByTestId('preview-note')).toHaveTextContent('The 3D preview could not start on this device.');
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(screen.getByTestId('room-ok')).toBeInTheDocument();
    expect(runtimeErrors()[0]).toMatchObject({ kind: 'render', message: 'Error: the GPU said no' });
  });
});

describe('the introduction\'s cards choose the look', () => {
  it('a tap selects a card, the selection is marked and moves, and Let\'s explore hands it over', () => {
    const onExplore = vi.fn();
    render(<RoomIntro open blobbi={adult()} appearance="2d" unavailable3d={null} onExplore={onExplore} />);
    const classic = screen.getByTestId('mode-intro-preview-2d');
    const model = screen.getByTestId('mode-intro-preview-3d');
    expect(screen.getByRole('radiogroup')).toBe(screen.getByTestId('mode-intro-previews'));
    expect(classic).toHaveAttribute('aria-checked', 'true');
    expect(model).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(model);
    expect(model).toHaveAttribute('aria-checked', 'true');
    expect(model).toHaveClass('mode-intro__preview--on');
    expect(within(model).getByTestId('mode-intro-selected-3d')).toHaveTextContent('Selected');
    expect(classic).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('mode-intro-selected-2d')).toBeNull();
    fireEvent.click(screen.getByTestId('mode-intro-explore'));
    expect(onExplore).toHaveBeenCalledWith(true, '3d');
  });

  it('Classic can be chosen back, and an untouched choice hands over nothing (the look in force stays)', () => {
    const onExplore = vi.fn();
    const { unmount } = render(<RoomIntro open blobbi={adult()} appearance="3d" unavailable3d={null} onExplore={onExplore} />);
    expect(screen.getByTestId('mode-intro-preview-3d')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('mode-intro-preview-2d'));
    expect(screen.getByTestId('mode-intro-previews')).toHaveAttribute('data-selected', '2d');
    fireEvent.click(screen.getByTestId('mode-intro-explore'));
    expect(onExplore).toHaveBeenLastCalledWith(true, '2d');
    unmount();
    render(<RoomIntro open blobbi={adult()} appearance="3d" unavailable3d={null} onExplore={onExplore} />);
    fireEvent.click(screen.getByTestId('mode-intro-explore'));
    expect(onExplore).toHaveBeenLastCalledWith(true, null);
  });

  it('the arrow keys move the selection, as in any radio group', () => {
    render(<RoomIntro open blobbi={adult()} appearance="2d" unavailable3d={null} onExplore={() => {}} />);
    fireEvent.keyDown(screen.getByTestId('mode-intro-preview-2d'), { key: 'ArrowRight' });
    expect(screen.getByTestId('mode-intro-preview-3d')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('mode-intro-preview-3d')).toHaveFocus();
  });

  it('without a model the 3D card is not selectable, and a tap on it says why instead of doing nothing', () => {
    const onExplore = vi.fn();
    render(<RoomIntro open blobbi={egg()} appearance="2d" unavailable3d="An egg is always drawn in 2D. 3D comes once it hatches." onExplore={onExplore} />);
    const model = screen.getByTestId('mode-intro-preview-3d');
    expect(model).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByTestId('mode-intro-3d-refused')).toBeNull();
    fireEvent.click(model);
    expect(model).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('mode-intro-preview-2d')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('mode-intro-3d-refused')).toHaveTextContent('3D Model can’t be chosen yet. The 3D model is ready once Brook hatches.');
    expect(screen.getByTestId('mode-intro-3d-refused')).toHaveAttribute('role', 'status');
    // Choosing Classic clears the line; nothing is handed over that was not chosen
    fireEvent.click(screen.getByTestId('mode-intro-preview-2d'));
    expect(screen.queryByTestId('mode-intro-3d-refused')).toBeNull();
    fireEvent.click(screen.getByTestId('mode-intro-explore'));
    expect(onExplore).toHaveBeenCalledWith(true, '2d');
  });

  it('without WebGL the 3D card is not selectable either, and says the browser cannot draw it', () => {
    gl.pretend = false;
    render(<RoomIntro open blobbi={adult()} appearance="2d" unavailable3d={null} onExplore={() => {}} />);
    fireEvent.click(screen.getByTestId('mode-intro-preview-3d'));
    expect(screen.getByTestId('mode-intro-preview-3d')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('mode-intro-3d-refused')).toHaveTextContent(/cannot draw 3D/);
  });
});

describe('the room on a phone, end to end', () => {
  beforeEach(() => {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [adultEvent()];
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
  });

  it('choosing 3D Model in the introduction and exploring: no crash, the look kept on this device, nothing published', async () => {
    quietErrors();
    renderApp();
    const dialog = await screen.findByTestId('mode-intro');
    // The 3D preview becomes ready in an effect after it mounts: waited for, still required
    await waitFor(() => expect(within(dialog).getByTestId('mode-intro-stage-3d')).toHaveAttribute('data-stage', 'ready'));
    const held = heldState();
    fireEvent.click(within(dialog).getByTestId('mode-intro-preview-3d'));
    fireEvent.click(within(dialog).getByTestId('mode-intro-explore'));
    await waitFor(() => expect(screen.queryByTestId('mode-intro')).toBeNull());
    act(() => runFrames());
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(screen.getByTestId('room-shell')).toBeInTheDocument();
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('3d');
    expect(localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBe('seen');
    expectKept(held);
    expect(runtimeErrors().filter((e) => e.kind === 'render')).toEqual([]);
    expect(relay.published).toEqual([]);
  });

  it('choosing Classic over a 3D look in force is kept too', async () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, '3d');
    renderApp();
    const dialog = await screen.findByTestId('mode-intro');
    fireEvent.click(within(dialog).getByTestId('mode-intro-preview-2d'));
    fireEvent.click(within(dialog).getByTestId('mode-intro-explore'));
    await waitFor(() => expect(screen.queryByTestId('mode-intro')).toBeNull());
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('2d');
    expect(screen.queryByTestId('room-crash')).toBeNull();
  });

  it('a room that crashes: Go to the 2D home lands there with the same Blobbi, stays there, and keeps everything', async () => {
    quietErrors();
    crash.on = true;
    renderApp();
    const card = await screen.findByTestId('room-crash');
    expect(card).toHaveTextContent('the room broke');
    const held = heldState();
    expect(Object.keys(held).length).toBeGreaterThan(0);
    fireEvent.click(within(card).getByTestId('room-crash-classic'));
    // The 2D home, with the same Blobbi, and not sent back to the room although the device opened on it
    expect(await screen.findByTestId('hud-name')).toHaveTextContent('Brook');
    expect(screen.queryByTestId('room-preview')).toBeNull();
    expect(localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('classic');
    expectKept(held);
    expect(relay.published).toEqual([]);
  });

  it('Try again is offered twice; a room that keeps failing leaves only the way out, so nothing loops', async () => {
    quietErrors();
    crash.on = true;
    renderApp();
    for (let i = 0; i < 2; i++) {
      const card = await screen.findByTestId('room-crash');
      fireEvent.click(within(card).getByTestId('room-crash-retry'));
    }
    const card = await screen.findByTestId('room-crash');
    expect(within(card).queryByTestId('room-crash-retry')).toBeNull();
    expect(within(card).queryByTestId('room-crash-2d')).toBeNull();
    expect(within(card).getByTestId('room-crash-spent')).toHaveTextContent('Your Blobbi is waiting in the 2D home.');
    expect(within(card).getByTestId('room-crash-classic')).toBeInTheDocument();
  });

  it('a room that recovers on Try again is the same Blobbi\'s room, nothing published', async () => {
    quietErrors();
    crash.on = true;
    renderApp();
    const card = await screen.findByTestId('room-crash');
    crash.on = false;
    fireEvent.click(within(card).getByTestId('room-crash-retry'));
    expect(await screen.findByTestId('room-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(relay.published).toEqual([]);
  });
});
