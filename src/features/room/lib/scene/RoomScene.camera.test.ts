/**
 * The camera frames the room for the stage it has, measured on the real
 * scene with the GPU stubbed: on a phone upright the whole floor and the
 * Blobbi are on screen (the room may spill only a little past the sides,
 * where it used to lose a quarter of itself each side); on a wide stage the
 * approved framing stands (the height decides it, the room fills it). The
 * user's zoom moves between limits that keep the room a room and the
 * camera outside it, survives the phone turning, and is reported.
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
import { ROOM_GRID } from '../room-geometry';
import { resolveFurniture, isOfficialFurnitureId } from '../furniture-3d';
import { roomFurnitureFor } from '../room-furniture';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import type { RoomScene as RoomSceneType, SceneGeometry, SceneItem } from './RoomScene';
import { sideOverflow } from './RoomScene';

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

const G = ROOM_GRID;
/** Stages as the shell measures them: a small phone upright, a larger one, a phone on its side, a tablet, a desktop column. */
const STAGES: Record<string, SceneGeometry> = {
  'small phone': { width: 320, height: 568, stage: { left: 0, top: 118, width: 320, height: 368 }, behindTop: 40 },
  'phone': { width: 390, height: 664, stage: { left: 0, top: 128, width: 390, height: 450 }, behindTop: 44 },
  'tall phone': { width: 390, height: 844, stage: { left: 0, top: 128, width: 390, height: 630 }, behindTop: 44 },
  'phone landscape': { width: 844, height: 390, stage: { left: 0, top: 96, width: 844, height: 220 }, behindTop: 30 },
  'tablet': { width: 768, height: 1024, stage: { left: 0, top: 140, width: 768, height: 790 }, behindTop: 0 },
  'desktop': { width: 980, height: 820, stage: { left: 0, top: 120, width: 980, height: 620 }, behindTop: 0 },
};

async function scene(g: SceneGeometry) {
  const s = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(s);
  s.setGeometry(g);
  s.setLayout(roomLayoutFor('home'));
  s.setItems(roomFurnitureFor('home').map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement } as SceneItem;
  }), false);
  s.setBlobbi({ visible: true, isEgg: false, tiles: 3.35, sleeping: false, walkSpeed: 2 });
  await vi.advanceTimersByTimeAsync(50);
  return s;
}

/** The floor's four corners on screen, and how far the floor spans. */
function floor(s: RoomSceneType) {
  const corners = [s.projectFloor(0, 0)!, s.projectFloor(G, 0)!, s.projectFloor(0, G)!, s.projectFloor(G, G)!];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { corners, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

describe('the responsive framing', () => {
  it('a wide stage keeps the full sideways allowance; a narrow one keeps most of the room on screen; between, it eases', () => {
    expect(sideOverflow(980, 620, 1.5)).toBe(1.5);
    expect(sideOverflow(844, 250, 1.5)).toBe(1.5);
    expect(sideOverflow(390, 494, 1.5)).toBeCloseTo(1.1 + (1.5 - 1.1) * ((390 / 494 - 0.72) / 0.28), 5);
    expect(sideOverflow(390, 674, 1.5)).toBe(1.1);
    expect(sideOverflow(320, 408, 1.5)).toBeLessThan(1.25);
    expect(sideOverflow(390, 494, 1.3)).toBeLessThanOrEqual(1.3);
  });

  it('on phones upright the whole floor is inside the stage width and the Blobbi is on screen', async () => {
    for (const name of ['small phone', 'phone', 'tall phone', 'tablet'] as const) {
      const g = STAGES[name];
      const s = await scene(g);
      const f = floor(s);
      // The floor's left and right corners stay on screen but for their very tips (under the walls' ends)
      expect(f.left, `${name} left`).toBeGreaterThanOrEqual(-g.width * 0.06);
      expect(f.right, `${name} right`).toBeLessThanOrEqual(g.width * 1.06);
      // And it fills the width: not a small object in the middle
      expect(f.right - f.left, `${name} span`).toBeGreaterThan(g.width * 0.8);
      const b = s.projectBlobbi()!;
      expect(b.x, `${name} blobbi x`).toBeGreaterThan(0);
      expect(b.x, `${name} blobbi x`).toBeLessThan(g.width);
      expect(b.y, `${name} blobbi y`).toBeGreaterThan(g.stage.top);
      expect(b.y, `${name} blobbi y`).toBeLessThan(g.stage.top + g.stage.height);
    }
  });

  it('a wide stage is framed as before: the floor fills the stage height and may spill past the sides', async () => {
    for (const name of ['desktop', 'phone landscape'] as const) {
      const g = STAGES[name];
      const s = await scene(g);
      const f = floor(s);
      // The lowest corner reaches the bottom of the frame (the height decides the framing)
      expect(f.bottom, `${name} bottom`).toBeGreaterThan(g.stage.top + g.stage.height * 0.85);
      expect(f.bottom, `${name} bottom`).toBeLessThanOrEqual(g.stage.top + g.stage.height + 2);
      // The approved allowance: never more than half the stage's width past each side
      expect(f.left, `${name} left`).toBeGreaterThanOrEqual(-g.width * 0.26);
      expect(f.right, `${name} right`).toBeLessThanOrEqual(g.width * 1.26);
    }
  });
});

describe('the user\'s zoom', () => {
  it('is held between a small object and the camera staying outside the room, reported with its limits', async () => {
    const g = STAGES.phone;
    const s = await scene(g);
    const before = floor(s);
    const limits = s.zoomLimits();
    expect(limits.value).toBe(1);
    expect(limits.min).toBe(0.6);
    expect(limits.max).toBeGreaterThan(1.3);
    expect(limits.max).toBeLessThanOrEqual(2.2);
    s.setZoom(10, true);
    expect(s.zoomLimits().value).toBe(limits.max);
    const near = floor(s);
    expect(near.right - near.left).toBeGreaterThan((before.right - before.left) * 1.25);
    // Nearer, the room is still around its centre: the Blobbi stays on screen
    const b = s.projectBlobbi()!;
    expect(b.x).toBeGreaterThan(-g.width * 0.2);
    expect(b.x).toBeLessThan(g.width * 1.2);
    s.setZoom(0.01, true);
    expect(s.zoomLimits().value).toBe(0.6);
    const far = floor(s);
    expect(far.right - far.left).toBeLessThan(before.right - before.left);
    expect(far.right - far.left).toBeGreaterThan(g.width * 0.4);
  });

  it('eases to a new zoom frame by frame, and at once when asked (a pinch)', async () => {
    const s = await scene(STAGES.phone);
    const before = floor(s);
    s.setZoom(1.5);
    const first = floor(s);
    expect(first.right - first.left).toBeCloseTo(before.right - before.left, 0);
    await vi.advanceTimersByTimeAsync(16 * 10);
    const mid = floor(s);
    expect(mid.right - mid.left).toBeGreaterThan(before.right - before.left);
    await vi.advanceTimersByTimeAsync(16 * 90);
    const end = floor(s);
    s.setZoom(1.5, true);
    const snapped = floor(s);
    expect(end.right - end.left).toBeCloseTo(snapped.right - snapped.left, 0);
  });

  it('survives the phone turning: the factor stays, within the new stage\'s limits', async () => {
    const s = await scene(STAGES.phone);
    s.setZoom(1.4, true);
    s.setGeometry(STAGES['phone landscape']);
    expect(s.zoomLimits().value).toBeCloseTo(Math.min(1.4, s.zoomLimits().max), 5);
    s.setGeometry(STAGES.phone);
    expect(s.zoomLimits().value).toBeCloseTo(Math.min(1.4, s.zoomLimits().max), 5);
    const b = s.projectBlobbi()!;
    expect(b.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(STAGES.phone.width);
  });
});
