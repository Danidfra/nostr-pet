/**
 * A Blobbi never reaches into a wall: on the real RoomScene (three's WebGL
 * renderer stubbed, time under control), wherever it is sent (a wall, a
 * corner, along a wall, an item set down by a wall, a bed against one, a
 * jump under reduced motion, growing up beside one), the point it stands on
 * stays at least its body's reach (`blobbiReachTiles`) from the back walls
 * and the floor's front edges, and no nearer than it must: it stops just
 * clear, not a tile away. Its walks still arrive.
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
import { MAIN_BLOBBI, ROOM_GRID, blobbiBoxTiles, blobbiReachTiles } from '../room-geometry';
import type { RoomScene as RoomSceneType, SceneItem } from './RoomScene';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import { isOfficialFurnitureId, resolveFurniture } from '../furniture-3d';
import type { FurniturePlacement } from '../room-furniture';

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
const G = ROOM_GRID;
/** Scene items from placements, as the hook builds them (`RoomScene.edit.test.ts`). */
function items(placements: FurniturePlacement[]): SceneItem[] {
  return placements.map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement };
  });
}
const blobbiOf = (stage: 'adult' | 'baby') => ({ visible: true, isEgg: false, tiles: blobbiBoxTiles(stage), sleeping: false, walkSpeed: 3, reach: blobbiReachTiles(stage) });

async function room(stage: 'adult' | 'baby', placements: FurniturePlacement[] = []) {
  const scene = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(scene);
  scene.setGeometry(GEOMETRY);
  scene.setLayout(roomLayoutFor('home'));
  scene.setItems(items(placements), true);
  scene.setBlobbi(blobbiOf(stage));
  await frames(2);
  return scene;
}

async function frames(n: number) {
  await vi.advanceTimersByTimeAsync(16 * n);
}

/** Draw frames until the walk ends, sampling where the Blobbi stands on each. */
async function follow(scene: RoomSceneType, walk: Promise<string>): Promise<{ outcome: string; seen: { x: number; z: number }[] }> {
  let outcome: string | undefined;
  void walk.then((o) => { outcome = o; });
  const seen: { x: number; z: number }[] = [];
  for (let i = 0; i < 1500 && outcome === undefined; i++) {
    await frames(1);
    seen.push(scene.positionOf(MAIN_BLOBBI)!);
  }
  return { outcome: outcome ?? 'never', seen };
}

function expectClear(p: { x: number; z: number }, stage: 'adult' | 'baby') {
  const reach = blobbiReachTiles(stage);
  expect(p.x).toBeGreaterThanOrEqual(reach.back - 1e-9);
  expect(p.z).toBeGreaterThanOrEqual(reach.back - 1e-9);
  expect(p.x).toBeLessThanOrEqual(G - reach.front + 1e-9);
  expect(p.z).toBeLessThanOrEqual(G - reach.front + 1e-9);
}

describe('a Blobbi beside the walls', () => {
  it('reaches about a tile from where it stands, more than the half tile a wall-side tile leaves: the reason it used to clip', () => {
    for (const stage of ['adult', 'baby'] as const) expect(blobbiReachTiles(stage).back).toBeGreaterThan(0.5);
    // The baby leans back from the camera in 3D, so it reaches further toward the back walls than toward the front
    expect(blobbiReachTiles('baby').back).toBeGreaterThan(blobbiReachTiles('baby').front);
  });

  it.each(['adult', 'baby'] as const)('the %s, sent to each wall and corner and to the open edges, never stands nearer than its reach, and stops right there', async (stage) => {
    const scene = await room(stage);
    const reach = blobbiReachTiles(stage);
    const targets = [
      { x: 0.2, z: 4.5, expect: { x: reach.back } },
      { x: 4.5, z: 0.2, expect: { z: reach.back } },
      { x: 0.2, z: 0.2, expect: { x: reach.back, z: reach.back } },
      { x: 7.9, z: 4.5, expect: { x: G - reach.front } },
      { x: 4.5, z: 7.9, expect: { z: G - reach.front } },
      { x: 0.2, z: 7.9, expect: { x: reach.back, z: G - reach.front } },
    ];
    for (const t of targets) {
      const { outcome, seen } = await follow(scene, scene.requestWalk(MAIN_BLOBBI, t.x, t.z));
      expect(outcome).toBe('arrived');
      for (const p of seen) expectClear(p, stage);
      const end = scene.positionOf(MAIN_BLOBBI)!;
      if (t.expect.x !== undefined) expect(end.x).toBeCloseTo(t.expect.x, 6);
      if (t.expect.z !== undefined) expect(end.z).toBeCloseTo(t.expect.z, 6);
    }
  });

  it('walks along a wall clear of it, from one corner to the other', async () => {
    const scene = await room('adult');
    await follow(scene, scene.requestWalk(MAIN_BLOBBI, 0.5, 7.5));
    const { outcome, seen } = await follow(scene, scene.requestWalk(MAIN_BLOBBI, 0.5, 0.5));
    expect(outcome).toBe('arrived');
    expect(seen.length).toBeGreaterThan(10);
    for (const p of seen) {
      expectClear(p, 'adult');
      // Along the wall, not bumping in and out of it
      expect(p.x).toBeCloseTo(blobbiReachTiles('adult').back, 6);
    }
  });

  it('approaching something set down by a wall still arrives, standing clear', async () => {
    const scene = await room('baby');
    const { outcome } = await follow(scene, scene.requestWalk(MAIN_BLOBBI, 0.6, 3, 'approach'));
    expect(outcome).toBe('arrived');
    expectClear(scene.positionOf(MAIN_BLOBBI)!, 'baby');
  });

  it('under reduced motion it is taken straight there, and still clear', async () => {
    reduced = true;
    const scene = await room('adult');
    expect(await scene.requestWalk(MAIN_BLOBBI, 0.1, 0.1)).toBe('arrived');
    const end = scene.positionOf(MAIN_BLOBBI)!;
    expect(end.x).toBeCloseTo(blobbiReachTiles('adult').back, 6);
    expect(end.z).toBeCloseTo(blobbiReachTiles('adult').back, 6);
  });

  it('a baby that grows up beside a wall steps clear of it; asleep on a bed against a wall it lies clear too', async () => {
    const scene = await room('baby');
    await follow(scene, scene.requestWalk(MAIN_BLOBBI, 0.2, 4.5));
    expect(scene.positionOf(MAIN_BLOBBI)!.x).toBeCloseTo(blobbiReachTiles('baby').back, 6);
    scene.setBlobbi(blobbiOf('adult'));
    expectClear(scene.positionOf(MAIN_BLOBBI)!, 'adult');
    const bed = await room('adult', [{ id: 'official:bed-single', at: 'floor', x: 0.75, y: 4 }]);
    bed.setBlobbi({ ...blobbiOf('adult'), sleeping: true });
    await frames(2);
    expectClear(bed.positionOf(MAIN_BLOBBI)!, 'adult');
  });

  it('the hover test for its name reaches above its head, where a tap would miss it: moving from body to name stays a hover', async () => {
    const scene = await room('adult');
    const feet = scene.projectBlobbi(MAIN_BLOBBI)!;
    const unit = feet.pxPerTile * blobbiBoxTiles('adult');
    // On the body: both a tap and a hover find it
    expect(scene.pick(feet.x, feet.y - unit * 0.4)).toEqual({ kind: 'actor', id: MAIN_BLOBBI });
    expect(scene.overActor(feet.x, feet.y - unit * 0.4)).toBe(true);
    // Just above the head, where the name shows: a hover, not a tap
    const aboveHead = feet.y - unit * 0.95;
    expect(scene.pick(feet.x, aboveHead)).not.toEqual({ kind: 'actor', id: MAIN_BLOBBI });
    expect(scene.overActor(feet.x, aboveHead)).toBe(true);
    // Well away: neither
    expect(scene.overActor(feet.x + unit, feet.y - unit * 0.4)).toBe(false);
  });
});
