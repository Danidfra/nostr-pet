/**
 * The scene's answer to "is the floor under this point free of furniture",
 * which the off-the-floor scenes ask along their walk. A point on a tile
 * boundary (the walk's samples land on them) and the tile the Blobbi itself
 * stands on are free; a tile under a piece is not. From the middle of each
 * default room, where the Blobbi lands after every change, the Invisible
 * Floor is the Invisible Floor and not the quick change it had quietly
 * become.
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
import { ROOM_GRID, blobbiReachTiles } from '../room-geometry';
import { resolveFurniture, isOfficialFurnitureId } from '../furniture-3d';
import { roomFurnitureFor, type FurniturePlacement } from '../room-furniture';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import { ROOM_ORDER, type RoomId } from '@/features/home/rooms/rooms';
import { choreograph } from '../room-transitions';
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

function items(placements: readonly FurniturePlacement[]): SceneItem[] {
  return placements.map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement };
  });
}

async function room(roomId: RoomId, placements: readonly FurniturePlacement[] = roomFurnitureFor(roomId)) {
  const scene = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(scene);
  scene.setGeometry({ width: 400, height: 700, stage: { left: 0, top: 80, width: 400, height: 540 } });
  scene.setLayout(roomLayoutFor(roomId));
  scene.setItems(items(placements), false);
  scene.setBlobbi({ visible: true, isEgg: false, tiles: 3.35, sleeping: false, walkSpeed: 2 });
  await vi.advanceTimersByTimeAsync(50);
  return scene;
}

const G = ROOM_GRID;
const MIDDLE = { x: G / 2 + 0.5, z: G / 2 + 0.5 };
const adultReach = Math.max(blobbiReachTiles('adult').front, blobbiReachTiles('adult').back);

describe('tileFree', () => {
  it('a tile under a piece is blocked; a point on a tile boundary between free tiles, and the tile the Blobbi stands on, are free', async () => {
    const scene = await room('home', [{ id: 'official:toybox', at: 'floor', x: 1.5, y: 1.5 }]);
    expect(scene.tileFree(1.5, 1.5)).toBe(false);
    // The boundary between (5, 4) and (6, 4): two nearest tiles at the same distance, both free
    expect(scene.tileFree(6, 4.5)).toBe(true);
    expect(scene.tileFree(4.5, 6)).toBe(true);
    // Where it stands itself is not furniture
    const at = scene.positionOf();
    expect(at).not.toBeNull();
    expect(scene.tileFree(at!.x, at!.z)).toBe(true);
    // Beyond the floor is open
    expect(scene.tileFree(G + 1, 4)).toBe(true);
  });

  it('the Invisible Floor is choreographed from the middle of every default room, and from every free tile', async () => {
    for (const roomId of ROOM_ORDER) {
      const scene = await room(roomId);
      const ctx = (from: { x: number; z: number }) => ({ from, to: MIDDLE, skyFrom: 12, skyTo: 12, reach: adultReach, choice: 0.3, isFree: (x: number, z: number) => scene.tileFree(x, z) });
      expect(choreograph('floor-gag', ctx(MIDDLE)).kind, roomId).toBe('floor-gag');
      let free = 0;
      for (let i = 0; i < G; i++) {
        for (let j = 0; j < G; j++) {
          if (!scene.tileFree(i + 0.5, j + 0.5)) continue;
          free += 1;
          expect(choreograph('floor-gag', ctx({ x: i + 0.5, z: j + 0.5 })).kind, `${roomId} ${i},${j}`).toBe('floor-gag');
        }
      }
      expect(free).toBeGreaterThan(40);
    }
  });

  it('a piece in the way of both edges still turns it into the quick change (the fallback stays)', async () => {
    const scene = await room('home', [
      { id: 'official:toybox', at: 'floor', x: 6, y: 3 },
      { id: 'official:toybox', at: 'floor', x: 6, y: 4 },
      { id: 'official:toybox', at: 'floor', x: 3, y: 6 },
      { id: 'official:toybox', at: 'floor', x: 4, y: 6 },
    ]);
    const kind = choreograph('floor-gag', { from: { x: 3.5, z: 3.5 }, to: MIDDLE, skyFrom: 12, skyTo: 12, reach: adultReach, choice: 0.3, isFree: (x, z) => scene.tileFree(x, z) }).kind;
    expect(kind).toBe('quick');
  });
});
