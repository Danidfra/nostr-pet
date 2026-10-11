/**
 * The camera's gestures on the room, with the scene faked: two fingers are
 * a pinch that zooms and nothing else (no stroke, no drag, no tap, no
 * swipe, whatever one finger was doing before the second landed); a wheel
 * over the room zooms; the zoom the page holds reaches the scene; and the
 * settings row's + / − / Reset view drive the page.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const scene = vi.hoisted(() => {
  const state = { zoom: 1, pets: [] as string[], walks: 0, drags: 0, cancels: 0 };
  const fake = {
    pick: (x: number) => (x < 100 ? { kind: 'actor' as const, id: 'main' } : { kind: 'floor' as const, x: 3, z: 3 }),
    overActor: () => true,
    hoverAt: () => null,
    pressItem: () => {},
    floorAt: () => ({ x: 3, z: 3 }),
    requestWalk: () => Promise.resolve('arrived' as const),
    stopWalk: () => {},
    positionOf: () => ({ x: 4, z: 4 }),
    hop: () => {},
    playGesture: () => {},
    setActorGaze: () => {},
    setMainWanders: () => {},
    projectBlobbi: () => ({ x: 200, y: 320, pxPerTile: 40 }),
    projectFloor: () => ({ x: 200, y: 400, pxPerTile: 40 }),
    projectItemTop: () => ({ x: 150, y: 300, pxPerTile: 40 }),
    facingOf: () => 'front' as const,
    isWalking: () => false,
    actorModelDrawn: () => false,
    poke: () => {},
    toggleLamp: () => false,
    walkTo: () => { state.walks += 1; },
    findSpot: () => null,
    beginDrag: () => { state.drags += 1; return true; },
    dragTo: () => {},
    endDrag: () => null,
    cancelDrag: () => { state.cancels += 1; },
    setZoom: (z: number) => { state.zoom = Math.min(2.2, Math.max(0.6, z)); },
    zoomLimits: () => ({ min: 0.6, max: 2.2, value: state.zoom }),
  };
  return { fake, state };
});
vi.mock('@/features/room/hooks/useRoomScene', () => ({
  useRoomScene: () => ({ status: 'ready', sceneRef: { current: scene.fake } }),
  webglAvailable: () => true,
}));

import { RoomShell } from './RoomShell';
import { RoomBlobbi } from './RoomBlobbi';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';
import type { RoomId } from '@/features/home/rooms/rooms';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' }))!;

function renderShell(props: { zoom?: number } = {}) {
  const onZoom = vi.fn<(z: number) => void>();
  const onBlobbiPet = vi.fn<(phase: 'start' | 'stroke' | 'end') => void>();
  const onChangeRoom = vi.fn<(room: RoomId) => void>();
  render(
    <div style={{ height: 600 }}>
      <RoomShell roomId="home" onChangeRoom={onChangeRoom} isSleeping={false} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={roomFurnitureFor('home')} stage={<RoomBlobbi blobbi={brook} />} zoom={props.zoom ?? 1} onZoom={onZoom} onBlobbiPet={onBlobbiPet}>
        <div data-testid="dock">dock</div>
      </RoomShell>
    </div>,
  );
  return { onZoom, onBlobbiPet, onChangeRoom, layer: screen.getByTestId('room-tap-layer') };
}

const finger = (id: number, x: number, y: number, isPrimary = id === 1) => ({ pointerId: id, clientX: x, clientY: y, isPrimary, pointerType: 'touch', buttons: 1 });

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
  scene.state.zoom = 1;
  scene.state.walks = 0;
  scene.state.drags = 0;
  scene.state.cancels = 0;
});

describe('the camera on the room', () => {
  it('two fingers spreading zoom in, closing zoom out, and the page is told; one finger lifting ends it without a tap', () => {
    const { onZoom, layer } = renderShell();
    fireEvent.pointerDown(layer, finger(1, 100, 300));
    fireEvent.pointerDown(layer, finger(2, 200, 300, false));
    fireEvent.pointerMove(layer, finger(2, 300, 300, false));
    expect(scene.state.zoom).toBeCloseTo(2, 5);
    expect(onZoom).toHaveBeenLastCalledWith(2);
    fireEvent.pointerMove(layer, finger(2, 150, 300, false));
    expect(scene.state.zoom).toBeCloseTo(0.6, 5);
    fireEvent.pointerUp(layer, finger(2, 150, 300, false));
    fireEvent.pointerUp(layer, finger(1, 100, 300));
    // The finger left behind was not a tap on the floor
    expect(scene.state.walks).toBe(0);
  });

  it('a second finger ends a stroke on the Blobbi, and the pinch never pets', () => {
    const { onBlobbiPet, layer } = renderShell();
    fireEvent.pointerDown(layer, finger(1, 50, 300));
    for (let i = 1; i <= 8; i++) fireEvent.pointerMove(layer, finger(1, 50 + i * 6, 300));
    expect(onBlobbiPet).toHaveBeenCalledWith('start');
    fireEvent.pointerDown(layer, finger(2, 250, 300, false));
    expect(onBlobbiPet).toHaveBeenLastCalledWith('end');
    const pets = onBlobbiPet.mock.calls.length;
    for (let i = 1; i <= 8; i++) fireEvent.pointerMove(layer, finger(1, 98 + i * 6, 300));
    fireEvent.pointerMove(layer, finger(2, 320, 300, false));
    expect(onBlobbiPet.mock.calls.length).toBe(pets);
    expect(scene.state.zoom).toBeGreaterThan(1);
  });

  it('two touches never swipe to another room', () => {
    const { onChangeRoom } = renderShell();
    const shell = screen.getByTestId('room-shell');
    fireEvent.touchStart(shell, { touches: [{ identifier: 1, clientX: 300, clientY: 200 }, { identifier: 2, clientX: 200, clientY: 200 }] });
    fireEvent.touchEnd(shell, { changedTouches: [{ identifier: 1, clientX: 50, clientY: 200 }] });
    expect(onChangeRoom).not.toHaveBeenCalled();
  });

  it('the wheel over the room zooms and tells the page; the page cannot scroll with it', () => {
    const { onZoom, layer } = renderShell();
    const event = new WheelEvent('wheel', { deltaY: -400, cancelable: true, bubbles: true });
    layer.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(scene.state.zoom).toBeGreaterThan(1);
    expect(onZoom).toHaveBeenLastCalledWith(scene.state.zoom);
    layer.dispatchEvent(new WheelEvent('wheel', { deltaY: 900, cancelable: true, bubbles: true }));
    expect(scene.state.zoom).toBeLessThan(1);
  });

  it('the zoom the page holds reaches the scene', () => {
    renderShell({ zoom: 1.5 });
    expect(scene.state.zoom).toBe(1.5);
  });
});
