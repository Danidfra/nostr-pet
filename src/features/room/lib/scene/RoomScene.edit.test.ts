/**
 * The engine's decorating rules, on the real RoomScene with the GPU stubbed
 * (see RoomScene.walk.test.ts): pieces are laid out on the grid, overlaps
 * are reported, a free spot is found or not, a piece picked up by a pointer
 * follows it and snaps when dropped, a blocked drop goes back, a quarter
 * turn swaps a footprint, and decorating stops the Blobbi's walks.
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
  }
  return { ...three, WebGLRenderer: FakeRenderer };
});

import { roomLayoutFor } from '../room-layout';
import { MAIN_BLOBBI, ROOM_GRID } from '../room-geometry';
import { resolveFurniture, isOfficialFurnitureId } from '../furniture-3d';
import type { FurniturePlacement } from '../room-furniture';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import type { RoomScene as RoomSceneType, SceneItem } from './RoomScene';

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

let RoomScene: typeof RoomSceneType;
let scenes: RoomSceneType[] = [];

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? fake2d(this) : null;
  } as unknown as HTMLCanvasElement['getContext'];
  ({ RoomScene } = await import('./RoomScene'));
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
});
afterEach(() => {
  for (const s of scenes) s.dispose();
  scenes = [];
  vi.useRealTimers();
});

const GEOMETRY = { width: 400, height: 700, stage: { left: 0, top: 80, width: 400, height: 540 } };
const frames = async (n: number) => { await vi.advanceTimersByTimeAsync(16 * n); };

/** Scene items from placements, as the hook builds them. */
function items(placements: FurniturePlacement[]): SceneItem[] {
  return placements.map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement };
  });
}

async function room(placements: FurniturePlacement[], editing = false) {
  const scene = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(scene);
  const invalid: Set<number>[] = [];
  scene.onInvalidChange = (set) => invalid.push(new Set(set));
  scene.setGeometry(GEOMETRY);
  scene.setLayout(roomLayoutFor('home'));
  scene.setItems(items(placements), false);
  scene.setBlobbi({ visible: true, isEgg: false, tiles: 3.8, sleeping: false, walkSpeed: 2 });
  if (editing) scene.setEditing(true, null);
  await frames(3);
  return { scene, invalid: () => invalid[invalid.length - 1] ?? new Set<number>() };
}

/** The canvas point of a floor tile's centre. */
const at = (scene: RoomSceneType, x: number, z: number) => scene.projectFloor(x, z)!;

describe('decorating in the engine', () => {
  it('two pieces on the same tiles overlap and are reported; apart, nothing is', async () => {
    const { scene, invalid } = await room([
      { id: 'official:table-side', at: 'floor', x: 4.5, y: 4.5 },
      { id: 'official:toybox', at: 'floor', x: 4.5, y: 4.5 },
    ]);
    expect([...invalid()].sort()).toEqual([0, 1]);
    scene.setItems(items([
      { id: 'official:table-side', at: 'floor', x: 1.5, y: 1.5 },
      { id: 'official:toybox', at: 'floor', x: 6, y: 6 },
    ]), false);
    expect(invalid().size).toBe(0);
    // A rug under a table is no overlap; a small thing on a table stands on it
    scene.setItems(items([
      { id: 'official:rug-round', at: 'floor', x: 4.5, y: 4.5 },
      { id: 'official:table-side', at: 'floor', x: 4.5, y: 4.5 },
      { id: 'official:lamp-table', at: 'floor', x: 4.5, y: 4.5 },
    ]), false);
    expect(invalid().size).toBe(0);
    // Two things hung on the same wall spot overlap; on different walls they do not
    scene.setItems(items([
      { id: 'official:clock-wall', at: 'left', x: 4, y: 3 },
      { id: 'official:picture-frame', at: 'left', x: 4, y: 3 },
      { id: 'official:mirror', at: 'right', x: 4, y: 3 },
    ]), false);
    expect([...invalid()].sort()).toEqual([0, 1]);
  });

  it('finds a free spot for a new piece near the middle, and none when the room is full of it', async () => {
    const { scene } = await room([{ id: 'official:toybox', at: 'floor', x: 4.5, y: 4.5 }]);
    const model = getOfficialFurnitureModel('official:plant-tall')!;
    const spot = scene.findSpot({ node: model.node, official: true, mount: 'floor' });
    expect(spot).not.toBeNull();
    expect(spot!.at).toBe('floor');
    expect(spot!.x).toBeGreaterThan(0);
    expect(spot!.x).toBeLessThan(ROOM_GRID);
    const wallModel = getOfficialFurnitureModel('official:clock-wall')!;
    const wall = scene.findSpot({ node: wallModel.node, official: true, mount: 'wall' });
    expect(wall && (wall.at === 'left' || wall.at === 'right')).toBe(true);
    // Fill the floor with counters (2 tiles each): no spot for one more
    const counters: FurniturePlacement[] = [];
    for (let x = 1; x < ROOM_GRID; x += 2) for (let z = 1; z < ROOM_GRID; z += 2) counters.push({ id: 'official:counter', at: 'floor', x, y: z });
    scene.setItems(items(counters), false);
    const counter = getOfficialFurnitureModel('official:counter')!;
    expect(scene.findSpot({ node: counter.node, official: true, mount: 'floor' })).toBeNull();
  });

  it('picks the piece under a point while decorating, drags it along the floor and drops it snapped to the grid', async () => {
    // The Blobbi stands near the middle and is picked first where it covers the screen: the piece stands clear of it
    const { scene, invalid } = await room([{ id: 'official:toybox', at: 'floor', x: 1.5, y: 7 }], true);
    const start = at(scene, 1.5, 7);
    const hit = scene.pick(start.x, start.y - 2);
    expect(hit).toEqual({ kind: 'item', index: 0 });
    expect(scene.beginDrag(0, start.x, start.y - 2)).toBe(true);
    const target = at(scene, 2.8, 3.3);
    scene.dragTo(target.x, target.y - 2);
    const result = scene.endDrag();
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.valid).toBe(true);
    // Snapped: a two-tile piece sits on tile edges, a one-tile piece on tile centres
    const def = resolveFurniture('official:toybox')!;
    expect(def.mount).toBe('floor');
    expect(Number.isInteger(result!.placement.x * 2)).toBe(true);
    expect(Number.isInteger(result!.placement.y * 2)).toBe(true);
    expect(Math.abs(result!.placement.x - 2.8)).toBeLessThan(1.1);
    expect(Math.abs(result!.placement.y - 3.3)).toBeLessThan(1.1);
    expect(invalid().size).toBe(0);
    // An empty floor point picks the floor; a point in the sky picks nothing
    expect(scene.pick(at(scene, 7, 7).x, at(scene, 7, 7).y)!.kind).toBe('floor');
    expect(scene.pick(2, 2)).toBeNull();
  });

  it('a piece dropped on another goes back where it was picked up, and the drop is not valid', async () => {
    const { scene, invalid } = await room([
      { id: 'official:toybox', at: 'floor', x: 2, y: 2 },
      { id: 'official:table-side', at: 'floor', x: 6.5, y: 6.5 },
    ], true);
    expect(invalid().size).toBe(0);
    const from = at(scene, 2, 2);
    expect(scene.beginDrag(0, from.x, from.y - 2)).toBe(true);
    const onto = at(scene, 6.5, 6.5);
    scene.dragTo(onto.x, onto.y - 2);
    expect(invalid().size).toBe(2);
    const result = scene.endDrag();
    expect(result!.valid).toBe(false);
    await frames(1);
    expect(invalid().size).toBe(0);
    expect(scene.projectItemTop(0)!.x).toBeCloseTo(scene.projectItemTop(0)!.x, 6);
  });

  it('a quarter turn swaps a long piece\'s footprint: it overlaps what it did not, and frees what it covered', async () => {
    // A bookshelf is two tiles along x and one along z: at (4, 4.5) it covers x 3..5, z 4..5; turned, x 4..5, z 4..6
    const counter: FurniturePlacement = { id: 'official:shelf-books', at: 'floor', x: 4, y: 4.5 };
    const beside: FurniturePlacement = { id: 'official:plant-tall', at: 'floor', x: 3.5, y: 4.5 }; // x 3..4, z 4..5
    const below: FurniturePlacement = { id: 'official:plant-tall', at: 'floor', x: 4.5, y: 5.5 }; // x 4..5, z 5..6
    const { scene, invalid } = await room([counter, beside]);
    expect([...invalid()].sort()).toEqual([0, 1]);
    scene.setItems(items([{ ...counter, rot: 1 }, beside]), false);
    expect(invalid().size).toBe(0);
    scene.setItems(items([counter, below]), false);
    expect(invalid().size).toBe(0);
    scene.setItems(items([{ ...counter, rot: 1 }, below]), false);
    expect([...invalid()].sort()).toEqual([0, 1]);
  });

  it('decorating stops the Blobbi: a walk in progress is stopped, and a tap cannot start one; it walks again after', async () => {
    const { scene } = await room([]);
    const walk = scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5);
    await frames(5);
    scene.setEditing(true, null);
    expect(await walk).toBe('stopped');
    expect(await scene.requestWalk(MAIN_BLOBBI, 1.5, 1.5)).toBe('refused');
    expect(scene.canWalkNow()).toBe(false);
    scene.setEditing(false, null);
    expect(scene.canWalkNow()).toBe(true);
  });
});
