/**
 * The props in the scene: a dish and a ball built among the furniture, a
 * ball that rolls when kicked (and stays a thing on the floor), bites that
 * redraw the food, a tap that finds a prop, props that leave and go, and the
 * one the scene draws over a page-drawn Blobbi when it is nearer the camera.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    shadowMap = { enabled: false, type: 0, autoUpdate: false, needsUpdate: false };
    toneMapping = 0;
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

import { roomLayoutFor } from '../room-layout';
import { ROOM_GRID } from '../room-geometry';
import { resolveFurniture, isOfficialFurnitureId } from '../furniture-3d';
import { roomFurnitureFor } from '../room-furniture';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import { BALL } from '../ball-physics';
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
const G = ROOM_GRID;

async function scene() {
  const s = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(s);
  s.setGeometry(STAGE);
  s.setLayout(roomLayoutFor('home'));
  s.setItems(roomFurnitureFor('home').map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement } as SceneItem;
  }), false, { x: 2.5, z: 2.5 });
  s.setBlobbi({ visible: true, isEgg: false, tiles: 3.35, sleeping: false, walkSpeed: 2 });
  await vi.advanceTimersByTimeAsync(50);
  return s;
}
const frames = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('props in the scene', () => {
  it('a dish and a ball are things in the room: where they were set down, found by a tap, gone when no longer listed', async () => {
    const s = await scene();
    s.setProps([
      { id: 'dish-1', kind: 'dish', x: 3.5, z: 4, food: { emoji: '🍎' }, bites: { taken: 0, of: 4 } },
      { id: 'ball-1', kind: 'ball', x: 6, z: 6 },
    ]);
    await frames(600);
    expect(s.propPosition('dish-1')).toEqual({ x: 3.5, z: 4 });
    expect(s.propPosition('ball-1')).toEqual({ x: 6, z: 6 });
    expect(s.propResting('dish-1')).toBe(true);
    // A tap on each finds it before the floor under it
    const dish = s.projectFloor(3.5, 4)!;
    expect(s.pick(dish.x, dish.y - dish.pxPerTile * 0.3)).toEqual({ kind: 'prop', id: 'dish-1' });
    const ball = s.projectFloor(6, 6)!;
    expect(s.pick(ball.x, ball.y - ball.pxPerTile * BALL.radius)).toEqual({ kind: 'prop', id: 'ball-1' });
    // A tap elsewhere is still the floor
    expect(s.pick(s.projectFloor(1, 7)!.x, s.projectFloor(1, 7)!.y)?.kind).toBe('floor');
    s.setProps([]);
    expect(s.propPosition('dish-1')).toBeNull();
    expect(s.propPosition('ball-1')).toBeNull();
    expect(s.pick(dish.x, dish.y - dish.pxPerTile * 0.3)?.kind).not.toBe('prop');
  });

  it('a ball set down drops in and settles; kicked, it rolls the way it was sent, slows, and the scene says when it rests', async () => {
    const s = await scene();
    const rests: string[] = [];
    s.onPropRest = (id) => rests.push(id);
    s.setProps([{ id: 'ball-1', kind: 'ball', x: 4, z: 4 }]);
    expect(s.propResting('ball-1')).toBe(false);
    await frames(1500);
    expect(s.propResting('ball-1')).toBe(true);
    expect(rests).toEqual(['ball-1']);
    expect(s.propPosition('ball-1')).toEqual({ x: 4, z: 4 });
    expect(s.kickProp('ball-1', { x: 0, z: 1 }, 3)).toBe(true);
    expect(s.propResting('ball-1')).toBe(false);
    await frames(300);
    const mid = s.propPosition('ball-1')!;
    expect(mid.z).toBeGreaterThan(4.3);
    expect(mid.x).toBeCloseTo(4, 3);
    await frames(4000);
    expect(s.propResting('ball-1')).toBe(true);
    expect(rests).toEqual(['ball-1', 'ball-1']);
    const end = s.propPosition('ball-1')!;
    expect(end.z).toBeGreaterThan(mid.z);
    expect(end.z).toBeLessThanOrEqual(G - BALL.radius);
    // Kicking a dish does nothing; kicking what is not there neither
    s.setProps([{ id: 'ball-1', kind: 'ball', x: 4, z: 4 }, { id: 'dish-1', kind: 'dish', x: 2, z: 2, food: { emoji: '🍕' } }]);
    expect(s.kickProp('dish-1', { x: 1, z: 0 }, 3)).toBe(false);
    expect(s.kickProp('nothing', { x: 1, z: 0 }, 3)).toBe(false);
  });

  it('a ball keeps its own place: relisting it with where it was set down does not move it back', async () => {
    const s = await scene();
    s.setProps([{ id: 'ball-1', kind: 'ball', x: 4, z: 4 }]);
    await frames(1500);
    s.kickProp('ball-1', { x: 1, z: 0 }, 3);
    await frames(4000);
    const rolled = s.propPosition('ball-1')!;
    expect(rolled.x).toBeGreaterThan(4.5);
    s.setProps([{ id: 'ball-1', kind: 'ball', x: 4, z: 4 }]);
    expect(s.propPosition('ball-1')).toEqual(rolled);
  });

  it('a ball bounces off the furniture and the walls rather than passing through, and never leaves the floor', async () => {
    const s = await scene();
    s.setProps([{ id: 'ball-1', kind: 'ball', x: 1, z: 4 }]);
    await frames(1500);
    // Toward the back wall at x = 0
    s.kickProp('ball-1', { x: -1, z: 0 }, 5);
    const trail: { x: number; z: number }[] = [];
    for (let i = 0; i < 120; i++) {
      await frames(16);
      trail.push(s.propPosition('ball-1')!);
    }
    for (const p of trail) {
      expect(p.x).toBeGreaterThanOrEqual(BALL.radius - 1e-6);
      expect(p.x).toBeLessThanOrEqual(G - BALL.radius + 1e-6);
      expect(p.z).toBeGreaterThanOrEqual(BALL.radius - 1e-6);
      expect(p.z).toBeLessThanOrEqual(G - BALL.radius + 1e-6);
      // Never inside a piece of furniture
      expect(s.tileFree(p.x, p.z)).toBe(true);
    }
    // It came back off the wall
    expect(trail[trail.length - 1].x).toBeGreaterThan(BALL.radius + 0.2);
  });

  it('a dish shows the food whole, then with each bite less of it, and nothing when it is eaten up; a leaving prop shrinks away', async () => {
    const s = await scene();
    s.setProps([{ id: 'dish-1', kind: 'dish', x: 3, z: 3, food: { emoji: '🍔' }, bites: { taken: 0, of: 4 } }]);
    await frames(500);
    const food = () => (s as unknown as { props: Map<string, { dish?: { food: { visible: boolean }; bites: number }; root: { scale: { x: number } } }> }).props.get('dish-1')!;
    expect(food().dish!.bites).toBe(0);
    expect(food().dish!.food.visible).toBe(true);
    for (let taken = 1; taken <= 4; taken++) {
      s.setProps([{ id: 'dish-1', kind: 'dish', x: 3, z: 3, food: { emoji: '🍔' }, bites: { taken, of: 4 } }]);
      expect(food().dish!.bites).toBe(taken);
    }
    expect(food().dish!.food.visible).toBe(false);
    s.setProps([{ id: 'dish-1', kind: 'dish', x: 3, z: 3, food: { emoji: '🍔' }, bites: { taken: 4, of: 4 }, leaving: true }]);
    await frames(240);
    const half = food().root.scale.x;
    expect(half).toBeLessThan(1);
    await frames(400);
    expect(food().root.scale.x).toBeLessThan(half);
  });

  it('a prop nearer the camera than the page-drawn Blobbi is drawn over it (the overlay pass); one behind is not', async () => {
    const s = await scene();
    // The Blobbi stands at (2.5, 2.5): a ball at (6, 6) is in front of it, a dish at (0.8, 0.8) behind it
    s.setProps([{ id: 'ball-1', kind: 'ball', x: 6, z: 6 }, { id: 'dish-1', kind: 'dish', x: 0.8, z: 0.8, food: { emoji: '🍎' } }]);
    await frames(1500);
    const props = (s as unknown as { props: Map<string, { front: boolean }> }).props;
    expect(props.get('ball-1')!.front).toBe(true);
    expect(props.get('dish-1')!.front).toBe(false);
  });
});
