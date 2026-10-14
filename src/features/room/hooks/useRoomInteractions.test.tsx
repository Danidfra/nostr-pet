/**
 * The ball's life after a game, at the hook over fakes: it lies in the
 * room; left alone past the idle time the Blobbi comes and picks it up (it
 * lifts and goes), or it goes by itself when the Blobbi cannot walk; a tap
 * resets the clock and is a free game; a change of room or decorating
 * clears it at once; nothing is written by any of it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HomeItem } from '@/features/inventory';
import type { RoomControl } from '../components/RoomShell';
import type { RoomCare } from './useRoomCare';
import { useRoomInteractions } from './useRoomInteractions';

const BALL = { itemId: 'blobbi:toy:ball', name: 'Ball', glyph: { type: 'emoji', text: '⚽' }, care: { action: 'play', effects: { happiness: 20 }, stages: ['baby', 'adult'] }, definition: null } as unknown as HomeItem;

function fakes() {
  const control = {
    blobbiPosition: vi.fn(() => ({ x: 4, z: 4 })),
    propPosition: vi.fn(() => ({ x: 5.5, z: 5.5 })),
    propResting: vi.fn(() => true),
    kickProp: vi.fn((id: string) => { state.kicks.push(id); return true; }),
    whenPropRests: vi.fn(async () => {}),
    bath: vi.fn(), itemFootprint: vi.fn(() => null), modelDrawn: vi.fn(() => false),
  } as unknown as RoomControl;
  const state = { props: new Set<string>(), kicks: [] as string[], walks: [] as { x: number; z: number; clear?: number }[], writes: 0 };
  const care = {
    offer: null,
    place: vi.fn(),
    begin: vi.fn(),
    startEating: vi.fn(),
    finish: vi.fn(),
    clear: vi.fn(),
    retry: vi.fn(() => null),
    notify: vi.fn(),
    celebrate: vi.fn(),
  } as unknown as RoomCare;
  const nav = { canWalk: true, approach: vi.fn(async (x: number, z: number, clear?: number) => { state.walks.push({ x, z, clear }); return 'arrived' as const; }), stop: vi.fn() };
  const play = vi.fn();
  const gesture = vi.fn();
  const showFace = vi.fn();
  const clearFace = vi.fn();
  return { control, state, care, nav, play, gesture, showFace, clearFace };
}

function setup(toyIdleMs = 400, overrides: Partial<{ canWalk: boolean }> = {}) {
  const f = fakes();
  f.nav.canWalk = overrides.canWalk ?? true;
  const controlRef = { current: f.control };
  const hook = renderHook(
    (props: { roomId: 'home' | 'kitchen'; enabled: boolean; present: boolean }) =>
      useRoomInteractions({ care: f.care, nav: f.nav, controlRef, roomId: props.roomId, present: props.present, enabled: props.enabled, reducedMotion: false, blobbiName: 'Brook', showFace: f.showFace, clearFace: f.clearFace, gesture: f.gesture, play: f.play, random: () => 0.5, toyIdleMs }),
    { initialProps: { roomId: 'home' as 'home' | 'kitchen', enabled: true, present: true } },
  );
  // The fake scene knows the props the hook lists
  const sync = () => { f.state.props = new Set(hook.result.current.props.map((p) => p.id)); };
  return { ...f, hook, sync };
}

describe('the ball after a game', () => {
  it('lies in the room; left alone, the Blobbi comes and picks it up (it lifts and goes), pleased; nothing written', async () => {
    const { hook, sync, state, care, gesture, play } = setup(400);
    act(() => hook.result.current.preview('ball', BALL));
    await waitFor(() => expect(state.kicks.length).toBeGreaterThanOrEqual(1), { timeout: 4000 });
    sync();
    await waitFor(() => expect(hook.result.current.activity).toBeNull(), { timeout: 6000 });
    sync();
    const ball = hook.result.current.props.find((p) => p.kind === 'ball');
    expect(ball).toBeDefined();
    const walksBefore = state.walks.length;
    // The idle time passes: it is tidied away
    await waitFor(() => expect(hook.result.current.activity).toBe('playing'), { timeout: 3000 });
    sync();
    await waitFor(() => expect(hook.result.current.props.find((p) => p.kind === 'ball')?.lifted).toBe(true), { timeout: 4000 });
    expect(state.walks.length).toBeGreaterThan(walksBefore);
    expect(state.walks[state.walks.length - 1].clear).toBeCloseTo(0.48, 5);
    expect(gesture).toHaveBeenCalledWith('bounce');
    expect(play).toHaveBeenCalledWith('pickup');
    await waitFor(() => expect(hook.result.current.props.find((p) => p.kind === 'ball')).toBeUndefined(), { timeout: 3000 });
    await waitFor(() => expect(hook.result.current.activity).toBeNull(), { timeout: 3000 });
    expect(care.begin).not.toHaveBeenCalled();
    expect(care.finish).not.toHaveBeenCalled();
  }, 20_000);

  it('a tap on it within the idle time is another game, free, and the clock starts again from the game\'s end', async () => {
    const { hook, sync, state, care } = setup(900);
    act(() => hook.result.current.preview('ball', BALL));
    await waitFor(() => expect(hook.result.current.activity).toBeNull(), { timeout: 8000 });
    sync();
    const ball = hook.result.current.props.find((p) => p.kind === 'ball')!;
    const kicked = state.kicks.length;
    act(() => hook.result.current.onPropTap(ball.id));
    expect(hook.result.current.activity).toBe('playing');
    await waitFor(() => expect(state.kicks.length).toBe(kicked + 2), { timeout: 6000 });
    await waitFor(() => expect(hook.result.current.activity).toBeNull(), { timeout: 6000 });
    sync();
    // Still there right after the game: the idle time is counted from now
    expect(hook.result.current.props.find((p) => p.kind === 'ball')).toBeDefined();
    expect(care.begin).not.toHaveBeenCalled();
    expect(care.celebrate).toHaveBeenCalledTimes(1); // the first game only
  }, 20_000);

  it('when the Blobbi cannot walk the ball goes by itself; a change of room or decorating takes it away at once', async () => {
    const still = setup(300, { canWalk: false });
    act(() => still.hook.result.current.preview('ball', BALL));
    await waitFor(() => expect(still.hook.result.current.activity).toBeNull(), { timeout: 8000 });
    still.sync();
    expect(still.hook.result.current.props.find((p) => p.kind === 'ball')).toBeDefined();
    await waitFor(() => expect(still.hook.result.current.props.find((p) => p.kind === 'ball')?.leaving).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(still.hook.result.current.props).toHaveLength(0), { timeout: 3000 });

    const moving = setup(60_000);
    act(() => moving.hook.result.current.preview('ball', BALL));
    await waitFor(() => expect(moving.hook.result.current.activity).toBeNull(), { timeout: 8000 });
    moving.sync();
    expect(moving.hook.result.current.props.find((p) => p.kind === 'ball')).toBeDefined();
    moving.hook.rerender({ roomId: 'kitchen', enabled: true, present: true });
    expect(moving.hook.result.current.props).toHaveLength(0);

    const decorating = setup(60_000);
    act(() => decorating.hook.result.current.preview('ball', BALL));
    await waitFor(() => expect(decorating.hook.result.current.activity).toBeNull(), { timeout: 8000 });
    decorating.sync();
    decorating.hook.rerender({ roomId: 'home', enabled: false, present: true });
    expect(decorating.hook.result.current.props.find((p) => p.kind === 'ball')?.leaving).toBe(true);
    await waitFor(() => expect(decorating.hook.result.current.props).toHaveLength(0), { timeout: 3000 });
  }, 30_000);
});
