/**
 * Decorating as state: a draft that starts as the room, edits that touch
 * only the draft, Cancel that drops it, Save that hands over only what
 * changed, a room change that discards it (as on Ditto), and nothing
 * written to storage or a relay anywhere along the way.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { RoomId } from '@/features/home/rooms/rooms';
import { useRoomDecorator } from './useRoomDecorator';
import { roomFurnitureFor } from '../lib/room-furniture';
import { roomLayoutFor } from '../lib/room-layout';

afterEach(() => vi.restoreAllMocks());

function setup(roomId: RoomId = 'home') {
  const onSave = vi.fn();
  const furniture = roomFurnitureFor(roomId);
  const layout = roomLayoutFor(roomId);
  const hook = renderHook(({ room }) => useRoomDecorator({ roomId: room, furniture: roomFurnitureFor(room), layout: roomLayoutFor(room), onSave }), { initialProps: { room: roomId } });
  return { ...hook, onSave, furniture, layout };
}

describe('useRoomDecorator', () => {
  it('opens with a copy of the room pinned, and cancels back to nothing', () => {
    const { result, furniture, layout } = setup();
    expect(result.current.editing).toBe(false);
    act(() => result.current.open());
    expect(result.current.editing).toBe(true);
    expect(result.current.room).toBe('home');
    expect(result.current.draft).toEqual(furniture);
    expect(result.current.draft).not.toBe(furniture);
    expect(result.current.layoutDraft).toBe(layout);
    act(() => result.current.cancel());
    expect(result.current.editing).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(result.current.room).toBeNull();
  });

  it('edits touch the draft only; cancel leaves the room as it was and saves nothing', () => {
    const { result, furniture, onSave } = setup();
    act(() => result.current.open());
    act(() => result.current.setDraft([...result.current.draft!, { id: 'official:plant-small', at: 'floor', x: 1, y: 1 }]));
    act(() => result.current.move(0, { ...result.current.draft![0], x: 7, y: 7 }));
    act(() => result.current.select(0));
    expect(result.current.draft).toHaveLength(furniture.length + 1);
    expect(result.current.draft![0].x).toBe(7);
    expect(result.current.selectedIndex).toBe(0);
    expect(roomFurnitureFor('home')).toBe(furniture);
    act(() => result.current.cancel());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('save hands over only what changed: furniture, or the layout, or both, or nothing', () => {
    const { result, onSave } = setup();
    act(() => result.current.open());
    act(() => result.current.save());
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);

    act(() => result.current.open());
    const placed = { id: 'official:plant-small' as const, at: 'floor' as const, x: 1, y: 1 };
    act(() => result.current.setDraft([...result.current.draft!, placed]));
    act(() => result.current.save());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe('home');
    expect(onSave.mock.calls[0][1]).toEqual({ furniture: [...roomFurnitureFor('home'), placed] });
    expect(result.current.editing).toBe(false);

    act(() => result.current.open());
    const wall = { style: 'solid' as const, palette: ['#ffffff'] };
    act(() => result.current.setLayoutDraft({ ...result.current.layoutDraft!, wall }));
    act(() => result.current.save());
    expect(onSave.mock.calls[1][1]).toEqual({ layout: { ...roomLayoutFor('home'), wall } });
    expect(onSave.mock.calls[1][1]).not.toHaveProperty('furniture');
  });

  it('overlaps block nothing here but are kept for the chrome; the selection follows the shell', () => {
    const { result } = setup();
    act(() => result.current.open());
    act(() => result.current.setInvalid(new Set([1, 2])));
    expect([...result.current.invalid]).toEqual([1, 2]);
    act(() => result.current.select(2));
    expect(result.current.selectedIndex).toBe(2);
    act(() => result.current.select(null));
    expect(result.current.selectedIndex).toBeNull();
  });

  it('going to another room while decorating discards the draft without saving', () => {
    const { result, rerender, onSave } = setup('home');
    act(() => result.current.open());
    act(() => result.current.setDraft([]));
    rerender({ room: 'kitchen' });
    expect(result.current.editing).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('writes nothing to localStorage at any step', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = setup();
    act(() => result.current.open());
    act(() => result.current.setDraft([]));
    act(() => result.current.save());
    expect(setItem).not.toHaveBeenCalled();
  });
});
