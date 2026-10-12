/**
 * The decorator's chrome: the catalog shows what the room allows, a tile
 * adds a piece and picks it up, the top bar reports overlaps and keeps Save
 * for a clean room, the tray edits the wallpaper and flooring, and the
 * floating toolbar turns, sizes, nudges and puts away the selected piece.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RoomDecoratorOverlay, RoomDecoratorToolbar } from './RoomDecorator';
import type { RoomControl } from './RoomShell';
import { MAX_FURNITURE_PER_ROOM, roomFurnitureFor, type FurniturePlacement } from '../lib/room-furniture';
import { roomLayoutFor, type RoomLayout } from '../lib/room-layout';
import { OFFICIAL_FURNITURE_3D } from '../lib/furniture-3d';
import type { RoomId } from '@/features/home/rooms/rooms';

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

function overlay(roomId: RoomId = 'home', draft: FurniturePlacement[] = [...roomFurnitureFor(roomId)], extra: Partial<React.ComponentProps<typeof RoomDecoratorOverlay>> = {}) {
  const onLayoutChange = vi.fn<(layout: RoomLayout) => void>();
  const props = {
    roomId,
    draft,
    onDraftChange: vi.fn(),
    layout: roomLayoutFor(roomId) as RoomLayout,
    onLayoutChange,
    selectedIndex: null,
    onSelect: vi.fn(),
    invalid: new Set<number>(),
    controlRef: { current: null } as React.MutableRefObject<RoomControl | null>,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...extra,
  };
  const utils = wrap(<RoomDecoratorOverlay {...props} />);
  return { ...utils, props, onLayoutChange };
}

describe('RoomDecoratorOverlay', () => {
  it('shows the catalog the room allows, grouped, with every official piece reachable somewhere', () => {
    const home = overlay('home');
    expect(screen.getByTestId('catalog-official:toybox')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-official:fridge')).toBeNull(); // kitchen only
    expect(screen.queryByTestId('decorator-tab-objects')).toBeNull(); // network objects: a later milestone
    home.unmount();
    const kitchen = overlay('kitchen');
    expect(screen.getByTestId('catalog-official:fridge')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-official:bed-single')).toBeNull();
    kitchen.unmount();
    // Every piece allowed anywhere is in some room's catalog
    const ids = new Set<string>();
    for (const room of ['home', 'kitchen', 'care', 'rest', 'closet'] as const) {
      const { unmount } = overlay(room, []);
      for (const tab of ['furniture', 'decor', 'plants', 'clocks', 'frames'] as const) {
        const button = screen.queryByTestId(`decorator-tab-${tab}`);
        if (!button) continue;
        fireEvent.click(button);
        document.querySelectorAll('[data-testid^="catalog-official:"]').forEach((el) => ids.add(el.getAttribute('data-testid')!.slice('catalog-'.length)));
      }
      unmount();
    }
    expect([...ids].sort()).toEqual(OFFICIAL_FURNITURE_3D.map((d) => d.id).sort());
  });

  it('a tile adds the piece at a spot the room gives (or the middle without a room) and picks it up', () => {
    const findSpot = vi.fn(() => ({ at: 'floor' as const, x: 2.5, y: 3.5 }));
    const { props, unmount } = overlay('home', [], { controlRef: { current: { findSpot, floorAt: () => null, walkTo: async () => 'refused', approach: async () => 'refused', stop: () => {}, pickAt: () => null, blobbiPosition: () => null, hop: () => {}, gesture: () => {}, gaze: () => {}, journey: () => {}, journeyPreview: () => {}, face: () => {}, pose: () => {}, script: () => {}, wallsCover: () => {}, tileFree: () => true, skyAt: () => 12, standPointNear: (x: number, z: number) => ({ x, z }), canChoreograph: () => false, render: () => {}, holdIntro: () => {}, stats: () => null, kickProp: () => false, propPosition: () => null, propResting: () => true, whenPropRests: async () => {}, } } });
    fireEvent.click(screen.getByTestId('catalog-official:toybox'));
    expect(findSpot).toHaveBeenCalledWith(expect.objectContaining({ official: true, mount: 'floor' }));
    expect(props.onDraftChange).toHaveBeenCalledWith([{ id: 'official:toybox', at: 'floor', x: 2.5, y: 3.5 }]);
    expect(props.onSelect).toHaveBeenCalledWith(0);
    unmount();
    // A wall piece from the decor tab, with no 3D room: the middle of the left wall
    const flat = overlay('home', []);
    fireEvent.click(screen.getByTestId('decorator-tab-decor'));
    fireEvent.click(screen.getByTestId('catalog-official:lamp-wall'));
    expect(flat.props.onDraftChange).toHaveBeenCalledWith([{ id: 'official:lamp-wall', at: 'left', x: 4, y: 2.5 }]);
  });

  it('a full room, or a room with no space, refuses with a notice and adds nothing', () => {
    const full = Array.from({ length: MAX_FURNITURE_PER_ROOM }, () => ({ id: 'official:plant-small', at: 'floor' as const, x: 1, y: 1 }));
    const { props, unmount } = overlay('home', full);
    // At the limit every tile is off (as on Ditto) and the count says so
    expect(screen.getByTestId('catalog-official:toybox')).toBeDisabled();
    fireEvent.click(screen.getByTestId('catalog-official:toybox'));
    expect(props.onDraftChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('decorator-hint')).toHaveTextContent(`${MAX_FURNITURE_PER_ROOM}/${MAX_FURNITURE_PER_ROOM}`);
    unmount();
    const crowded = overlay('home', [], { controlRef: { current: { findSpot: () => null, floorAt: () => null, walkTo: async () => 'refused', approach: async () => 'refused', stop: () => {}, pickAt: () => null, blobbiPosition: () => null, hop: () => {}, gesture: () => {}, gaze: () => {}, journey: () => {}, journeyPreview: () => {}, face: () => {}, pose: () => {}, script: () => {}, wallsCover: () => {}, tileFree: () => true, skyAt: () => 12, standPointNear: (x: number, z: number) => ({ x, z }), canChoreograph: () => false, render: () => {}, holdIntro: () => {}, stats: () => null, kickProp: () => false, propPosition: () => null, propResting: () => true, whenPropRests: async () => {}, } } });
    fireEvent.click(screen.getByTestId('catalog-official:toybox'));
    expect(crowded.props.onDraftChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('decorator-hint')).toHaveTextContent('No space left');
  });

  it('the top bar: cancel and save, Save held back while pieces overlap, the hint naming the selection', () => {
    const { props, unmount } = overlay('home', undefined, { invalid: new Set([0, 1]) });
    expect(screen.getByTestId('decorator-save')).toBeDisabled();
    expect(screen.getByTestId('decorator-hint')).toHaveTextContent('overlap');
    fireEvent.click(screen.getByTestId('decorator-cancel'));
    expect(props.onCancel).toHaveBeenCalled();
    unmount();
    const clean = overlay('home', undefined, { selectedIndex: 1 });
    expect(screen.getByTestId('decorator-save')).toBeEnabled();
    expect(screen.getByTestId('decorator-hint')).toHaveTextContent('Toy Box');
    fireEvent.click(screen.getByTestId('decorator-save'));
    expect(clean.props.onSave).toHaveBeenCalled();
    expect(screen.getByTestId('decorator-bar')).toHaveTextContent('Decorating Living room');
  });

  it('the wallpaper and flooring tabs edit the layout through validated choices, and match the theme', () => {
    const { props, onLayoutChange } = overlay('home');
    fireEvent.click(screen.getByTestId('decorator-tab-wall'));
    fireEvent.click(screen.getByTestId('surface-style-dots'));
    expect(props.onLayoutChange).toHaveBeenLastCalledWith({ ...roomLayoutFor('home'), wall: { ...roomLayoutFor('home').wall, style: 'dots', variant: undefined } });
    fireEvent.click(screen.getByTestId('surface-angle-45'));
    expect(props.onLayoutChange).toHaveBeenLastCalledWith(expect.objectContaining({ wall: expect.objectContaining({ angle: 45 }) }));
    fireEvent.click(screen.getByTestId('decorator-tab-floor'));
    expect(screen.getByTestId('surface-editor-floor')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('surface-variant-narrow'));
    expect(props.onLayoutChange).toHaveBeenLastCalledWith(expect.objectContaining({ floor: expect.objectContaining({ style: 'wood', variant: 'narrow' }) }));
    fireEvent.click(screen.getByTestId('decorator-match-theme'));
    const themed = onLayoutChange.mock.lastCall![0];
    expect(themed.floor.style).toBe('wood');
    expect(themed.floor.palette).toHaveLength(2);
    for (const c of themed.floor.palette) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(screen.getByTestId('surface-swatch').style.background).toContain('repeating-linear-gradient');
  });

  it('keyboard users pick placed pieces in turn with the tray arrows', () => {
    const { props } = overlay('home', undefined, { selectedIndex: null });
    fireEvent.click(screen.getByTestId('decorator-next-piece'));
    expect(props.onSelect).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByTestId('decorator-previous-piece'));
    expect(props.onSelect).toHaveBeenLastCalledWith(roomFurnitureFor('home').length - 1);
  });
});

describe('RoomDecoratorToolbar', () => {
  const draft = (): FurniturePlacement[] => [
    { id: 'official:table-side', at: 'floor', x: 4, y: 4 },
    { id: 'official:clock-wall', at: 'right', x: 3, y: 3 },
  ];

  it('turns, sizes and puts away the selected piece, and turns only floor pieces', () => {
    const onDraftChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(<RoomDecoratorToolbar draft={draft()} onDraftChange={onDraftChange} selectedIndex={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('decorator-turn'));
    expect(onDraftChange).toHaveBeenLastCalledWith([{ ...draft()[0], rot: 1 }, draft()[1]]);
    fireEvent.click(screen.getByTestId('decorator-bigger'));
    expect(onDraftChange).toHaveBeenLastCalledWith([{ ...draft()[0], scale: 1.25 }, draft()[1]]);
    expect(screen.getByTestId('decorator-smaller')).toBeEnabled();
    fireEvent.click(screen.getByTestId('decorator-put-away'));
    expect(onDraftChange).toHaveBeenLastCalledWith([draft()[1]]);
    expect(onSelect).toHaveBeenLastCalledWith(null);
    rerender(<RoomDecoratorToolbar draft={draft()} onDraftChange={onDraftChange} selectedIndex={1} onSelect={onSelect} />);
    expect(screen.queryByTestId('decorator-turn')).toBeNull();
    rerender(<RoomDecoratorToolbar draft={[{ ...draft()[0], scale: 2 }]} onDraftChange={onDraftChange} selectedIndex={0} onSelect={onSelect} />);
    expect(screen.getByTestId('decorator-bigger')).toBeDisabled();
  });

  it('R turns, the arrows nudge a tile, Delete puts away, Escape lets go; typing in a field does none of it', () => {
    const onDraftChange = vi.fn();
    const onSelect = vi.fn();
    render(<RoomDecoratorToolbar draft={draft()} onDraftChange={onDraftChange} selectedIndex={0} onSelect={onSelect} />);
    fireEvent.keyDown(window, { key: 'r' });
    expect(onDraftChange).toHaveBeenLastCalledWith([{ ...draft()[0], rot: 1 }, draft()[1]]);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onDraftChange).toHaveBeenLastCalledWith([{ ...draft()[0], x: 5 }, draft()[1]]);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onDraftChange).toHaveBeenLastCalledWith([{ ...draft()[0], y: 3 }, draft()[1]]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSelect).toHaveBeenLastCalledWith(null);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onDraftChange).toHaveBeenLastCalledWith([draft()[1]]);
    const input = document.createElement('input');
    document.body.appendChild(input);
    onDraftChange.mockClear();
    fireEvent.keyDown(input, { key: 'r' });
    expect(onDraftChange).not.toHaveBeenCalled();
    input.remove();
  });
});
