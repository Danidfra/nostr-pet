/**
 * A room scene under way when the page is hidden ends then and there: the
 * next room is on screen, nothing stays locked, and coming back does not
 * play the scene's remaining sounds all at once.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRoomTransitions } from './useRoomTransitions';
import type { RoomControl } from '../components/RoomShell';

function control(): RoomControl {
  const fns: Record<string, unknown> = {
    canChoreograph: () => true,
    blobbiPosition: () => ({ x: 4, z: 4 }),
    standPointNear: (x: number, z: number) => ({ x, z }),
    tileFree: () => true,
    holdIntro: () => false,
  };
  return new Proxy({}, { get: (_, key: string) => fns[key] ?? (() => undefined) }) as RoomControl;
}

describe('a room scene and a hidden page', () => {
  it('ends when the page is hidden, and no pile of sounds follows on the way back', () => {
    const play = vi.fn();
    const { result } = renderHook(() =>
      useRoomTransitions({
        initialRoom: 'home',
        controlRef: { current: control() },
        boxRef: { current: null },
        memory: { seen: () => true, markSeen: () => {}, positionIn: () => null, rememberPosition: () => {} },
        canAct: () => true,
        reducedMotion: () => false,
        play,
        showFace: () => {},
        clearFace: () => {},
        random: () => 0.5,
      }),
    );
    act(() => {
      result.current.forceNext('big-jump');
      result.current.request('kitchen');
    });
    expect(result.current.transitioning).toBe(true);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.transitioning).toBe(false);
    expect(result.current.shownRoom).toBe('kitchen');
    const played = play.mock.calls.length;
    hidden.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(play.mock.calls.length).toBe(played);
    hidden.mockRestore();
  });
});

describe('a scene forced for a room already under way', () => {
  it('is dropped, not left armed for the next real navigation', () => {
    const { result } = renderHook(() =>
      useRoomTransitions({
        initialRoom: 'home',
        controlRef: { current: control() },
        boxRef: { current: null },
        memory: { seen: () => true, markSeen: () => {}, positionIn: () => null, rememberPosition: () => {} },
        canAct: () => true,
        reducedMotion: () => false,
        play: () => {},
        showFace: () => {},
        clearFace: () => {},
        random: () => 0.5,
      }),
    );
    act(() => {
      result.current.forceNext('big-jump');
      result.current.request('kitchen');
    });
    expect(result.current.kind).toBe('big-jump');
    // The dev tools' scrubber: a held scene asked for the room already on its way
    act(() => {
      result.current.forceNext('outside', { holdAt: 100 });
      result.current.request('kitchen');
    });
    act(() => result.current.cancel());
    expect(result.current.transitioning).toBe(false);
    // The next navigation plays its own scene, not the stale held one
    act(() => result.current.request('home'));
    expect(result.current.kind).not.toBe('outside');
    expect(result.current.transitioning).toBe(true);
  });
});
