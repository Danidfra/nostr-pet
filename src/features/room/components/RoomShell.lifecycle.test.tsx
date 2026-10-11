/**
 * The room's scene lives as long as its canvases, and decorating is a
 * change of inputs, never a new scene: entering the editor, picking and
 * moving pieces, editing the surfaces, saving and cancelling all reach the
 * one RoomScene through its setters, with no disposal, no new WebGL
 * context, no replayed fold-in, and the canvases still in the document.
 * A room change folds the next room in on that same scene.
 *
 * The engine module is replaced by a recording fake and the page-wide WebGL
 * probe is answered, so the real `useRoomScene` lifecycle runs in jsdom.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';

import { blobbiEvent } from '@/test/fixtures';

const made = vi.hoisted(() => ({ scenes: [] as FakeScene[] }));

class FakeScene {
  onFrame?: () => void;
  onInvalidChange?: (invalid: Set<number>) => void;
  onMeet?: (id: string) => void;
  calls: { name: string; args: unknown[] }[] = [];
  disposed = false;
  constructor(public canvas: HTMLCanvasElement, public front: HTMLCanvasElement) {
    made.scenes.push(this);
  }
  private log(name: string, ...args: unknown[]) {
    this.calls.push({ name, args });
  }
  setGeometry(g: unknown) { this.log('setGeometry', g); }
  setLayout(l: unknown) { this.log('setLayout', l); }
  setItems(items: unknown, animate: unknown, spawn?: unknown) { this.log('setItems', items, animate, ...(spawn ? [spawn] : [])); }
  setBlobbi(b: unknown) { this.log('setBlobbi', b); }
  setGuests(g: unknown) { this.log('setGuests', g); }
  setEditing(editing: boolean, selected: number | null) { this.log('setEditing', editing, selected); }
  setParallax() {}
  dispose() { this.disposed = true; this.log('dispose'); }
  projectBlobbi() { return { x: 100, y: 200, pxPerTile: 30 }; }
  projectFloor() { return { x: 100, y: 200, pxPerTile: 30 }; }
  projectItemTop() { return { x: 100, y: 150, pxPerTile: 30 }; }
  facingOf() { return 'front' as const; }
  isWalking() { return false; }
  /** A model the scene was given counts as drawn: the frame that draws it is the fake's next. */
  model: unknown = null;
  actorModelDrawn() { return this.model !== null; }
  pick() { return null; }
  findSpot() { return { at: 'floor' as const, x: 2, y: 2 }; }
  floorAt() { return null; }
  requestWalk() { return Promise.resolve('refused' as const); }
  stopWalk() {}
  setActorModel(id: string, model: unknown) { this.model = model; this.log('setActorModel', id, model); }
  positionOf() { return { x: 2, z: 6 }; }
}
vi.mock('../lib/scene/RoomScene', () => ({ RoomScene: FakeScene }));

import { RoomShell, type RoomEditorBinding } from './RoomShell';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor, type FurniturePlacement } from '../lib/room-furniture';
import type { RoomId } from '@/features/home/rooms/rooms';
import type { ActorModel } from '../lib/blobbi3d/actor';

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3' }))!;

beforeEach(() => {
  made.scenes.length = 0;
  // WebGL "exists": the probe gets a context it can release
  HTMLCanvasElement.prototype.getContext = vi.fn((kind: string) => (kind === 'webgl2' ? { getExtension: () => ({ loseContext() {} }) } : null)) as unknown as HTMLCanvasElement['getContext'];
});

function editorBinding(selected: number | null): RoomEditorBinding {
  return { selectedIndex: selected, onSelect: vi.fn(), onMove: vi.fn(), onInvalidChange: vi.fn(), toolbar: <div data-testid="toolbar" />, overlay: <div><div data-room-top>top</div><div data-room-bottom>tray</div></div> };
}

function Harness({ roomId, placements, editor, layout, model, care, header }: { roomId: RoomId; placements: readonly FurniturePlacement[]; editor?: RoomEditorBinding; layout?: ReturnType<typeof roomLayoutFor>; model?: ActorModel; care?: { n: number }; header?: boolean }) {
  return (
    <RoomShell
      roomId={roomId}
      onChangeRoom={() => {}}
      isSleeping={false}
      blobbiStage={brook.stage}
      blobbiVisible
      roomLayout={layout ?? roomLayoutFor(roomId)}
      furniturePlacements={placements}
      editor={editor}
      stage={<div data-testid="stage" />}
      onDecorate={() => {}}
      blobbiModel={model ?? null}
      header={header ? <div>Brook</div> : undefined}
      // What care puts in the room: an item on the floor, the feedback on the Blobbi, the dock's panel
      floorThings={care ? [{ key: `item-${care.n}`, x: 2 + care.n * 0.1, z: 3, node: <span data-testid="floor-thing">{care.n}</span> }] : undefined}
      blobbiOverlay={care ? <span data-testid="feedback">{care.n}</span> : undefined}
      middleSlot={care ? <div data-testid="panel">{care.n}</div> : undefined}
      decorateDisabled={care ? care.n % 2 === 1 : undefined}
    >
      <div data-testid="dock">dock</div>
    </RoomShell>
  );
}

const scene = () => made.scenes[0];
const names = (s: FakeScene, from = 0) => s.calls.slice(from).map((c) => c.name);

describe('RoomShell keeps one scene through decorating', () => {
  it('creates one scene, and entering the editor, selecting, moving, re-laying out, saving and cancelling never dispose it, replace its canvases or fold the room in again', async () => {
    const home = roomFurnitureFor('home');
    const { rerender } = render(<Harness roomId="home" placements={home} />);
    await waitFor(() => expect(made.scenes).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready'));
    const s = scene();
    const canvases = [...screen.getByTestId('room-shell').querySelectorAll('canvas')];
    expect(canvases).toHaveLength(2);
    expect(s.canvas).toBe(canvases[0]);
    // The first show folds the room in
    const firstItems = s.calls.find((c) => c.name === 'setItems');
    expect(firstItems?.args[1]).toBe('build');
    const mark = s.calls.length;

    // Enter the editor with a draft copy of the room
    const draft = [...home];
    rerender(<Harness roomId="home" placements={draft} editor={editorBinding(null)} />);
    await waitFor(() => expect(names(s, mark)).toContain('setEditing'));
    expect(made.scenes).toHaveLength(1);
    expect(s.disposed).toBe(false);
    expect(canvases.every((c) => c.isConnected)).toBe(true);
    for (const c of s.calls.slice(mark).filter((c) => c.name === 'setItems')) expect(c.args[1]).toBe('none'); // no fold-in on an edit
    expect(s.calls.slice(mark).find((c) => c.name === 'setEditing')?.args).toEqual([true, null]);

    // Select a piece, move it, add one, change the wallpaper
    const m2 = s.calls.length;
    rerender(<Harness roomId="home" placements={draft} editor={editorBinding(2)} />);
    const moved = draft.map((p, i) => (i === 2 ? { ...p, x: 6, y: 6 } : p));
    rerender(<Harness roomId="home" placements={moved} editor={editorBinding(2)} />);
    const added = [...moved, { id: 'official:plant-small', at: 'floor' as const, x: 2, y: 2 }];
    rerender(<Harness roomId="home" placements={added} editor={editorBinding(added.length - 1)} />);
    const wall = { ...roomLayoutFor('home'), wall: { style: 'solid' as const, palette: ['#ffffff'] } };
    rerender(<Harness roomId="home" placements={added} editor={editorBinding(added.length - 1)} layout={wall} />);
    await waitFor(() => expect(names(s, m2)).toContain('setLayout'));
    expect(made.scenes).toHaveLength(1);
    expect(s.disposed).toBe(false);
    expect(names(s, m2)).not.toContain('dispose');
    for (const c of s.calls.slice(m2).filter((c) => c.name === 'setItems')) expect(c.args[1]).toBe('none');
    expect(s.calls.slice(m2).filter((c) => c.name === 'setEditing').map((c) => c.args)).toEqual(expect.arrayContaining([[true, 2], [true, added.length - 1]]));
    expect(s.calls.slice(m2).find((c) => c.name === 'setLayout')?.args[0]).toBe(wall);

    // Cancel: back to the room as it was, same scene, nothing folded in again
    const m3 = s.calls.length;
    rerender(<Harness roomId="home" placements={home} />);
    await waitFor(() => expect(names(s, m3)).toContain('setEditing'));
    expect(s.calls.slice(m3).find((c) => c.name === 'setEditing')?.args).toEqual([false, null]);
    for (const c of s.calls.slice(m3).filter((c) => c.name === 'setItems')) expect(c.args[1]).toBe('none');
    expect(made.scenes).toHaveLength(1);
    expect(s.disposed).toBe(false);
    expect(canvases.every((c) => c.isConnected)).toBe(true);
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready');
    // The one WebGL probe, released: no context per interaction
    const probes = (HTMLCanvasElement.prototype.getContext as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => call[0] === 'webgl2' || call[0] === 'webgl');
    expect(probes.length).toBeLessThanOrEqual(1);
  });

  it('a room change folds the next room in on the same scene, and a lost WebGL context is the only thing that remakes one', async () => {
    const { rerender } = render(<Harness roomId="home" placements={roomFurnitureFor('home')} />);
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready'));
    const s = scene();
    const mark = s.calls.length;
    rerender(<Harness roomId="kitchen" placements={roomFurnitureFor('kitchen')} />);
    await waitFor(() => expect(names(s, mark)).toContain('setItems'));
    expect(s.calls.slice(mark).find((c) => c.name === 'setItems')?.args[1]).toBe('build');
    expect(s.calls.slice(mark).find((c) => c.name === 'setLayout')?.args[0]).toBe(roomLayoutFor('kitchen'));
    expect(made.scenes).toHaveLength(1);
    expect(s.disposed).toBe(false);
    // The browser takes the context away: the room steps aside and comes back on a fresh canvas
    act(() => {
      fireEvent(s.canvas, new Event('webglcontextlost', { cancelable: true }));
    });
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'unavailable'));
    expect(s.disposed).toBe(true);
  });
  it('a room made again after a lost context puts the Blobbi back where it stood, without folding the room in again', async () => {
    render(<Harness roomId="home" placements={roomFurnitureFor('home')} />);
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready'));
    act(() => {
      fireEvent(scene().canvas, new Event('webglcontextlost', { cancelable: true }));
    });
    await waitFor(() => expect(made.scenes).toHaveLength(2), { timeout: 4000 });
    const again = made.scenes[1];
    await waitFor(() => expect(again.calls.some((c) => c.name === 'setItems')).toBe(true));
    expect(again.calls.find((c) => c.name === 'setItems')?.args.slice(1)).toEqual(['none', { x: 2, z: 6 }]);
  });

  it('a 3D model given to the shell goes to the same scene in the Blobbi\'s place, and the DOM drawing steps aside once it is drawn', async () => {
    const model = { object: {}, box: 1, pace: 1, gaze: () => ({ x: 0, y: 0 }), update: () => false, dispose: vi.fn() } as unknown as ActorModel & { dispose: ReturnType<typeof vi.fn> };
    const { rerender } = render(<Harness roomId="home" placements={roomFurnitureFor('home')} />);
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready'));
    const s = made.scenes[0];
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-blobbi-render', '2d');
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    rerender(<Harness roomId="home" placements={roomFurnitureFor('home')} model={model} />);
    await waitFor(() => expect(s.calls.some((c) => c.name === 'setActorModel' && c.args[1] === model)).toBe(true));
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-blobbi-render', '3d');
    // The anchor stays (what follows the Blobbi, its facing and motion reports); only the drawing steps aside, once the model is on screen
    const anchor = screen.getByTestId('room-blobbi-anchor');
    const drawing = anchor.querySelector<HTMLElement>('[data-blobbi-2d]')!;
    rerender(<Harness roomId="home" placements={roomFurnitureFor('home')} model={model} />);
    expect(anchor).toHaveAttribute('data-render', '3d');
    expect(drawing.style.display).toBe('none');
    expect(made.scenes).toHaveLength(1);
    rerender(<Harness roomId="home" placements={roomFurnitureFor('home')} />);
    await waitFor(() => expect(s.calls[s.calls.length - 1]).toEqual({ name: 'setActorModel', args: ['main', null] }));
    // The next frame (here, the next render) draws the room without the model and the drawing back, together
    rerender(<Harness roomId="home" placements={roomFurnitureFor('home')} />);
    expect(screen.getByTestId('room-blobbi-anchor')).toBe(anchor);
    expect(anchor).toHaveAttribute('data-render', '2d');
    expect(drawing.style.display).toBe('');
    expect(model.dispose).not.toHaveBeenCalled();
    expect(s.disposed).toBe(false);
  });

  it('care in the room (items set down and taken up, feedback, the dock\'s panel, the busy decorate button) reaches the one scene without a new one, a dispose or a fold-in', async () => {
    const home = roomFurnitureFor('home');
    const { rerender } = render(<Harness roomId="home" placements={home} />);
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready'));
    const s = scene();
    const canvases = [...screen.getByTestId('room-shell').querySelectorAll('canvas')];
    const mark = s.calls.length;
    for (let n = 0; n < 6; n++) rerender(<Harness roomId="home" placements={home} care={{ n }} />);
    rerender(<Harness roomId="home" placements={home} />);
    expect(screen.queryByTestId('floor-thing')).toBeNull();
    expect(made.scenes).toHaveLength(1);
    expect(s.disposed).toBe(false);
    expect(names(s, mark)).not.toContain('dispose');
    expect(s.calls.slice(mark).filter((c) => c.name === 'setItems' && c.args[1] === true)).toEqual([]);
    expect([...screen.getByTestId('room-shell').querySelectorAll('canvas')]).toEqual(canvases);
  });
});

describe('RoomShell through a change of viewport', () => {
  it('a phone turned on its side re-frames the same scene (no new scene, no new context), with the room reaching up behind the HUD', async () => {
    const observers: (() => void)[] = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(private cb: () => void) { observers.push(() => this.cb()); }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    let size = { width: 390, height: 700 };
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'room-shell') return { x: 0, y: 0, left: 0, top: 0, right: size.width, bottom: size.height, width: size.width, height: size.height, toJSON() {} } as DOMRect;
      if ('roomHeader' in this.dataset) return { left: 0, top: 0, right: size.width, bottom: 40, width: size.width, height: 40, x: 0, y: 0, toJSON() {} } as DOMRect;
      if ('roomTop' in this.dataset) return { left: 0, top: 40, right: size.width, bottom: 120, width: size.width, height: 80, x: 0, y: 40, toJSON() {} } as DOMRect;
      if ('roomBottom' in this.dataset) return { left: 0, top: size.height - 80, right: size.width, bottom: size.height, width: size.width, height: 80, x: 0, y: size.height - 80, toJSON() {} } as DOMRect;
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    });
    try {
      render(<Harness roomId="home" placements={roomFurnitureFor('home')} header />);
      await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-scene', 'ready'));
      const s = scene();
      const geometries = () => s.calls.filter((c) => c.name === 'setGeometry').map((c) => c.args[0] as { width: number; height: number; behindTop: number });
      expect(geometries().at(-1)).toMatchObject({ width: 390, height: 700 });
      // Turned: a wide, short view (wider than a phone in portrait, so only its height makes it a phone)
      size = { width: 700, height: 330 };
      act(() => observers.forEach((o) => o()));
      await waitFor(() => expect(geometries().at(-1)).toMatchObject({ width: 700, height: 330 }));
      expect(geometries().at(-1)!.behindTop).toBeGreaterThan(0);
      // And back
      size = { width: 390, height: 700 };
      act(() => observers.forEach((o) => o()));
      await waitFor(() => expect(geometries().at(-1)).toMatchObject({ width: 390, height: 700 }));
      expect(made.scenes).toHaveLength(1);
      expect(s.disposed).toBe(false);
    } finally {
      rect.mockRestore();
      globalThis.ResizeObserver = original;
    }
  });
});
