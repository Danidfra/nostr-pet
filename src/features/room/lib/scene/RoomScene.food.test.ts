/**
 * Food in the scene, and standing by it: an official food is a modelled
 * object on its dish (the right model for the item, light: a few meshes
 * each), bites move its clipping planes into place and bring crumbs out,
 * the last bite leaves the plate empty; a food with no model keeps its
 * picture. A Blobbi coming to a dish or a ball stands its reach and the
 * thing's size clear of it, on the far side from the camera, never on its
 * tile; a smaller Blobbi stands nearer; a thing against a wall is still
 * approached from a free side.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    shadowMap = { enabled: false, type: 0, autoUpdate: false, needsUpdate: false };
    toneMapping = 0;
    localClippingEnabled = false;
    domElement = document.createElement('canvas');
    capabilities = { getMaxAnisotropy: () => 1 };
    info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 }, programs: [] };
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    getPixelRatio() { return 1; }
    compileAsync() { return Promise.resolve(); }
    render() {}
    dispose() {}
    forceContextLoss() {}
    getContext() { return { isContextLost: () => false }; }
  }
  return { ...three, WebGLRenderer: FakeRenderer };
});

import * as THREE from 'three';
import { roomLayoutFor } from '../room-layout';
import { resolveFurniture, isOfficialFurnitureId } from '../furniture-3d';
import { roomFurnitureFor } from '../room-furniture';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import { blobbiReachTiles } from '../room-geometry';
import { PROP_GAP, PROP_RADIUS } from '../room-props';
import { FOOD_MODELS, buildFoodModel, foodModelFor, type FoodModelKind } from './food-models';
import type { RoomScene as RoomSceneType, SceneGeometry, SceneItem } from './RoomScene';

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

const STAGE: SceneGeometry = { width: 980, height: 820, stage: { left: 0, top: 120, width: 980, height: 620 }, behindTop: 0 };
type Dish = { dish?: { model: { kind: string; root: THREE.Group } | null; planes: THREE.Plane[]; crumbs: THREE.Mesh[]; food: THREE.Object3D } };
const inside = (s: RoomSceneType) => s as unknown as { props: Map<string, Dish> };

async function scene(stage: 'adult' | 'baby' = 'adult', at = { x: 2.5, z: 2.5 }, room: 'home' | 'kitchen' = 'kitchen') {
  const s = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(s);
  s.setGeometry(STAGE);
  s.setLayout(roomLayoutFor(room));
  s.setItems(roomFurnitureFor(room).map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement } as SceneItem;
  }), false, at);
  const tiles = stage === 'adult' ? 3.35 : 2.4;
  s.setBlobbi({ visible: true, isEgg: false, tiles, sleeping: false, walkSpeed: 2, reach: blobbiReachTiles(stage) });
  // As the app has it: the Blobbi does not amble about by itself between the test's walks
  s.setMainWanders(false);
  await vi.advanceTimersByTimeAsync(50);
  return s;
}
const frames = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const meshes = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) n += 1; });
  return n;
};

describe('the food models', () => {
  it('every official food has one, chosen by the item\'s d; anything else has none and keeps its picture', () => {
    expect(foodModelFor('blobbi:food:apple')).toBe('apple');
    expect(foodModelFor('blobbi:food:burger')).toBe('burger');
    expect(foodModelFor('blobbi:food:pizza')).toBe('pizza');
    expect(foodModelFor('blobbi:food:cake')).toBe('cake');
    expect(foodModelFor('blobbi:food:sushi')).toBe('sushi');
    expect(foodModelFor('blobbi:energy:drink')).toBe('drink');
    expect(foodModelFor('farm:carrot')).toBeNull();
    expect(foodModelFor('blobbi:toy:ball')).toBeNull();
  });

  it('each is a handful of meshes with flat paper materials, its bites from directions the camera sees, and is freed whole', () => {
    for (const kind of Object.values(FOOD_MODELS) as FoodModelKind[]) {
      const m = buildFoodModel(kind);
      expect(m.kind).toBe(kind);
      expect(meshes(m.root), kind).toBeLessThanOrEqual(14);
      expect(m.radius, kind).toBeGreaterThan(0.2);
      expect(m.radius, kind).toBeLessThanOrEqual(0.95);
      for (const mat of m.materials) expect((mat as THREE.MeshStandardMaterial).roughness).toBeGreaterThan(0.3);
      if (kind === 'drink') expect(m.bites).toHaveLength(0);
      else {
        expect(m.bites.length).toBeGreaterThanOrEqual(4);
        // Every cut faces the camera's half of the room (its open corner, +x +z) or the top: visible bites
        for (const cut of m.bites) {
          const toward = cut.u.x + cut.u.z;
          if (kind === 'pizza' || kind === 'cake') expect(toward).toBeLessThan(0); // eaten from the tip, the slice shortening toward the crust
          else expect(toward + cut.u.y).toBeGreaterThan(-0.2);
        }
      }
      expect(m.plate).toBe(kind !== 'drink');
    }
  });
});

describe('a dish in the scene', () => {
  it('shows the modelled food whole, its planes out of the way; each bite moves a plane in and brings crumbs out; the last leaves the plate', async () => {
    const s = await scene();
    const prop = (taken: number, leaving = false) => ({ id: 'dish-1', kind: 'dish' as const, itemId: 'blobbi:food:apple', x: 4, z: 5, food: { emoji: '🍎' }, bites: { taken, of: 4 }, leaving });
    s.setProps([prop(0)]);
    await frames(500);
    const dish = inside(s).props.get('dish-1')!.dish!;
    expect(dish.model?.kind).toBe('apple');
    expect(dish.planes).toHaveLength(4);
    expect(dish.planes.every((p) => p.constant === 1e3)).toBe(true);
    expect(dish.crumbs.every((c) => !c.visible)).toBe(true);
    expect(dish.model!.root.visible).toBe(true);
    for (let taken = 1; taken <= 3; taken++) {
      s.setProps([prop(taken)]);
      await frames(300);
      const placed = dish.planes.filter((p) => p.constant !== 1e3);
      expect(placed).toHaveLength(taken);
      // The cut keeps the food's centre: a bite is a cap off its side, not the whole food
      const centre = dish.model!.root.getWorldPosition(new THREE.Vector3()).add(dish.model!.root.userData.centre as THREE.Vector3);
      for (const p of placed) expect(p.distanceToPoint(centre)).toBeGreaterThan(0);
      expect(dish.crumbs.filter((c) => c.visible)).toHaveLength(Math.min(6, taken * 2));
      expect(dish.model!.root.visible).toBe(true);
    }
    s.setProps([prop(4)]);
    await frames(100);
    expect(dish.model!.root.visible).toBe(false);
    expect(dish.crumbs.every((c) => !c.visible)).toBe(true);
    s.setProps([prop(4, true)]);
    await frames(600);
    expect(inside(s).props.get('dish-1')!.dish!.food).toBeDefined();
  });

  it('a drink has no plate and goes down in sips; a food with no model is its picture on the plate', async () => {
    const s = await scene();
    s.setProps([
      { id: 'drink', kind: 'dish', itemId: 'blobbi:energy:drink', x: 3, z: 5, food: { emoji: '🧃' }, bites: { taken: 0, of: 2 } },
      { id: 'carrot', kind: 'dish', itemId: 'farm:carrot', x: 5, z: 3, food: { emoji: '🥕' }, bites: { taken: 0, of: 4 } },
    ]);
    await frames(300);
    const drink = inside(s).props.get('drink')!.dish!;
    expect(drink.model?.kind).toBe('drink');
    expect(drink.planes).toHaveLength(0);
    const before = drink.model!.root.scale.x;
    s.setProps([{ id: 'drink', kind: 'dish', itemId: 'blobbi:energy:drink', x: 3, z: 5, food: { emoji: '🧃' }, bites: { taken: 1, of: 2 } }]);
    expect(drink.model!.root.scale.x).toBeLessThan(before);
    const carrot = inside(s).props.get('carrot');
    expect(carrot).toBeUndefined(); // gone: no longer listed
    s.setProps([{ id: 'carrot', kind: 'dish', itemId: 'farm:carrot', x: 5, z: 3, food: { emoji: '🥕' }, bites: { taken: 0, of: 4 } }]);
    const pictured = inside(s).props.get('carrot')!.dish!;
    expect(pictured.model).toBeNull();
    expect((pictured.food as THREE.Mesh).isMesh).toBe(true);
  });
});

describe('standing by a thing', () => {
  it('an adult comes to a dish and stands its reach and the dish clear of it, on the far side from the camera, never on its tile', async () => {
    const s = await scene('adult', { x: 2.5, z: 2.5 }, 'home');
    const dish = { x: 4.5, z: 4.5 };
    s.setProps([{ id: 'dish-1', kind: 'dish', itemId: 'blobbi:food:apple', x: dish.x, z: dish.z, food: {} }]);
    const clear = PROP_RADIUS.dish + PROP_GAP;
    const walk = s.requestWalk('main', dish.x, dish.z, 'approach', clear);
    await frames(6000);
    await expect(walk).resolves.toBe('arrived');
    const at = s.positionOf()!;
    const distance = Math.hypot(at.x - dish.x, at.z - dish.z);
    const wanted = blobbiReachTiles('adult').front + clear;
    expect(distance).toBeGreaterThanOrEqual(wanted * 0.95);
    expect(distance).toBeLessThanOrEqual(wanted * 1.3);
    expect([Math.floor(at.x), Math.floor(at.z)]).not.toEqual([4, 4]);
    // Behind it: farther from the camera (the open corner) than the dish
    expect(at.x + at.z).toBeLessThan(dish.x + dish.z);
  });

  it('a baby stands nearer than an adult; a thing in a corner is still reached from a free side; the plain approach is unchanged', async () => {
    const baby = await scene('baby', { x: 2.5, z: 2.5 }, 'home');
    const clear = PROP_RADIUS.ball + PROP_GAP;
    baby.setProps([{ id: 'ball-1', kind: 'ball', x: 4.5, z: 4.5 }]);
    await frames(1500);
    const walk = baby.requestWalk('main', 4.5, 4.5, 'approach', clear);
    await frames(6000);
    await expect(walk).resolves.toBe('arrived');
    const b = baby.positionOf()!;
    const babyDistance = Math.hypot(b.x - 4.5, b.z - 4.5);
    expect(babyDistance).toBeLessThan(blobbiReachTiles('adult').front + clear);
    expect(babyDistance).toBeGreaterThanOrEqual((blobbiReachTiles('baby').front + clear) * 0.95);
    // Against the back corner: behind it is a wall, so it comes from a side, still clear of it
    const adult = await scene('adult', { x: 5.5, z: 5.5 }, 'home');
    const corner = { x: 0.7, z: 0.7 };
    adult.setProps([{ id: 'ball-2', kind: 'ball', x: corner.x, z: corner.z }]);
    await frames(1500);
    const toCorner = adult.requestWalk('main', corner.x, corner.z, 'approach', clear);
    await frames(8000);
    await expect(toCorner).resolves.toBe('arrived');
    const a = adult.positionOf()!;
    expect(Math.hypot(a.x - corner.x, a.z - corner.z)).toBeGreaterThanOrEqual((blobbiReachTiles('adult').front + clear) * 0.8);
    expect([Math.floor(a.x), Math.floor(a.z)]).not.toEqual([0, 0]);
    // Without a size the old approach stands on the tile just behind the point
    const plain = await scene('adult', { x: 2.5, z: 2.5 }, 'home');
    const old = plain.requestWalk('main', 4.5, 4.5, 'approach');
    await frames(6000);
    await expect(old).resolves.toBe('arrived');
    const p = plain.positionOf()!;
    expect([Math.floor(p.x), Math.floor(p.z)]).toEqual([3, 3]);
  });
});
