/**
 * The hatch theatre over fakes (M12.3: the shell in the player's hands): it
 * waits for taps and writes nothing meanwhile, however long; each counted
 * tap is a crack with its jolt, flash and sound; the last opens the shell
 * and writes, exactly once, whatever the drumroll, the double taps or
 * StrictMode; the baby is shown only after the write landed and only as the
 * collection holds it; a failed write leaves the egg an egg with Try again
 * (the write again, no taps asked twice) and Later; a Blobbi hatched on
 * another device is shown hatched, nothing written; "Hatch it for me" taps
 * for the player; the egg is a focused button; reduced motion moves nothing.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import type { CeremonyTimings } from '@/features/lifecycle';
import { HatchTheater } from './HatchTheater';
import { TAPS_TO_HATCH, TAP_SETTLE_MS, crackForTaps, revealMoment, tapCaption, tapCounts } from '../lib/hatch-theater';

const FAST: CeremonyTimings = { stepMs: 0, burstMs: 40, revealMs: 1_500 };
const egg = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Pip', stage: 'egg', visualGeneration: 'v3' }))!;
const baby = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Pip', stage: 'baby', visualGeneration: 'v3' }))!;

// The theatre counts taps by `performance.now()`: a clock the tests move, so a "drumroll" and a "slow tap" are exact
let clock = 1_000;
beforeEach(() => {
  clock = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => vi.restoreAllMocks());

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
  const actor = () => screen.getByTestId('hatch-theater-actor');
  return { view, onDone, play, theater, actor };
}

/** One tap on the egg, a comfortable moment after the last. */
function tapEgg() {
  clock += TAP_SETTLE_MS + 20;
  fireEvent.click(screen.getByTestId('hatch-theater-egg'));
}

describe('the hatch theatre: the shell in the player\'s hands', () => {
  it('waits for the player, writing nothing however long; each tap is a crack; the last opens it and writes once; the baby only after it landed', async () => {
    const write = deferred();
    const perform = vi.fn(() => write.promise);
    const { view, onDone, play, theater, actor } = stage(egg, perform);
    // Presented, inviting a tap; no "Ready to hatch?", no Later, no Hatch button
    expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Tap your egg to help it hatch!');
    expect(screen.queryByText(/ready to hatch\?/i)).toBeNull();
    expect(screen.queryByTestId('hatch-theater-later')).toBeNull();
    expect(theater()).toHaveAttribute('data-beat', 'stirring');
    expect(actor()).toHaveAttribute('data-crack', 'none');
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(perform).not.toHaveBeenCalled();

    const seen: string[] = [];
    for (let i = 1; i < TAPS_TO_HATCH; i++) {
      tapEgg();
      seen.push(actor().dataset.crack!);
      expect(screen.getByTestId('hatch-theater-flash')).toBeInTheDocument();
      expect(screen.getByTestId('hatch-theater-actor').querySelector('.hatch-theater__shell')).toHaveAttribute('data-jolt', i % 2 ? 'a' : 'b');
    }
    expect(seen).toEqual(['light', 'medium', 'heavy']);
    expect(play.mock.calls.filter(([s]) => s === 'crack')).toHaveLength(3);
    expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Almost there');
    expect(perform).not.toHaveBeenCalled();

    // The last tap opens the shell: the light gathers and the one write goes out
    tapEgg();
    expect(perform).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('gather');
    expect(theater()).toHaveAttribute('data-phase', 'publishing');
    expect(screen.getByTestId('hatch-theater-writing')).toBeInTheDocument();
    expect(screen.queryByTestId('hatch-theater-egg')).toBeNull();
    // Waiting on the write: no reveal, however long it takes
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(actor()).toHaveAttribute('data-stage', 'egg');

    // It landed; still the egg until the collection holds the baby (a render later)
    await act(async () => write.resolve(true));
    expect(actor()).toHaveAttribute('data-stage', 'egg');
    view.rerender(<HatchTheater blobbi={baby} perform={perform} reducedMotion={false} play={play} onDone={onDone} timings={FAST} />);
    expect(actor()).toHaveAttribute('data-stage', 'baby');
    expect(actor().querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'baby');
    expect(play).toHaveBeenCalledWith('hatch');
    // The reveal runs on its own clock: a moment into it, the caption
    clock += 800;
    await waitFor(() => expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Pip has hatched!'));
    clock += 5_000;
    await waitFor(() => expect(screen.getByTestId('hatch-theater-continue')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('hatch-theater-continue'));
    expect(onDone).toHaveBeenCalledWith(true);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('a drumroll, double taps and taps after the last never write twice; a tap within a blink is not counted', async () => {
    const write = deferred();
    const perform = vi.fn(() => write.promise);
    const { actor } = stage(egg, perform);
    const egg$ = screen.getByTestId('hatch-theater-egg');
    // A double tap: one crack
    clock += 500;
    fireEvent.click(egg$);
    fireEvent.click(egg$);
    expect(actor()).toHaveAttribute('data-crack', 'light');
    // A drumroll, each a moment apart: the shell opens once, and the rest fall on nothing
    for (let i = 0; i < 20; i++) {
      clock += TAP_SETTLE_MS;
      const target = screen.queryByTestId('hatch-theater-egg');
      if (target) fireEvent.click(target);
    }
    expect(perform).toHaveBeenCalledTimes(1);
    await act(async () => write.resolve(true));
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('under StrictMode (effects mount, unmount and mount again) the taps still open it, with one write', async () => {
    const perform = vi.fn().mockResolvedValue(true);
    render(
      <StrictMode>
        <HatchTheater blobbi={egg} perform={perform} reducedMotion={false} play={vi.fn()} onDone={vi.fn()} timings={FAST} />
      </StrictMode>,
    );
    for (let i = 0; i < TAPS_TO_HATCH; i++) tapEgg();
    await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('a failed write leaves the egg an egg, says so and is not retried by itself; Try again writes once more without new taps; Later lets it be', async () => {
    const perform = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    const { onDone, theater, actor } = stage(egg, perform, { error: 'refused by the relays' });
    for (let i = 0; i < TAPS_TO_HATCH; i++) tapEgg();
    await waitFor(() => expect(theater()).toHaveAttribute('data-phase', 'failed'));
    const card = screen.getByTestId('hatch-theater-failed');
    expect(card).toHaveTextContent(/did not hatch yet/);
    expect(card).toHaveTextContent(/refused by the relays/);
    expect(card).toHaveTextContent(/your egg is safe/i);
    expect(actor()).toHaveAttribute('data-stage', 'egg');
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(perform).toHaveBeenCalledTimes(1);
    // Pressed twice before the screen changes: one write
    const retry = screen.getByTestId('hatch-theater-retry');
    fireEvent.click(retry);
    fireEvent.click(retry);
    await waitFor(() => expect(perform).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(theater()).toHaveAttribute('data-phase', 'failed'));
    expect(perform).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('hatch-theater-later'));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalledWith(true);
  });

  it('a write that throws is a failure like any other, never an unhandled rejection', async () => {
    const perform = vi.fn().mockRejectedValue(new Error('signer closed'));
    const { theater } = stage(egg, perform);
    for (let i = 0; i < TAPS_TO_HATCH; i++) tapEgg();
    await waitFor(() => expect(theater()).toHaveAttribute('data-phase', 'failed'));
  });

  it('hatched on another device meanwhile: the collection says baby, the theatre shows it, nothing is written here', async () => {
    const perform = vi.fn().mockResolvedValue(true);
    const { view, actor, play, onDone } = stage(egg, perform);
    tapEgg();
    tapEgg();
    view.rerender(<HatchTheater blobbi={baby} perform={perform} reducedMotion={false} play={play} onDone={onDone} timings={FAST} />);
    expect(actor()).toHaveAttribute('data-stage', 'baby');
    expect(screen.queryByTestId('hatch-theater-egg')).toBeNull();
    expect(perform).not.toHaveBeenCalled();
  });

  it('"Hatch it for me" taps for the player, at an easy pace, and writes once', async () => {
    const perform = vi.fn().mockResolvedValue(true);
    const { actor } = stage(egg, perform);
    fireEvent.click(screen.getByTestId('hatch-theater-auto'));
    expect(screen.queryByTestId('hatch-theater-auto')).toBeNull();
    // Each automatic tap is a moment after the last
    for (let i = 0; i < TAPS_TO_HATCH; i++) {
      clock += 1_000;
      await act(() => new Promise((r) => setTimeout(r, 700)));
    }
    await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
    expect(actor()).toHaveAttribute('data-crack', 'heavy');
  }, 10_000);

  it('the egg is a button with the focus: Enter or Space is a tap, and its name says how far the shell is', () => {
    stage(egg, vi.fn().mockResolvedValue(true));
    const button = screen.getByTestId('hatch-theater-egg');
    expect(document.activeElement).toBe(button);
    expect(button).toHaveAccessibleName(`Tap Pip to crack the shell, 0 of ${TAPS_TO_HATCH}`);
    tapEgg();
    expect(screen.getByTestId('hatch-theater-egg')).toHaveAccessibleName(`Tap Pip to crack the shell, 1 of ${TAPS_TO_HATCH}`);
    expect(screen.getByTestId('hatch-theater-caption')).toHaveAttribute('role', 'status');
  });

  it('reduced motion: nothing rocks or jolts, the cracks, the words and the faces tell it', () => {
    const { theater, actor } = stage(egg, vi.fn().mockResolvedValue(true), { reducedMotion: true });
    expect(theater()).toHaveAttribute('data-reduced', 'true');
    tapEgg();
    tapEgg();
    expect(actor()).toHaveAttribute('data-crack', 'medium');
    expect(actor()).toHaveAttribute('data-rock', '0');
    expect(actor().querySelector('.hatch-theater__shell')).not.toHaveAttribute('data-jolt');
    expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Tap again');
  });
});

describe('the shell, as data', () => {
  it('a crack per tap, the renderer\'s own drawings; the last tap opens it', () => {
    expect([0, 1, 2, 3].map(crackForTaps)).toEqual(['none', 'light', 'medium', 'heavy']);
    expect(TAPS_TO_HATCH).toBe(4);
    expect(tapCaption(TAPS_TO_HATCH)).toBe('Here it comes…');
  });

  it('a tap counts unless it follows the last within a blink, or the shell is already open; slowness is never refused', () => {
    expect(tapCounts(0, null, 0)).toBe(true);
    expect(tapCounts(1, 1_000, 1_000 + TAP_SETTLE_MS - 1)).toBe(false);
    expect(tapCounts(1, 1_000, 1_000 + TAP_SETTLE_MS)).toBe(true);
    expect(tapCounts(2, 1_000, 1_000 + 3_600_000)).toBe(true);
    expect(tapCounts(TAPS_TO_HATCH, 1_000, 99_000)).toBe(false);
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
