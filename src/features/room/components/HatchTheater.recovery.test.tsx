/**
 * Nothing in the theatre waits forever (M14, after a real phone was left at
 * "Here it comes…"): a write that never answers ends at the theatre's own
 * ceiling with Try again; a write that landed with no baby to show for it
 * asks the collection again, then says so and offers Check again and
 * Reload; a slow write says it is slow; a guest's hatch says where it is
 * kept.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import type { CeremonyTimings } from '@/features/lifecycle';
import { HatchTheater } from './HatchTheater';
import { PERFORM_TIMEOUT_MS, RECOVER_WAIT_MS, REVEAL_WAIT_MS, SLOW_WRITE_MS, TAPS_TO_HATCH, TAP_SETTLE_MS, VERY_SLOW_WRITE_MS, writingCaption } from '../lib/hatch-theater';

const FAST: CeremonyTimings = { stepMs: 0, burstMs: 0, revealMs: 300 };
const egg = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Pip', stage: 'egg', visualGeneration: 'v3' }))!;
const baby = parseModernBlobbiEvent(blobbiEvent('0000000001', { name: 'Pip', stage: 'baby', visualGeneration: 'v3' }))!;

let clock = 1_000;
beforeEach(() => {
  clock = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => vi.restoreAllMocks());

function stage(blobbi: BlobbiCompanion, perform: () => Promise<boolean>, extra: Partial<Parameters<typeof HatchTheater>[0]> = {}) {
  const onDone = vi.fn();
  const onRecover = vi.fn();
  const view = render(<HatchTheater blobbi={blobbi} perform={perform} reducedMotion play={vi.fn()} onDone={onDone} onRecover={onRecover} timings={FAST} {...extra} />);
  return { view, onDone, onRecover, rerender: (next: BlobbiCompanion) => view.rerender(<HatchTheater blobbi={next} perform={perform} reducedMotion play={vi.fn()} onDone={onDone} onRecover={onRecover} timings={FAST} {...extra} />) };
}
function openTheShell() {
  for (let i = 0; i < TAPS_TO_HATCH; i++) {
    clock += TAP_SETTLE_MS + 20;
    fireEvent.click(screen.getByTestId('hatch-theater-egg'));
  }
}
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe('the hatch theatre never waits forever', () => {
  it('a write that never answers ends at the ceiling: the egg stays an egg, Try again is offered, and a late landing still reveals', async () => {
    let settle!: (v: boolean) => void;
    const perform = vi.fn(() => new Promise<boolean>((r) => (settle = r)));
    const { rerender } = stage(egg, perform, { waits: { performMs: 80 } });
    openTheShell();
    expect(await screen.findByTestId('hatch-theater-writing')).toHaveTextContent('Saving the hatch to your account');
    const failed = await screen.findByTestId('hatch-theater-failed', {}, { timeout: 2_000 });
    expect(failed).toHaveTextContent(/taking too long to save/);
    expect(screen.getByTestId('hatch-theater-retry')).toBeInTheDocument();
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'egg');
    // The write lands after all (the relays were only slow): the collection says baby, and the baby is shown
    settle(true);
    rerender(baby);
    await waitFor(() => expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'baby'));
    expect(screen.queryByTestId('hatch-theater-failed')).toBeNull();
  });

  it('a landed write with no baby in the collection asks it again, then says so with Check again and Reload', async () => {
    const perform = vi.fn(async () => true);
    const { onRecover, onDone } = stage(egg, perform, { waits: { revealMs: 60, recoverMs: 60 } });
    openTheShell();
    await waitFor(() => expect(screen.getByTestId('hatch-theater-writing')).toHaveTextContent(/Waiting for the little one/));
    await waitFor(() => expect(onRecover).toHaveBeenCalledTimes(1), { timeout: 2_000 });
    expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Looking for the little one…');
    const unseen = await screen.findByTestId('hatch-theater-unseen', {}, { timeout: 2_000 });
    expect(unseen).toHaveTextContent(/saved, but Pip is not showing yet/);
    expect(screen.getByTestId('hatch-theater-reload')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    // Check again asks once more, and the wait is bounded again
    fireEvent.click(screen.getByTestId('hatch-theater-check-again'));
    expect(onRecover).toHaveBeenCalledTimes(2);
    await screen.findByTestId('hatch-theater-unseen', {}, { timeout: 2_000 });
  });

  it('a landed write whose baby arrives late is revealed, and the recovery never shows', async () => {
    const perform = vi.fn(async () => true);
    const { rerender, onRecover } = stage(egg, perform, { waits: { revealMs: 300, recoverMs: 300 } });
    openTheShell();
    await wait(50);
    rerender(baby);
    await waitFor(() => expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'baby'));
    await wait(400);
    expect(onRecover).not.toHaveBeenCalled();
    expect(screen.queryByTestId('hatch-theater-unseen')).toBeNull();
  });

  it('a guest\'s hatch says it is kept on this device', async () => {
    let settle!: (v: boolean) => void;
    stage(egg, () => new Promise<boolean>((r) => (settle = r)), { savingNote: 'Keeping the hatch on this device' });
    openTheShell();
    expect(await screen.findByTestId('hatch-theater-writing')).toHaveTextContent('Keeping the hatch on this device');
    settle(true);
  });

  it('the captions and the deadlines are what they say', () => {
    expect(writingCaption(0)).toBe('Here it comes…');
    expect(writingCaption(SLOW_WRITE_MS)).toMatch(/takes a moment/);
    expect(writingCaption(VERY_SLOW_WRITE_MS)).toMatch(/relays are slow/);
    expect(PERFORM_TIMEOUT_MS).toBeGreaterThan(3 * 6_000 + 2 * 1_200 + 15_000 + 8_000);
    expect(REVEAL_WAIT_MS + RECOVER_WAIT_MS).toBeLessThan(30_000);
  });
});
