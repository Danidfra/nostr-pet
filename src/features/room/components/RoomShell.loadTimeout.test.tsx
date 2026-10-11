/**
 * A 3D room that never finishes loading (a stalled download, a GPU that
 * never answers) does not leave the player on a loading screen: after
 * `LOAD_TIMEOUT_MS` the simple room is shown, with a note, and the engine
 * is not asked again this visit.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';

import { blobbiEvent } from '@/test/fixtures';

// The engine module never arrives
vi.mock('../lib/scene/RoomScene', () => new Promise(() => {}));

import { RoomShell } from './RoomShell';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';
import { LOAD_TIMEOUT_MS } from '../hooks/useRoomScene';

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3' }))!;

HTMLCanvasElement.prototype.getContext = vi.fn((kind: string) => (kind === 'webgl2' ? { getExtension: () => ({ loseContext() {} }) } : null)) as unknown as HTMLCanvasElement['getContext'];

function Room() {
  return (
    <RoomShell
      roomId="home"
      onChangeRoom={() => {}}
      isSleeping={false}
      blobbiStage={brook.stage}
      blobbiVisible
      roomLayout={roomLayoutFor('home')}
      furniturePlacements={roomFurnitureFor('home')}
      stage={<div data-testid="stage" />}
      onDecorate={() => {}}
      blobbiModel={null}
    >
      <div data-testid="dock">dock</div>
    </RoomShell>
  );
}

describe('a 3D room that never loads', () => {
  it('gives way to the simple room in time, says so, and is not tried again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render(<Room />);
      const shell = screen.getByTestId('room-shell');
      expect(shell).toHaveAttribute('data-scene', 'loading');
      await act(async () => { await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS - 100); });
      expect(shell).toHaveAttribute('data-scene', 'loading');
      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
      expect(shell).toHaveAttribute('data-scene', 'unavailable');
      expect(screen.getByTestId('room-fallback-note')).toHaveAttribute('data-reason', 'slow');
      expect(screen.getByTestId('stage')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(shell).toHaveAttribute('data-scene', 'unavailable');
    } finally {
      vi.useRealTimers();
    }
  });
});
