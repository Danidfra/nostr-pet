/**
 * The navigation hook: the movement contract the rest of the app sees. It
 * mirrors what the shell reports (facing, walking or idle) into state, routes
 * walks through the room's control handle, and refuses when there is no
 * 3D room, so a care flow written for the home's `walkTo` works over it.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { WalkOutcome } from '@/features/home/scene/useBlobbiLocomotion';
import type { RoomControl } from '../components/RoomShell';
import { MAIN_BLOBBI } from '../lib/room-geometry';
import { useRoomNavigation } from './useRoomNavigation';

/** A room control that remembers walks and settles them on demand. */
function fakeControl() {
  const pending: Array<(o: WalkOutcome) => void> = [];
  const control: RoomControl = {
    findSpot: () => null,
    floorAt: () => null,
    walkTo: vi.fn(() => new Promise<WalkOutcome>((resolve) => { pending.push(resolve); })),
    approach: vi.fn(() => new Promise<WalkOutcome>((resolve) => { pending.push(resolve); })),
    stop: vi.fn(() => { pending.splice(0).forEach((r) => r('stopped')); }),
    pickAt: () => null,
    blobbiPosition: () => null,
    hop: () => {},
    gesture: () => {},
    gaze: () => {},
    journey: () => {},
    journeyPreview: () => {},
  };
  return { control, settle: (o: WalkOutcome) => pending.shift()?.(o), pending };
}

const awake = { stage: 'adult', state: 'active' } as const;

describe('useRoomNavigation', () => {
  it('stands facing front, cannot walk and refuses walks before the room is 3D', async () => {
    const { result } = renderHook(() => useRoomNavigation({ blobbi: awake }));
    expect(result.current.motion).toBe('idle');
    expect(result.current.facing).toBe('front');
    expect(result.current.canWalk).toBe(false);
    expect(await result.current.walkTo(1, 1)).toBe('refused');
    expect(await result.current.approach(1, 1)).toBe('refused');
  });

  it('once the room is ready, walks and approaches go through the control and resolve as the room says', async () => {
    const { control, settle } = fakeControl();
    const { result } = renderHook(() => useRoomNavigation({ blobbi: awake }));
    act(() => {
      result.current.shellProps.controlRef.current = control;
      result.current.shellProps.onStatusChange('ready');
    });
    expect(result.current.canWalk).toBe(true);
    const walk = result.current.walkTo(2, 3);
    expect(control.walkTo).toHaveBeenCalledWith(2, 3);
    settle('arrived');
    expect(await walk).toBe('arrived');
    const stop = result.current.approach(5, 5);
    expect(control.approach).toHaveBeenCalledWith(5, 5);
    result.current.stop();
    expect(await stop).toBe('stopped');
  });

  it('mirrors the shell\'s report of the user\'s Blobbi only, and only on changes', () => {
    const { result } = renderHook(() => useRoomNavigation({ blobbi: awake }));
    const first = result.current;
    act(() => result.current.shellProps.onActorChange('guest-1', { facing: 'left', motion: 'walking' }));
    expect(result.current).toBe(first);
    act(() => result.current.shellProps.onActorChange(MAIN_BLOBBI, { facing: 'left', motion: 'walking' }));
    expect(result.current.facing).toBe('left');
    expect(result.current.motion).toBe('walking');
    const walking = result.current;
    act(() => result.current.shellProps.onActorChange(MAIN_BLOBBI, { facing: 'left', motion: 'walking' }));
    expect(result.current).toBe(walking);
    act(() => result.current.shellProps.onActorChange(MAIN_BLOBBI, { facing: 'front', motion: 'idle' }));
    expect(result.current.motion).toBe('idle');
    expect(result.current.facing).toBe('front');
  });

  it('an egg, a sleeper and a decorated room cannot walk, whatever the scene', () => {
    const ready = (blobbi: { stage: 'egg' | 'baby' | 'adult'; state: 'active' | 'sleeping' }, editing = false) => {
      const { result } = renderHook(() => useRoomNavigation({ blobbi, editing }));
      act(() => result.current.shellProps.onStatusChange('ready'));
      return result.current.canWalk;
    };
    expect(ready({ stage: 'egg', state: 'active' })).toBe(false);
    expect(ready({ stage: 'adult', state: 'sleeping' })).toBe(false);
    expect(ready({ stage: 'adult', state: 'active' }, true)).toBe(false);
    expect(ready({ stage: 'baby', state: 'active' })).toBe(true);
  });
});
