/**
 * The key light's shadow map and the overlay pass: a change of quality (a smaller map, or the shadow turned off
 * and on) is applied between the two passes, never before the overlay pass, so no draw ever runs with the map
 * taken away. three binds an empty placeholder to the shadow sampler then, which WebGL refuses ("texture format
 * and sampler type") and the front furniture drops for a frame.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';

/** Every draw: which pass (the camera's layer mask), whether the key light casts, and whether its map exists. */
const draws: { layers: number; cast: boolean; map: boolean }[] = [];

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
    render(scene: THREE.Scene, camera: THREE.Camera) {
      let light: THREE.DirectionalLight | undefined;
      scene.traverse((o) => {
        if ((o as THREE.DirectionalLight).isDirectionalLight) light = o as THREE.DirectionalLight;
      });
      // As three's WebGLShadowMap: the map is built only on a pass that updates shadows
      if (light && light.castShadow && this.shadowMap.enabled && (this.shadowMap.autoUpdate || this.shadowMap.needsUpdate)) {
        if (!light.shadow.map) light.shadow.map = { dispose() {} } as unknown as THREE.WebGLRenderTarget;
        this.shadowMap.needsUpdate = false;
      }
      draws.push({ layers: camera.layers.mask, cast: !!light?.castShadow, map: !!light?.shadow.map });
    }
    dispose() {}
    forceContextLoss() {}
    getContext() { return { isContextLost: () => false }; }
  }
  return { ...three, WebGLRenderer: FakeRenderer };
});

import { QUALITY } from '../room-quality';
import { roomLayoutFor } from '../room-layout';
import type { RoomScene as RoomSceneType } from './RoomScene';

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
  draws.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
});

afterEach(() => {
  for (const s of scenes) s.dispose();
  scenes = [];
  vi.useRealTimers();
});

const GEOMETRY = { width: 400, height: 700, stage: { left: 0, top: 0, width: 400, height: 700 } };
const ADULT = { visible: true, isEgg: false, tiles: 3.8, sleeping: false, walkSpeed: 2 };

async function frames(n: number) {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(16);
}

/** A room with the Blobbi drawn by the page and a ball in front of it: every frame has an overlay pass. */
async function roomWithFront() {
  const scene = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(scene);
  scene.setGeometry(GEOMETRY);
  scene.setLayout(roomLayoutFor('home'));
  scene.setItems([], false);
  scene.setBlobbi(ADULT);
  scene.setProps([{ id: 'ball-1', kind: 'ball', x: 6, z: 6 }]);
  await frames(200);
  return scene;
}

const OVERLAY = 1 << 1;
const key = (s: RoomSceneType) => (s as unknown as { key: THREE.DirectionalLight }).key;
const overlayDraws = () => draws.filter((d) => d.layers === OVERLAY);
const nullMapDraws = () => draws.filter((d) => d.cast && !d.map);

describe('RoomScene shadow quality and the overlay pass', () => {
  it('draws the overlay pass every frame here, and never before the map is built', async () => {
    await roomWithFront();
    expect(overlayDraws().length).toBeGreaterThan(10);
    expect(nullMapDraws()).toEqual([]);
  });

  it('a change of shadow size is applied between the passes: no draw runs with a null map', async () => {
    const scene = await roomWithFront();
    const before = key(scene).shadow.map;
    expect(before).toBeTruthy();
    for (const level of [QUALITY.balanced, QUALITY.low, QUALITY.high, QUALITY.low, QUALITY.balanced]) {
      const drawn = draws.length;
      const inUse = key(scene).shadow.map;
      const casting = key(scene).castShadow;
      scene.setQuality(level);
      // Recorded only: the map in use and the light are untouched until the next frame, between its passes
      expect(key(scene).shadow.map).toBe(inUse);
      expect(key(scene).castShadow).toBe(casting);
      await frames(30);
      expect(draws.length).toBeGreaterThan(drawn);
      expect(key(scene).castShadow).toBe(level.shadows !== 'off');
      if (level.shadows !== 'off') expect(key(scene).shadow.mapSize.x).toBe(level.shadowMapSize);
    }
    expect(key(scene).shadow.map).not.toBe(before);
    expect(overlayDraws().length).toBeGreaterThan(20);
    expect(nullMapDraws()).toEqual([]);
  });

  it('a change of quality between two frames, twice before one is drawn, still never draws with a null map', async () => {
    const scene = await roomWithFront();
    scene.setQuality(QUALITY.low);
    scene.setQuality(QUALITY.balanced);
    await frames(30);
    scene.setQuality(QUALITY.high);
    await frames(1);
    scene.setQuality(QUALITY.low);
    await frames(30);
    expect(key(scene).shadow.mapSize.x).toBe(QUALITY.low.shadowMapSize);
    expect(nullMapDraws()).toEqual([]);
  });
});
