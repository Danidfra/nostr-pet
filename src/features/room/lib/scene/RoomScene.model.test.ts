/**
 * A 3D model standing in a Blobbi's place: the engine adds it to the scene,
 * moves and scales it with the Blobbi each frame, tells it how the Blobbi
 * moves and which way it heads (continuously, toward the camera at rest),
 * lets it cast the shadow instead of the proxy, and hands it back untouched
 * when it is taken away or the scene is disposed.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

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
import { CAMERA_AZIMUTH, MAIN_BLOBBI } from '../room-geometry';
import type { RoomScene as RoomSceneType } from './RoomScene';
import type { ActorFrame, ActorModel } from '../blobbi3d/actor';

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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }),
  });
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

const GEOMETRY = { width: 400, height: 700, stage: { left: 0, top: 0, width: 400, height: 700 } };
const ADULT = { visible: true, isEgg: false, tiles: 3.8, sleeping: false, walkSpeed: 2 };

async function room() {
  const scene = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(scene);
  scene.setGeometry(GEOMETRY);
  scene.setLayout(roomLayoutFor('home'));
  scene.setItems([], false);
  scene.setBlobbi(ADULT);
  await vi.advanceTimersByTimeAsync(50);
  return scene;
}

async function frames(n: number) {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(16);
}

function fakeModel(): ActorModel & { frames: ActorFrame[] } {
  const object = new THREE.Group();
  const frames: ActorFrame[] = [];
  return {
    object,
    box: 1,
    pace: 1,
    gaze: () => ({ x: 0, y: 0 }),
    frames,
    update(frame) {
      frames.push({ ...frame });
      return frame.motion !== 'still';
    },
    dispose: vi.fn(),
  };
}

function inner(scene: RoomSceneType) {
  return scene as unknown as { scene: THREE.Scene; actors: Map<string, { caster: THREE.Mesh; x: number; z: number; tiles: number }> };
}

describe('RoomScene.setActorModel', () => {
  it('puts the model in the scene where the Blobbi stands, scaled to its box, idle and facing the camera', async () => {
    const scene = await room();
    const model = fakeModel();
    scene.setActorModel(MAIN_BLOBBI, model);
    await frames(3);
    expect(inner(scene).scene.children).toContain(model.object);
    const actor = inner(scene).actors.get(MAIN_BLOBBI)!;
    expect(model.object.position.x).toBeCloseTo(actor.x);
    expect(model.object.position.z).toBeCloseTo(actor.z);
    expect(model.object.position.y).toBeCloseTo(0);
    expect(model.object.scale.x).toBeCloseTo(3.8);
    expect(model.frames.length).toBeGreaterThan(0);
    const last = model.frames[model.frames.length - 1];
    expect(last.motion).toBe('idle');
    expect(last.sleeping).toBe(false);
    expect(last.heading).toBeCloseTo(CAMERA_AZIMUTH);
    expect(last.dt).toBeGreaterThan(0);
    // The model casts the shadow now, not the proxy
    expect(actor.caster.castShadow).toBe(false);
  });

  it('keeps drawing frames while the model says it moves, and rests when it does not', async () => {
    const scene = await room();
    const model = fakeModel();
    scene.setActorModel(MAIN_BLOBBI, model);
    await frames(10);
    const idle = model.frames.length;
    expect(idle).toBeGreaterThan(5); // an idle model animates: a frame per tick
    scene.setBlobbi({ ...ADULT, sleeping: true });
    await frames(120); // the room's own sleep easing plays out
    const asleep = model.frames.filter((f) => f.sleeping);
    expect(asleep.length).toBeGreaterThan(0);
    expect(asleep.every((f) => f.motion === 'still')).toBe(true);
    const settled = model.frames.length;
    await frames(10);
    expect(model.frames.length).toBe(settled); // still: no frames drawn for nothing
  });

  it('tells the model it walks and which way, then idle and front again on arrival', async () => {
    const scene = await room();
    const model = fakeModel();
    scene.setActorModel(MAIN_BLOBBI, model);
    await frames(2);
    const from = { ...inner(scene).actors.get(MAIN_BLOBBI)! };
    const walk = scene.requestWalk(MAIN_BLOBBI, from.x + 2, from.z, 'to');
    await frames(8);
    const walking = model.frames.filter((f) => f.motion === 'walking');
    expect(walking.length).toBeGreaterThan(0);
    // Heading +x: yaw atan2(dx, dz) = π/2
    expect(walking[walking.length - 1].heading).toBeCloseTo(Math.PI / 2, 2);
    expect(model.object.position.x).toBeGreaterThan(from.x);
    await frames(120);
    await expect(walk).resolves.toBe('arrived');
    const last = model.frames[model.frames.length - 1];
    expect(last.motion).toBe('idle');
    expect(last.heading).toBeCloseTo(CAMERA_AZIMUTH);
    expect(scene.headingOf()).toBeCloseTo(CAMERA_AZIMUTH);
  });

  it('hands the model back untouched when replaced, removed or the scene is disposed', async () => {
    const scene = await room();
    const first = fakeModel();
    const second = fakeModel();
    scene.setActorModel(MAIN_BLOBBI, first);
    await frames(2);
    scene.setActorModel(MAIN_BLOBBI, second);
    await frames(2);
    expect(inner(scene).scene.children).not.toContain(first.object);
    expect(inner(scene).scene.children).toContain(second.object);
    expect(first.dispose).not.toHaveBeenCalled();
    scene.setActorModel(MAIN_BLOBBI, null);
    await frames(2);
    expect(inner(scene).scene.children).not.toContain(second.object);
    expect(inner(scene).actors.get(MAIN_BLOBBI)!.caster.castShadow).toBe(true);
    scene.setActorModel(MAIN_BLOBBI, second);
    scene.dispose();
    scenes.pop();
    expect(second.dispose).not.toHaveBeenCalled();
    expect(second.object.parent).toBeNull();
  });
});
