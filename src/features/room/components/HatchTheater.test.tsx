/**
 * The hatch theatre over fakes: the beats in order (presented, stirring,
 * cracking, the held breath, the light while the write is out), the reveal
 * only after the write has landed and only with the baby the collection
 * holds, one write however often it is asked for, a failed write that leaves
 * the egg an egg with Try again (one more write) and Later, and the reduced
 * pace with nothing rocking.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import type { CeremonyTimings } from '@/features/lifecycle';
import { HatchTheater } from './HatchTheater';
import { revealMoment } from '../lib/hatch-theater';

const FAST: CeremonyTimings = { leadMs: 60, stepMs: 60, finalMs: 60, burstMs: 40, revealMs: 1_500 };
const egg = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Pip', stage: 'egg', visualGeneration: 'v3' }))!;
const baby = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Pip', stage: 'baby', visualGeneration: 'v3' }))!;

function deferred() {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
}

function stage(blobbi: BlobbiCompanion, perform: () => Promise<boolean>, extra: Partial<Parameters<typeof HatchTheater>[0]> = {}) {
  const onDone = vi.fn();
  const play = vi.fn();
  const view = render(<HatchTheater blobbi={blobbi} perform={perform} reducedMotion={false} play={play} onDone={onDone} timings={FAST} {...extra} />);
  const theater = () => screen.getByTestId('hatch-theater');
  return { view, onDone, play, theater };
}

describe('the hatch theatre', () => {
  it('builds up, writes once, and reveals the baby only after the write has landed; then hands it to its home', async () => {
    const write = deferred();
    const perform = vi.fn(() => write.promise);
    const { view, onDone, play, theater } = stage(egg, perform);
    const beats: string[] = [];
    const record = () => {
      const beat = theater().dataset.beat!;
      if (beats[beats.length - 1] !== beat) beats.push(beat);
    };
    record();
    await waitFor(() => {
      record();
      expect(theater()).toHaveAttribute('data-phase', 'publishing');
    }, { timeout: 2000 });
    expect(beats).toEqual(['presenting', 'stirring', 'cracking', 'breaking', 'hatching']);
    // The cracks were heard, the light gathering too; the shell is drawn at its heaviest crack
    expect(play.mock.calls.filter(([s]) => s === 'crack')).toHaveLength(3);
    expect(play).toHaveBeenCalledWith('gather');
    expect(screen.getByTestId('hatch-theater-writing')).toBeInTheDocument();
    // Waiting on the write: no reveal, however long it takes
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(theater()).toHaveAttribute('data-phase', 'publishing');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'egg');
    expect(perform).toHaveBeenCalledTimes(1);
    // It landed; the collection then holds the baby (a render later)
    await act(async () => write.resolve(true));
    expect(theater()).toHaveAttribute('data-phase', 'revealing');
    view.rerender(<HatchTheater blobbi={baby} perform={perform} reducedMotion={false} play={play} onDone={onDone} timings={FAST} />);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'baby');
    expect(screen.getByTestId('hatch-theater-actor').querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'baby');
    expect(play).toHaveBeenCalledWith('hatch');
    await waitFor(() => expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Pip has hatched!'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true), { timeout: 3000 });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('a failed write leaves the egg an egg, says so, is not retried by itself; Try again writes once more; Later lets it be', async () => {
    const perform = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    const { onDone, theater } = stage(egg, perform, { error: 'refused by the relays' });
    await waitFor(() => expect(theater()).toHaveAttribute('data-phase', 'failed'), { timeout: 2000 });
    const card = screen.getByTestId('hatch-theater-failed');
    expect(card).toHaveTextContent(/did not hatch yet/);
    expect(card).toHaveTextContent(/refused by the relays/);
    expect(card).toHaveTextContent(/your egg is safe/i);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'egg');
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(perform).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('hatch-theater-retry'));
    await waitFor(() => expect(perform).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await waitFor(() => expect(theater()).toHaveAttribute('data-phase', 'failed'), { timeout: 2000 });
    fireEvent.click(screen.getByTestId('hatch-theater-later'));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalledWith(true);
  });

  it('under StrictMode (the dev build mounts, unmounts and remounts effects) it still begins, and still writes once', async () => {
    const perform = vi.fn().mockResolvedValue(true);
    render(
      <StrictMode>
        <HatchTheater blobbi={egg} perform={perform} reducedMotion={false} play={vi.fn()} onDone={vi.fn()} timings={FAST} />
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByTestId('hatch-theater')).toHaveAttribute('data-phase', 'revealing'), { timeout: 2000 });
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: nothing rocks or hops, the words and faces tell it', async () => {
    const perform = vi.fn().mockResolvedValue(true);
    const { theater } = stage(egg, perform, { reducedMotion: true });
    expect(theater()).toHaveAttribute('data-reduced', 'true');
    await waitFor(() => expect(theater()).toHaveAttribute('data-beat', 'cracking'), { timeout: 2000 });
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-rock', '0');
  });
});

describe('the baby\'s first moments', () => {
  it('blinks into the light, looks left and right, notices the player, is shy, then glad and hops; home after', () => {
    const at = (t: number) => revealMoment(t, false);
    expect(at(100).caption).toBe('none');
    expect(at(800).eyes?.x).toBeLessThan(-0.5);
    expect(at(1_500).eyes?.x).toBeGreaterThan(0.5);
    expect(at(2_000).face).toBe('surprised');
    expect(at(2_800).face).toMatchObject({ blush: 'strong', mouth: 'smile' });
    expect(at(3_600).hop).toBe(true);
    expect(at(4_500)).toMatchObject({ hop: false, caption: 'home' });
    // Reduced: no hop at any moment, the same story quicker
    for (const t of [0, 500, 1_000, 2_000, 3_000]) expect(revealMoment(t, true).hop).toBe(false);
    expect(revealMoment(2_000, true).caption).toBe('home');
  });
});
