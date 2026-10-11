/**
 * When 3D cannot be had, the room steps down to the simple room and says
 * so, once: without WebGL, when the renderer cannot be made (never tried
 * again this visit), and when the GPU keeps dropping the context (a few
 * fresh canvases, then no more). The scene's resources are released each
 * time; the Blobbi and the dock stay; the note can be dismissed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';

import { blobbiEvent } from '@/test/fixtures';

const made = vi.hoisted(() => ({ scenes: [] as FakeScene[], attempts: 0, throwOnCreate: false }));

class FakeScene {
  disposed = false;
  constructor(public canvas: HTMLCanvasElement) {
    made.attempts++;
    if (made.throwOnCreate) throw new Error('Error creating WebGL context.');
    made.scenes.push(this);
  }
  setGeometry() {}
  setLayout() {}
  setItems() {}
  setBlobbi() {}
  setGuests() {}
  setEditing() {}
  setParallax() {}
  dispose() { this.disposed = true; }
  projectBlobbi() { return { x: 100, y: 200, pxPerTile: 30 }; }
  projectFloor() { return { x: 100, y: 200, pxPerTile: 30 }; }
  projectItemTop() { return { x: 100, y: 150, pxPerTile: 30 }; }
  facingOf() { return 'front' as const; }
  isWalking() { return false; }
  actorModelDrawn() { return false; }
  pick() { return null; }
  findSpot() { return { at: 'floor' as const, x: 2, y: 2 }; }
  floorAt() { return null; }
  requestWalk() { return Promise.resolve('refused' as const); }
  stopWalk() {}
  setActorModel() {}
}
vi.mock('../lib/scene/RoomScene', () => ({ RoomScene: FakeScene }));

import { RoomShell } from './RoomShell';
import { roomLayoutFor } from '../lib/room-layout';
import { roomFurnitureFor } from '../lib/room-furniture';

const brook = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3' }))!;

function withWebgl(available: boolean) {
  HTMLCanvasElement.prototype.getContext = vi.fn((kind: string) => (available && kind === 'webgl2' ? { getExtension: () => ({ loseContext() {} }) } : null)) as unknown as HTMLCanvasElement['getContext'];
}

beforeEach(() => {
  made.scenes.length = 0;
  made.attempts = 0;
  made.throwOnCreate = false;
  withWebgl(true);
});

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

const shell = () => screen.getByTestId('room-shell');

describe('the room without 3D', () => {
  it('a renderer that cannot be made: the simple room at once, a note saying so, and no second attempt', async () => {
    made.throwOnCreate = true;
    render(<Room />);
    await waitFor(() => expect(shell()).toHaveAttribute('data-scene', 'unavailable'));
    expect(screen.getByTestId('room-fallback-note')).toHaveAttribute('data-reason', 'unsupported');
    expect(screen.getByTestId('stage')).toBeInTheDocument();
    expect(screen.getByTestId('dock')).toBeInTheDocument();
    // Past the retry delay: still the one attempt
    await act(() => new Promise((r) => setTimeout(r, 2300)));
    expect(made.attempts).toBe(1);
    expect(shell()).toHaveAttribute('data-scene', 'unavailable');
  });

  it('the note can be dismissed, and the room stays usable', async () => {
    made.throwOnCreate = true;
    render(<Room />);
    const note = await screen.findByTestId('room-fallback-note');
    fireEvent.click(note.querySelector('button')!);
    expect(screen.queryByTestId('room-fallback-note')).toBeNull();
    expect(screen.getByTestId('room-nav-right')).toBeEnabled();
  });

  it('a context lost again and again: fresh canvases a few times, quietly, then the simple room for good, with a note', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render(<Room />);
      const settle = async (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
      await settle(10);
      for (let lost = 1; lost <= 4; lost++) {
        expect(shell()).toHaveAttribute('data-scene', 'ready');
        const scene = made.scenes[made.scenes.length - 1];
        act(() => { fireEvent(scene.canvas, new Event('webglcontextlost', { cancelable: true })); });
        await settle(0);
        expect(scene.disposed).toBe(true);
        expect(shell()).toHaveAttribute('data-scene', 'unavailable');
        if (lost <= 3) {
          // Still trying: nothing to tell the player yet
          expect(screen.queryByTestId('room-fallback-note')).toBeNull();
          await settle(2100);
        }
      }
      expect(screen.getByTestId('room-fallback-note')).toHaveAttribute('data-reason', 'lost');
      await settle(10_000);
      expect(made.scenes).toHaveLength(4);
      expect(shell()).toHaveAttribute('data-scene', 'unavailable');
    } finally {
      vi.useRealTimers();
    }
  });
});
