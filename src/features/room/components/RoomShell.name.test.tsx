/**
 * The Blobbi's name is shown on demand, never left over its head: a hover
 * (with a grace on leaving, and a hover box that includes the name, so
 * moving from body to name never flickers), a tap (for a moment; another tap
 * starts the moment again; a tap elsewhere puts it away), keyboard focus on
 * the Blobbi's stand-in, which carries its accessible name. Never while
 * decorating, never while something is pressed or carried, the same whether
 * the Blobbi is drawn in 2D or 3D, and a tap on it is only a hello.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const fakeScene = vi.hoisted(() => ({
  pick: vi.fn(),
  overActor: vi.fn<(x: number, y?: number, id?: string) => boolean>(() => false),
  hop: vi.fn(),
  poke: vi.fn(),
  toggleLamp: vi.fn(() => false),
  walkTo: vi.fn(),
  projectBlobbi: vi.fn(() => ({ x: 200, y: 400, pxPerTile: 40 })),
  projectFloor: vi.fn(() => ({ x: 200, y: 400, pxPerTile: 40 })),
  projectItemTop: vi.fn(() => ({ x: 150, y: 300, pxPerTile: 40 })),
  facingOf: vi.fn(() => 'front'),
  isWalking: vi.fn(() => false),
  actorModelDrawn: vi.fn(() => false),
}));
vi.mock('../hooks/useRoomScene', () => ({ useRoomScene: () => ({ status: 'ready', sceneRef: { current: fakeScene } }) }));

import { RoomShell, type RoomEditorBinding } from './RoomShell';
import type { ActorModel } from '../lib/blobbi3d/actor';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';

function renderShell({ editing = false, model = null as ActorModel | null, onBlobbiTap = vi.fn() } = {}) {
  const editor: RoomEditorBinding | undefined = editing ? { selectedIndex: null, onSelect: vi.fn(), onMove: vi.fn(), onInvalidChange: vi.fn(), overlay: <div /> } : undefined;
  const utils = render(
    <RoomShell roomId="home" onChangeRoom={() => {}} isSleeping={false} blobbiStage="adult" blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={roomFurnitureFor('home')} editor={editor} stage={<div data-testid="stage" />} blobbiModel={model} blobbiName={{ text: 'Brook', color: '#7c3aed' }} onBlobbiTap={onBlobbiTap}>
      <div />
    </RoomShell>,
  );
  return { ...utils, onBlobbiTap, surface: screen.getByTestId('room-tap-layer') };
}

const name = () => screen.getByTestId('room-blobbi-name');
const pointer = (el: HTMLElement, type: string, x: number, y: number, extra: Partial<PointerEventInit> = {}) =>
  fireEvent(el, new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, ...extra }));
const tap = (el: HTMLElement, x: number, y: number, pointerType = 'touch') => {
  pointer(el, 'pointerdown', x, y, { pointerType });
  pointer(el, 'pointerup', x, y, { pointerType });
};

beforeEach(() => {
  vi.useFakeTimers();
  for (const fn of Object.values(fakeScene)) fn.mockClear();
  fakeScene.overActor.mockImplementation((x: number) => x > 150 && x < 250);
  fakeScene.pick.mockImplementation((x: number) => (x > 150 && x < 250 ? { kind: 'actor', id: 'main' } : { kind: 'floor', x: 2, z: 2 }));
});
afterEach(() => vi.useRealTimers());

describe('the Blobbi\'s name', () => {
  it('is not shown by default, and the Blobbi has an accessible name all the same', () => {
    renderShell();
    expect(name()).toHaveAttribute('data-shown', 'false');
    expect(name()).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Brook, your Blobbi' })).toBeInTheDocument();
  });

  it('a mouse over the Blobbi shows it; moving off keeps it a moment, so the edge never flickers; coming back in time keeps it up', () => {
    const { surface } = renderShell();
    pointer(surface, 'pointermove', 200, 300, { buttons: 0 });
    expect(name()).toHaveAttribute('data-shown', 'true');
    pointer(surface, 'pointermove', 300, 300, { buttons: 0 });
    expect(name()).toHaveAttribute('data-shown', 'true');
    act(() => { vi.advanceTimersByTime(100); });
    pointer(surface, 'pointermove', 210, 290, { buttons: 0 });
    act(() => { vi.advanceTimersByTime(400); });
    expect(name()).toHaveAttribute('data-shown', 'true');
    fireEvent.pointerLeave(surface);
    act(() => { vi.advanceTimersByTime(400); });
    expect(name()).toHaveAttribute('data-shown', 'false');
  });

  it('never shows while a button is held (an item carried over the Blobbi, a press), nor for a finger that merely moves', () => {
    const { surface } = renderShell();
    pointer(surface, 'pointermove', 200, 300, { buttons: 1 });
    expect(name()).toHaveAttribute('data-shown', 'false');
    pointer(surface, 'pointermove', 200, 300, { buttons: 0, pointerType: 'touch' });
    expect(name()).toHaveAttribute('data-shown', 'false');
  });

  it('a tap shows it for a moment; another tap starts the moment again; a tap elsewhere puts it away; the tap itself is only a hello', () => {
    const { surface, onBlobbiTap } = renderShell();
    tap(surface, 200, 300);
    expect(name()).toHaveAttribute('data-shown', 'true');
    // The app reacts to its own Blobbi (a face, a gesture, a sound); the scene's hop is for visitors
    expect(onBlobbiTap).toHaveBeenCalledWith('main');
    expect(fakeScene.hop).not.toHaveBeenCalled();
    expect(fakeScene.walkTo).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    tap(surface, 200, 300);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(name()).toHaveAttribute('data-shown', 'true');
    act(() => { vi.advanceTimersByTime(600); });
    expect(name()).toHaveAttribute('data-shown', 'false');
    tap(surface, 200, 300);
    tap(surface, 400, 300);
    expect(name()).toHaveAttribute('data-shown', 'false');
    // And the floor tap still walks, as before
    expect(fakeScene.walkTo).toHaveBeenCalledTimes(1);
  });

  it('keyboard focus on the Blobbi shows it, blur hides it; Enter is a hello', () => {
    const { onBlobbiTap } = renderShell();
    const blobbi = screen.getByRole('button', { name: 'Brook, your Blobbi' });
    fireEvent.focus(blobbi);
    expect(name()).toHaveAttribute('data-shown', 'true');
    fireEvent.click(blobbi);
    expect(onBlobbiTap).toHaveBeenCalledWith('main');
    fireEvent.blur(blobbi);
    expect(name()).toHaveAttribute('data-shown', 'false');
  });

  it('is never shown while decorating, and the Blobbi\'s stand-in leaves the tab order', () => {
    const { surface } = renderShell({ editing: true });
    pointer(surface, 'pointermove', 200, 300, { buttons: 0 });
    fireEvent.focus(screen.getByRole('button', { name: 'Brook, your Blobbi' }));
    expect(name()).toHaveAttribute('data-shown', 'false');
    expect(screen.getByRole('button', { name: 'Brook, your Blobbi' })).toHaveAttribute('tabindex', '-1');
  });

  it('is the same name, shown the same way, when the Blobbi is drawn in 3D', () => {
    const model = { object: {}, box: 1, pace: 1, lean: 0, gaze: () => ({ x: 0, y: 0 }), update: () => false, dispose: vi.fn() } as unknown as ActorModel;
    const { surface } = renderShell({ model });
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-blobbi-render', '3d');
    expect(screen.getAllByTestId('room-blobbi-name')).toHaveLength(1);
    pointer(surface, 'pointermove', 200, 300, { buttons: 0 });
    expect(name()).toHaveAttribute('data-shown', 'true');
  });
});
