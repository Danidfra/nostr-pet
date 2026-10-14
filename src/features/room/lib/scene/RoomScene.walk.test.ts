/**
 * The engine's walking contract, on the real RoomScene with three's WebGL
 * renderer stubbed (jsdom has no GPU) and time under control: a request
 * resolves how the walk ended, the walker faces the way it goes and front
 * on arrival, nothing bobs the anchor while it walks, the pace is the one
 * it is given, and every way a walk can be cut short settles its promise.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    shadowMap = { enabled: false, type: 0, autoUpdate: false, needsUpdate: false };
    toneMapping = 0;
    domElement = document.createElement('canvas');
    capabilities = { getMaxAnisotropy: () => 1 };
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    compileAsync() { return Promise.resolve(); }
    render() {}
    dispose() {}
    forceContextLoss() {}
    getContext() { return { isContextLost: () => false }; }
  }
  return { ...three, WebGLRenderer: FakeRenderer };
});

import { roomLayoutFor } from '../room-layout';
import { MAIN_BLOBBI, ROOM_GRID } from '../room-geometry';
import type { RoomScene as RoomSceneType } from './RoomScene';

/** A Canvas 2D context that accepts every call: the paper textures paint into it and nothing reads it back. */
function fake2d(canvas: HTMLCanvasElement) {
  const state: Record<string, unknown> = {};
  return new Proxy(state, {
    get(target, key: string) {
      if (key === 'canvas') return canvas;
      if (key === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (key === 'measureText') return () => ({ width: 0 });
      if (key in target) return target[key];
      return () => undefined;
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let reduced = false;
let RoomScene: typeof RoomSceneType;
let scenes: RoomSceneType[] = [];

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? fake2d(this) : null;
  } as unknown as HTMLCanvasElement['getContext'];
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({ matches: query.includes('reduced-motion') && reduced, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }),
  });
  ({ RoomScene } = await import('./RoomScene'));
});

beforeEach(() => {
  reduced = false;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
});

afterEach(() => {
  for (const s of scenes) s.dispose();
  scenes = [];
  vi.useRealTimers();
});

const GEOMETRY = { width: 400, height: 700, stage: { left: 0, top: 0, width: 400, height: 700 } };
const ADULT = { visible: true, isEgg: false, tiles: 3.8, sleeping: false, walkSpeed: 2 };

/** A room with nothing in it and the user's Blobbi standing near the middle (tile 4,4). */
async function room(blobbi = ADULT) {
  const scene = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(scene);
  scene.setGeometry(GEOMETRY);
  scene.setLayout(roomLayoutFor('home'));
  scene.setItems([], true);
  scene.setBlobbi(blobbi);
  await frames(2);
  return scene;
}

/** Let the scene draw `n` frames (16 ms each). */
async function frames(n: number) {
  await vi.advanceTimersByTimeAsync(16 * n);
}

/** Draw frames until a walk has ended (or far too many have passed). */
async function finish(walk: Promise<string>): Promise<string> {
  let outcome: string | undefined;
  void walk.then((o) => { outcome = o; });
  for (let i = 0; i < 1200 && outcome === undefined; i++) await frames(1);
  return outcome ?? 'never';
}

const where = (scene: RoomSceneType) => {
  const feet = scene.projectBlobbi(MAIN_BLOBBI)!;
  return feet;
};

describe('a walk request', () => {
  it('resolves arrived once the Blobbi is there, walking at its pace, facing the way it goes and front on arrival', async () => {
    const scene = await room();
    expect(scene.isWalking()).toBe(false);
    expect(scene.facingOf()).toBe('front');
    // From (4.5, 4.5) to the far corner (-x, -z): away from the viewer, three tiles each way
    const walk = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    let settled: string | null = null;
    void walk.then((o) => { settled = o; });
    await frames(1);
    expect(scene.isWalking()).toBe(true);
    expect(scene.facingOf()).toBe('back');
    expect(settled).toBeNull();
    // Six tiles at two tiles a second: three seconds, no sooner
    await frames(60);
    expect(scene.isWalking()).toBe(true);
    expect(settled).toBeNull();
    await frames(140);
    expect(await walk).toBe('arrived');
    expect(scene.isWalking()).toBe(false);
    expect(scene.facingOf()).toBe('front');
    const feet = where(scene);
    const target = scene.projectFloor(1.5, 1.5)!;
    expect(feet.x).toBeCloseTo(target.x, 3);
    expect(feet.y).toBeCloseTo(target.y, 3);
  });

  it('keeps the feet on the floor while walking: the anchor never bobs', async () => {
    const scene = await room();
    const walk = scene.requestWalk(MAIN_BLOBBI, 7.5, 7.5);
    for (let i = 0; i < 30; i++) {
      await frames(2);
      // The anchor is the projection of the feet at floor height: no hop above it
      const feet = where(scene);
      const tiles = (scene as unknown as { actors: Map<string, { x: number; z: number; hop: number }> }).actors.get(MAIN_BLOBBI)!;
      expect(tiles.hop).toBe(0);
      const floor = scene.projectFloor(tiles.x, tiles.z)!;
      expect(feet.y).toBeCloseTo(floor.y, 6);
    }
    expect(await finish(walk)).toBe('arrived');
  });

  it('faces toward the viewer going toward it, away going away, and a screen side going there, by the room\'s facing rule', async () => {
    const scene = await room();
    const seen = async (walk: Promise<string>) => {
      const facings = new Set<string>();
      let outcome: string | undefined;
      void walk.then((o) => { outcome = o; });
      for (let i = 0; i < 1200 && outcome === undefined; i++) {
        await frames(1);
        if (scene.isWalking()) facings.add(scene.facingOf());
      }
      expect(outcome).toBe('arrived');
      return facings;
    };
    // +x +z: toward the viewer, front the whole way; back to the middle is away: the back
    expect([...await seen(scene.requestWalk(MAIN_BLOBBI, 7.5, 7.5))]).toEqual(['front']);
    expect([...await seen(scene.requestWalk(MAIN_BLOBBI, 4.5, 4.5))]).toEqual(['back']);
    // -x +z is screen left. The path is Ditto's: one tile axis, then the other (an L, not a
    // staircase), and each leg is a screen diagonal: away-and-left first (the back), then
    // toward-and-left, which from the back turns to the left profile. Never the other side.
    const left = await seen(scene.requestWalk(MAIN_BLOBBI, 1.5, 7.5));
    expect(left.has('left')).toBe(true);
    expect(left.has('right')).toBe(false);
    expect([...left].every((f) => f === 'left' || f === 'back')).toBe(true);
    await seen(scene.requestWalk(MAIN_BLOBBI, 4.5, 4.5));
    // +x -z is screen right: toward-and-right first (the front holds), then away-and-right, the right profile
    const right = await seen(scene.requestWalk(MAIN_BLOBBI, 7.5, 1.5));
    expect(right.has('right')).toBe(true);
    expect(right.has('left')).toBe(false);
    expect([...right].every((f) => f === 'right' || f === 'front')).toBe(true);
    expect(scene.facingOf()).toBe('front');
  });

  it('a newer request settles the older one replaced; the Blobbi goes where it was last sent', async () => {
    const scene = await room();
    const first = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(10);
    const second = scene.requestWalk(MAIN_BLOBBI, 7.5, 7.5);
    expect(await first).toBe('replaced');
    expect(await finish(second)).toBe('arrived');
    const feet = where(scene);
    const target = scene.projectFloor(7.5, 7.5)!;
    expect(feet.x).toBeCloseTo(target.x, 3);
  });

  it('a tap on the floor (walkTo) replaces a walk in progress too', async () => {
    const scene = await room();
    const first = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5, 'approach');
    await frames(5);
    scene.walkTo(7.5, 7.5);
    expect(await first).toBe('replaced');
  });

  it('a stop settles it stopped, where it stands, facing front', async () => {
    const scene = await room();
    const walk = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(10);
    const before = where(scene);
    scene.stopWalk();
    expect(await walk).toBe('stopped');
    expect(scene.isWalking()).toBe(false);
    await frames(2);
    expect(scene.facingOf()).toBe('front');
    expect(where(scene).x).toBeCloseTo(before.x, 3);
  });

  it('coming into another room settles it stopped; so do decorating, going away and disposal', async () => {
    const scene = await room();
    const switched = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(5);
    scene.setItems([], true);
    expect(await switched).toBe('stopped');
    expect(scene.isWalking()).toBe(false);

    const decorating = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(5);
    scene.setEditing(true, null);
    expect(await decorating).toBe('stopped');
    scene.setEditing(false, null);

    const away = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(5);
    scene.setBlobbi({ ...ADULT, visible: false });
    expect(await away).toBe('stopped');
    scene.setBlobbi(ADULT);

    const disposed = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(5);
    scene.dispose();
    scenes = [];
    expect(await disposed).toBe('stopped');
  });

  it('is refused for an egg, a sleeper, while decorating, and for a target off the floor', async () => {
    const egg = await room({ ...ADULT, isEgg: true, tiles: 1.7 });
    expect(await egg.requestWalk(MAIN_BLOBBI, 1.5, 1.5)).toBe('refused');
    expect(egg.canWalkNow()).toBe(false);
    const sleeper = await room({ ...ADULT, sleeping: true });
    expect(await sleeper.requestWalk(MAIN_BLOBBI, 1.5, 1.5)).toBe('refused');
    const scene = await room();
    scene.setEditing(true, null);
    expect(await scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5)).toBe('refused');
    scene.setEditing(false, null);
    expect(scene.canWalkNow()).toBe(true);
    // Beyond the room: the nearest free tile is used, so this still walks
    expect(await finish(scene.requestWalk(MAIN_BLOBBI, ROOM_GRID + 5, ROOM_GRID + 5))).toBe('arrived');
  });

  it('arrives at once where it already stands, and under reduced motion is taken straight there', async () => {
    const scene = await room();
    expect(await scene.requestWalk(MAIN_BLOBBI, 4.5, 4.5)).toBe('arrived');
    expect(scene.isWalking()).toBe(false);
    reduced = true;
    const quiet = await room();
    expect(await quiet.requestWalk(MAIN_BLOBBI, 1.5, 1.5)).toBe('arrived');
    expect(quiet.isWalking()).toBe(false);
    expect(quiet.facingOf()).toBe('front');
    await frames(2);
    const feet = where(quiet);
    const target = quiet.projectFloor(1.5, 1.5)!;
    expect(feet.x).toBeCloseTo(target.x, 3);
  });

  it('walks at the pace it is given: a slower Blobbi takes proportionally longer', async () => {
    const quick = await room({ ...ADULT, walkSpeed: 4 });
    const slow = await room({ ...ADULT, walkSpeed: 1 });
    let quickDone = false;
    let slowDone = false;
    void quick.requestWalk(MAIN_BLOBBI, 1.5, 1.5).then(() => { quickDone = true; });
    void slow.requestWalk(MAIN_BLOBBI, 1.5, 1.5).then(() => { slowDone = true; });
    // Six tiles: 1.5 s at 4 tiles/s, 6 s at 1 tile/s
    await frames(110);
    expect(quickDone).toBe(true);
    expect(slowDone).toBe(false);
    await frames(300);
    expect(slowDone).toBe(true);
  });
});
