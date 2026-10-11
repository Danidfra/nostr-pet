/**
 * The shell while decorating, over a fake scene (jsdom has no WebGL): a
 * press on a piece picks it up, a move past the slop drags it, letting go
 * reports the move when the drop was valid, with a mouse or a finger
 * alike; a tap on the floor lets go of the selection; swiping never
 * changes the room while decorating; and the HUD gives way to the editor's bars.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';

import { blobbiEvent } from '@/test/fixtures';

const fakeScene = vi.hoisted(() => ({
  pick: vi.fn(),
  beginDrag: vi.fn(() => true),
  dragTo: vi.fn(),
  endDrag: vi.fn(),
  cancelDrag: vi.fn(),
  overActor: vi.fn(() => true),
  hop: vi.fn(),
  poke: vi.fn(),
  toggleLamp: vi.fn(() => false),
  walkTo: vi.fn(),
  requestWalk: vi.fn(async () => 'arrived'),
  stopWalk: vi.fn(),
  isWalking: vi.fn(() => false),
  actorModelDrawn: vi.fn(() => false),
  facingOf: vi.fn(() => 'front'),
  projectBlobbi: vi.fn(() => ({ x: 200, y: 400, pxPerTile: 40 })),
  projectFloor: vi.fn(() => ({ x: 200, y: 400, pxPerTile: 40 })),
  projectItemTop: vi.fn(() => ({ x: 150, y: 300, pxPerTile: 40 })),
  findSpot: vi.fn(() => null),
  floorAt: vi.fn(() => null),
}));
vi.mock('../hooks/useRoomScene', () => ({ useRoomScene: () => ({ status: 'ready', sceneRef: { current: fakeScene } }) }));

import { RoomShell, type RoomEditorBinding } from './RoomShell';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3' }))!;

function editor(selected: number | null = null): RoomEditorBinding {
  return { selectedIndex: selected, onSelect: vi.fn(), onMove: vi.fn(), onInvalidChange: vi.fn(), toolbar: <div data-testid="toolbar" />, overlay: <div data-testid="overlay"><div data-room-top>top</div><div data-room-bottom>tray</div></div> };
}

function renderShell(binding?: RoomEditorBinding, onChangeRoom = vi.fn()) {
  const placements = roomFurnitureFor('home');
  render(
    <RoomShell roomId="home" onChangeRoom={onChangeRoom} isSleeping={false} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={placements} editor={binding} stage={<div data-testid="stage" />} onDecorate={() => {}}>
      <div data-testid="dock">dock</div>
    </RoomShell>,
  );
  const surface = screen.getByTestId('room-shell').querySelector('.touch-none') as HTMLElement;
  surface.setPointerCapture = vi.fn();
  return { surface, onChangeRoom };
}

beforeEach(() => {
  for (const fn of Object.values(fakeScene)) if ('mockClear' in fn) (fn as ReturnType<typeof vi.fn>).mockClear();
  fakeScene.beginDrag.mockReturnValue(true);
  fakeScene.endDrag.mockReturnValue({ index: 0, placement: { id: 'official:rug-round', at: 'floor', x: 2.5, y: 2.5 }, valid: true });
});

const press = (el: HTMLElement, type: string, x: number, y: number, pointerType = 'mouse', pointerId = 1) =>
  fireEvent(el, new (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent(type, { clientX: x, clientY: y, pointerId, pointerType, isPrimary: true, bubbles: true } as PointerEventInit));

describe.each([['mouse'], ['touch']])('RoomShell decorating with a %s', (pointerType) => {
  it('picks up a piece on press, drags it past the slop, and reports a valid drop', () => {
    fakeScene.pick.mockReturnValue({ kind: 'item', index: 0 });
    const binding = editor(null);
    const { surface } = renderShell(binding);
    press(surface, 'pointerdown', 100, 300, pointerType);
    expect(binding.onSelect).toHaveBeenCalledWith(0);
    press(surface, 'pointermove', 103, 302, pointerType); // under the slop: nothing yet
    expect(fakeScene.beginDrag).not.toHaveBeenCalled();
    press(surface, 'pointermove', 140, 340, pointerType);
    expect(fakeScene.beginDrag).toHaveBeenCalledWith(0, 100, 300);
    expect(fakeScene.dragTo).toHaveBeenCalledWith(140, 340);
    press(surface, 'pointerup', 140, 340, pointerType);
    expect(fakeScene.endDrag).toHaveBeenCalled();
    expect(binding.onMove).toHaveBeenCalledWith(0, { id: 'official:rug-round', at: 'floor', x: 2.5, y: 2.5 });
  });

  it('a drop the scene refuses reports no move; a tap on the floor lets go of the selection; a tap on a piece never walks or pokes', () => {
    fakeScene.pick.mockReturnValue({ kind: 'item', index: 1 });
    fakeScene.endDrag.mockReturnValue({ index: 1, placement: { id: 'x', at: 'floor', x: 0, y: 0 }, valid: false });
    const binding = editor(1);
    const { surface } = renderShell(binding);
    press(surface, 'pointerdown', 100, 300, pointerType);
    press(surface, 'pointermove', 150, 350, pointerType);
    press(surface, 'pointerup', 150, 350, pointerType);
    expect(binding.onMove).not.toHaveBeenCalled();
    expect(fakeScene.walkTo).not.toHaveBeenCalled();
    expect(fakeScene.poke).not.toHaveBeenCalled();
    fakeScene.pick.mockReturnValue({ kind: 'floor', x: 3, z: 3 });
    press(surface, 'pointerdown', 200, 400, pointerType);
    press(surface, 'pointerup', 200, 400, pointerType);
    expect(binding.onSelect).toHaveBeenLastCalledWith(null);
    expect(fakeScene.walkTo).not.toHaveBeenCalled();
  });
});

describe('RoomShell decorating', () => {
  it('replaces the HUD and dock with the editor\'s bars, dims the Blobbi, anchors the toolbar over the piece, and never changes room on a swipe', () => {
    const binding = editor(0);
    const { onChangeRoom } = renderShell(binding);
    expect(screen.queryByTestId('room-switcher')).toBeNull();
    expect(screen.queryByTestId('dock')).toBeNull();
    expect(screen.getByTestId('overlay')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('room-blobbi-anchor').className).toContain('opacity-40');
    const shell = screen.getByTestId('room-shell');
    fireEvent.touchStart(shell, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(shell, { changedTouches: [{ clientX: 100, clientY: 200 }] });
    expect(onChangeRoom).not.toHaveBeenCalled();
  });

  it('outside decorating a tap on the floor walks and a tap on a piece pokes it', () => {
    fakeScene.pick.mockReturnValue({ kind: 'floor', x: 3, z: 4 });
    const { surface } = renderShell(undefined);
    expect(screen.getByTestId('room-switcher')).toBeInTheDocument();
    press(surface, 'pointerdown', 200, 400);
    press(surface, 'pointerup', 200, 400);
    expect(fakeScene.walkTo).toHaveBeenCalledWith(3, 4);
    fakeScene.pick.mockReturnValue({ kind: 'item', index: 2 });
    press(surface, 'pointerdown', 200, 400);
    press(surface, 'pointerup', 200, 400);
    expect(fakeScene.poke).toHaveBeenCalledWith(2);
    expect(fakeScene.beginDrag).not.toHaveBeenCalled();
  });
});

describe('RoomShell gestures on a phone', () => {
  function renderWithPetting() {
    const onChangeRoom = vi.fn();
    const onBlobbiPet = vi.fn();
    render(
      <RoomShell roomId="home" onChangeRoom={onChangeRoom} isSleeping={false} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={roomFurnitureFor('home')} stage={<div data-testid="stage" />} onBlobbiPet={onBlobbiPet}>
        <div data-testid="dock">dock</div>
      </RoomShell>,
    );
    const surface = screen.getByTestId('room-shell').querySelector('.touch-none') as HTMLElement;
    surface.setPointerCapture = vi.fn();
    return { surface, onChangeRoom, onBlobbiPet };
  }

  it('stroking the Blobbi sideways pets it, and neither walks nor changes room', () => {
    fakeScene.pick.mockReturnValue({ kind: 'actor', id: 'main' });
    const { surface, onChangeRoom, onBlobbiPet } = renderWithPetting();
    press(surface, 'pointerdown', 300, 400, 'touch');
    fireEvent.touchStart(surface, { touches: [{ identifier: 0, clientX: 300, clientY: 400 }], changedTouches: [{ identifier: 0, clientX: 300, clientY: 400 }] });
    for (const x of [270, 230, 190, 150, 110]) press(surface, 'pointermove', x, 400, 'touch');
    press(surface, 'pointerup', 110, 400, 'touch');
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 0, clientX: 110, clientY: 400 }] });
    expect(onBlobbiPet).toHaveBeenCalledWith('start');
    expect(onBlobbiPet).toHaveBeenLastCalledWith('end');
    expect(onChangeRoom).not.toHaveBeenCalled();
    expect(fakeScene.walkTo).not.toHaveBeenCalled();
  });

  it('a swipe across the floor still changes room; a second finger is not a swipe of its own', () => {
    fakeScene.pick.mockReturnValue({ kind: 'floor', x: 3, z: 3 });
    const { surface, onChangeRoom } = renderWithPetting();
    // One finger holds still, another lands far away and lifts: nothing
    fireEvent.touchStart(surface, { touches: [{ identifier: 1, clientX: 300, clientY: 400 }], changedTouches: [{ identifier: 1, clientX: 300, clientY: 400 }] });
    fireEvent.touchStart(surface, { changedTouches: [{ identifier: 2, clientX: 60, clientY: 400 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 2, clientX: 60, clientY: 400 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 1, clientX: 290, clientY: 400 }] });
    expect(onChangeRoom).not.toHaveBeenCalled();
    // A real swipe
    fireEvent.touchStart(surface, { changedTouches: [{ identifier: 3, clientX: 300, clientY: 400 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 3, clientX: 100, clientY: 400 }] });
    expect(onChangeRoom).toHaveBeenCalledTimes(1);
  });

  it('a decorating drag the system takes away puts the piece back instead of saving the move', () => {
    fakeScene.pick.mockReturnValue({ kind: 'item', index: 0 });
    const binding = editor(0);
    const { surface } = renderShell(binding);
    press(surface, 'pointerdown', 100, 300, 'touch');
    press(surface, 'pointermove', 160, 340, 'touch');
    press(surface, 'pointercancel', 160, 340, 'touch');
    expect(fakeScene.cancelDrag).toHaveBeenCalled();
    expect(fakeScene.endDrag).not.toHaveBeenCalled();
    expect(binding.onMove).not.toHaveBeenCalled();
  });
});
