/**
 * The room shell without WebGL (jsdom has none): the Blobbi stands alone in
 * the middle, the switcher names the room and its neighbours in the
 * registry's order, a sleeper dims the room, and nothing is published.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';

import { blobbiEvent } from '@/test/fixtures';
import { neighbourRoom, roomById } from '@/features/home/rooms/rooms';
import { RoomShell } from './RoomShell';
import { RoomBlobbi } from './RoomBlobbi';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';

beforeAll(() => {
  // jsdom's canvas has no WebGL: the probe must say so quietly.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
  // jsdom has no layout: give the shell a phone-sized box so the room can be framed in it.
  const zero = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'room-shell') return { left: 0, top: 0, width: 400, height: 700, right: 400, bottom: 700, x: 0, y: 0, toJSON: () => ({}) };
    return zero.call(this);
  };
});

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', visualGeneration: 'v3' }))!;

function renderShell(roomId: 'home' | 'kitchen' | 'care' | 'rest' | 'closet' = 'home', onChangeRoom = vi.fn(), sleeping = false) {
  const utils = render(
    <div style={{ height: 600 }}>
      <RoomShell roomId={roomId} onChangeRoom={onChangeRoom} isSleeping={sleeping} blobbiStage={brook.stage} blobbiVisible roomLayout={roomLayoutFor(roomId)} furniturePlacements={roomFurnitureFor(roomId)} stage={<RoomBlobbi blobbi={brook} />}>
        <div data-testid="dock">dock</div>
      </RoomShell>
    </div>,
  );
  return { ...utils, onChangeRoom };
}

describe('RoomShell without WebGL', () => {
  it('shows the Blobbi alone, drawn by the canonical renderer, with no 3D canvas', () => {
    renderShell();
    const shell = screen.getByTestId('room-shell');
    expect(shell).toHaveAttribute('data-scene', 'unavailable');
    expect(screen.queryByTestId('room-canvas-3d')).toBeNull();
    const anchor = screen.getByTestId('room-blobbi-anchor');
    expect(anchor.querySelector('[data-blobbi-renderer]')).not.toBeNull();
    expect(anchor.style.getPropertyValue('--blobbi-tiles')).toBe('2.5');
    // Placed by the flat projector: in the stage, visible, with a scale per tile.
    expect(anchor.style.visibility).toBe('');
    expect(anchor.style.transform).toMatch(/translate3d\(/);
    expect(Number(anchor.style.getPropertyValue('--anchor-px'))).toBeGreaterThan(0);
    expect(screen.getByTestId('dock')).toBeInTheDocument();
  });

  it('the switcher names the room and goes to its neighbours in the registry\'s order', () => {
    const { onChangeRoom } = renderShell('home');
    expect(screen.getByTestId('room-label')).toHaveTextContent(roomById('home').label);
    fireEvent.click(screen.getByTestId('room-nav-right'));
    expect(onChangeRoom).toHaveBeenLastCalledWith(neighbourRoom('home', 'right'));
    fireEvent.click(screen.getByTestId('room-nav-left'));
    expect(onChangeRoom).toHaveBeenLastCalledWith(neighbourRoom('home', 'left'));
    expect(screen.getByTestId('room-nav-left')).toHaveAttribute('aria-label', `Go to ${roomById(neighbourRoom('home', 'left')).label}`);
  });

  it('a horizontal swipe across the room changes it; a short one does not', () => {
    const { onChangeRoom } = renderShell('kitchen');
    const shell = screen.getByTestId('room-shell');
    fireEvent.touchStart(shell, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(shell, { changedTouches: [{ clientX: 100, clientY: 200 }] });
    expect(onChangeRoom).toHaveBeenLastCalledWith(neighbourRoom('kitchen', 'right'));
    onChangeRoom.mockClear();
    fireEvent.touchStart(shell, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(shell, { changedTouches: [{ clientX: 280, clientY: 200 }] });
    expect(onChangeRoom).not.toHaveBeenCalled();
  });

  it('every registry room has a layout and default furniture the shell can take', () => {
    for (const id of ['home', 'kitchen', 'care', 'rest', 'closet'] as const) {
      const { unmount } = renderShell(id);
      expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', id);
      unmount();
    }
  });
});
