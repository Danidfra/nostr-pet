/**
 * The shell and the room's props: the list is mirrored into the 3D scene,
 * a tap (a finger or a mouse) on a prop is reported as the prop's and never
 * as a walk, whoever waits for a rolling prop is answered when the scene
 * says it rests (or at once when the prop is gone), and without WebGL the
 * props are drawings on the floor the player can still tap.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';

import { blobbiEvent } from '@/test/fixtures';
import type { RoomProp } from '../lib/room-props';

const fakeScene = vi.hoisted(() => ({
  status: 'ready' as 'ready' | 'unavailable',
  built: null as ((id: string) => void) | null,
  pick: vi.fn(),
  setProps: vi.fn(),
  kickProp: vi.fn(() => true),
  propPosition: vi.fn(() => ({ x: 5, z: 5 })),
  propResting: vi.fn(() => false),
  hop: vi.fn(),
  poke: vi.fn(),
  toggleLamp: vi.fn(() => false),
  walkTo: vi.fn(),
  requestWalk: vi.fn(async () => 'arrived'),
  stopWalk: vi.fn(),
  isWalking: vi.fn(() => false),
  actorModelDrawn: vi.fn(() => false),
  facingOf: vi.fn(() => 'front'),
  overActor: vi.fn(() => false),
  hoverAt: vi.fn(() => null),
  pressItem: vi.fn(),
  projectBlobbi: vi.fn(() => ({ x: 200, y: 400, pxPerTile: 40 })),
  projectFloor: vi.fn(() => ({ x: 260, y: 420, pxPerTile: 40 })),
  projectItemTop: vi.fn(() => ({ x: 150, y: 300, pxPerTile: 40 })),
  findSpot: vi.fn(() => null),
  floorAt: vi.fn(() => null),
  positionOf: vi.fn(() => ({ x: 4, z: 4 })),
}));
const hooks = vi.hoisted(() => ({ onPropRest: null as ((id: string) => void) | null }));
vi.mock('../hooks/useRoomScene', () => ({
  useRoomScene: (options: { onPropRest?: (id: string) => void }) => {
    hooks.onPropRest = options.onPropRest ?? null;
    return { status: fakeScene.status, sceneRef: { current: fakeScene.status === 'ready' ? fakeScene : null }, failure: fakeScene.status === 'ready' ? null : 'unsupported' };
  },
  webglAvailable: () => fakeScene.status === 'ready',
}));

import { RoomShell, type RoomControl } from './RoomShell';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3' }))!;
const BALL: RoomProp = { id: 'ball-1', kind: 'ball', x: 5, z: 5 };
const DISH: RoomProp = { id: 'dish-1', kind: 'dish', x: 3, z: 3, food: { emoji: '🍎' }, bites: { taken: 1, of: 4 } };

function renderShell(props: readonly RoomProp[], onPropTap = vi.fn()) {
  const controlRef: { current: RoomControl | null } = { current: null };
  const view = render(
    <RoomShell roomId="home" onChangeRoom={vi.fn()} isSleeping={false} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={roomFurnitureFor('home')} props={props} onPropTap={onPropTap} controlRef={controlRef} stage={<div data-testid="stage" />}>
      <div data-testid="dock">dock</div>
    </RoomShell>,
  );
  const surface = screen.getByTestId('room-shell').querySelector('.touch-none') as HTMLElement;
  if (surface) surface.setPointerCapture = vi.fn();
  return { view, surface, onPropTap, controlRef };
}

const press = (el: HTMLElement, type: string, x: number, y: number, pointerType = 'touch', pointerId = 1) =>
  fireEvent(el, new (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent(type, { clientX: x, clientY: y, pointerId, pointerType, isPrimary: true, bubbles: true } as PointerEventInit));

beforeEach(() => {
  fakeScene.status = 'ready';
  for (const fn of Object.values(fakeScene)) if (typeof fn === 'function' && 'mockClear' in fn) (fn as ReturnType<typeof vi.fn>).mockClear();
  fakeScene.kickProp.mockReturnValue(true);
  fakeScene.propResting.mockReturnValue(false);
});

describe('RoomShell and the props', () => {
  it('mirrors the props into the scene as they change, and clears them when there are none', () => {
    const { view } = renderShell([BALL, DISH]);
    expect(fakeScene.setProps).toHaveBeenLastCalledWith([BALL, DISH]);
    view.rerender(
      <RoomShell roomId="home" onChangeRoom={vi.fn()} isSleeping={false} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={roomFurnitureFor('home')} props={[]} stage={<div />}>
        <div />
      </RoomShell>,
    );
    expect(fakeScene.setProps).toHaveBeenLastCalledWith([]);
  });

  it.each([['touch'], ['mouse']])('a %s tap on a prop is the prop\'s: reported by id, never a walk or a poke', (pointerType) => {
    fakeScene.pick.mockReturnValue({ kind: 'prop', id: 'ball-1' });
    const { surface, onPropTap } = renderShell([BALL]);
    press(surface, 'pointerdown', 260, 410, pointerType);
    press(surface, 'pointerup', 262, 411, pointerType);
    expect(onPropTap).toHaveBeenCalledWith('ball-1');
    expect(fakeScene.walkTo).not.toHaveBeenCalled();
    expect(fakeScene.poke).not.toHaveBeenCalled();
    expect(fakeScene.hop).not.toHaveBeenCalled();
  });

  it('the control kicks and locates props through the scene, and answers whoever waits for a roll when the scene says it rests', async () => {
    const { controlRef } = renderShell([BALL]);
    const control = controlRef.current!;
    expect(control.kickProp('ball-1', { x: 1, z: 0 }, 3)).toBe(true);
    expect(fakeScene.kickProp).toHaveBeenCalledWith('ball-1', { x: 1, z: 0 }, 3);
    expect(control.propPosition('ball-1')).toEqual({ x: 5, z: 5 });
    expect(control.propResting('ball-1')).toBe(false);
    let rested = false;
    void control.whenPropRests('ball-1').then(() => { rested = true; });
    await act(async () => {});
    expect(rested).toBe(false);
    act(() => hooks.onPropRest?.('ball-1'));
    await act(async () => {});
    expect(rested).toBe(true);
    // Already still: answered at once
    fakeScene.propResting.mockReturnValue(true);
    let soon = false;
    void control.whenPropRests('ball-1').then(() => { soon = true; });
    await act(async () => {});
    expect(soon).toBe(true);
  });

  it('a prop that goes while someone waits for it lets them go too', async () => {
    const { controlRef, view } = renderShell([BALL]);
    let rested = false;
    void controlRef.current!.whenPropRests('ball-1').then(() => { rested = true; });
    view.rerender(
      <RoomShell roomId="home" onChangeRoom={vi.fn()} isSleeping={false} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor('home')} furniturePlacements={roomFurnitureFor('home')} props={[]} controlRef={controlRef} stage={<div />}>
        <div />
      </RoomShell>,
    );
    await act(async () => {});
    expect(rested).toBe(true);
  });

  it('without WebGL the props are drawings on the floor: the dish with its food smaller for the bites, the ball a button that taps', () => {
    fakeScene.status = 'unavailable';
    const onPropTap = vi.fn();
    renderShell([BALL, DISH], onPropTap);
    const props = screen.getAllByTestId('room-prop');
    expect(props.map((p) => p.dataset.kind).sort()).toEqual(['ball', 'dish']);
    const dish = props.find((p) => p.dataset.kind === 'dish')!;
    expect(dish).toHaveAttribute('data-bites', '1');
    expect(dish.style.getPropertyValue('--left')).toBe('0.75');
    fireEvent.click(screen.getByRole('button', { name: 'Ball' }));
    expect(onPropTap).toHaveBeenCalledWith('ball-1');
    expect(fakeScene.setProps).not.toHaveBeenCalled();
  });
});
