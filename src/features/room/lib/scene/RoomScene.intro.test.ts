/**
 * A room counts as built only when its full fold-in has played to its end in
 * front of the player: the scene says so once (`onIntroDone`), after the
 * floor and the walls have folded up and every piece has popped up; a quick
 * fold-in (a room seen before) says nothing; a fold-in held by the
 * development scrubber says nothing; a fold-in the page was hidden for plays
 * again from the start when the page is back, and says so only then.
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
import { resolveFurniture, isOfficialFurnitureId } from '../furniture-3d';
import { roomFurnitureFor } from '../room-furniture';
import { getOfficialFurnitureModel } from '../../hooks/useFurnitureModels';
import type { RoomScene as RoomSceneType, RoomIntro, SceneGeometry, SceneItem } from './RoomScene';

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
let hidden = false;

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? fake2d(this) : null;
  } as unknown as HTMLCanvasElement['getContext'];
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  ({ RoomScene } = await import('./RoomScene'));
});
beforeEach(() => {
  hidden = false;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
});
afterEach(() => {
  for (const s of scenes) s.dispose();
  scenes = [];
  vi.useRealTimers();
});

const STAGE: SceneGeometry = { width: 390, height: 844, stage: { left: 0, top: 128, width: 390, height: 630 }, behindTop: 44 };

function items(room: 'home' | 'kitchen'): SceneItem[] {
  return roomFurnitureFor(room).map((placement, index) => {
    const def = resolveFurniture(placement.id)!;
    const model = getOfficialFurnitureModel(placement.id)!;
    return { index, key: `${placement.id}|${index}`, node: model.node, extras: model.extras, official: isOfficialFurnitureId(placement.id), mount: def.mount, small: def.small, surface: def.surface, interaction: def.interaction, placement } as SceneItem;
  });
}

async function scene(intro: RoomIntro) {
  const s = new RoomScene(document.createElement('canvas'), document.createElement('canvas'));
  scenes.push(s);
  const built: number[] = [];
  s.onIntroDone = () => built.push(performance.now());
  s.setGeometry(STAGE);
  s.setLayout(roomLayoutFor('home'));
  s.setItems(items('home'), intro, { x: 4.5, z: 4.5 });
  s.setBlobbi({ visible: true, isEgg: false, tiles: 3.35, sleeping: false, walkSpeed: 2 });
  return { s, built };
}

/** Frames, as the browser would give them. */
const frames = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('the room\'s build', () => {
  it('is reported once, only after the fold-in and every piece\'s pop-up have played to their end', async () => {
    const { built } = await scene('build');
    await frames(500);
    expect(built).toEqual([]);
    await frames(700);
    // The walls are up (860 ms) but the furniture is still popping
    expect(built).toEqual([]);
    await frames(1500);
    expect(built).toHaveLength(1);
    await frames(2000);
    expect(built).toHaveLength(1);
  });

  it('a quick fold-in (a room seen before) and no fold-in at all report nothing', async () => {
    const quick = await scene('quick');
    await frames(3000);
    expect(quick.built).toEqual([]);
    const none = await scene('none');
    await frames(3000);
    expect(none.built).toEqual([]);
  });

  it('a fold-in held by the scrubber reports nothing until it is let go and plays out', async () => {
    const { s, built } = await scene('build');
    s.holdIntro(300);
    await frames(3000);
    expect(built).toEqual([]);
    s.holdIntro(null);
    await frames(3000);
    expect(built).toHaveLength(1);
  });

  it('a fold-in the page was hidden for is not counted: it plays again from the start when the page is back, and is reported then', async () => {
    const { built } = await scene('build');
    await frames(400);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    // Time passes unseen
    await frames(4000);
    expect(built).toEqual([]);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    // Back: the build has its whole length to play again
    await frames(900);
    expect(built).toEqual([]);
    await frames(2000);
    expect(built).toHaveLength(1);
  });

  it('a room set up while the page is hidden waits to be watched: nothing is reported until it has been shown and has built', async () => {
    hidden = true;
    const { s, built } = await scene('build');
    await frames(4000);
    expect(built).toEqual([]);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await frames(2800);
    expect(built).toHaveLength(1);
    // The next room, quick: nothing more
    s.setLayout(roomLayoutFor('kitchen'));
    s.setItems(items('kitchen'), 'quick', { x: 4.5, z: 4.5 });
    await frames(3000);
    expect(built).toHaveLength(1);
  });
});
