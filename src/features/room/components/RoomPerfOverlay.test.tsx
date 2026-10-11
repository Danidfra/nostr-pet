/**
 * The development performance overlay on a phone: a recording ends by
 * itself in a report; where the clipboard is withheld (plain-HTTP LAN
 * address, where `navigator.clipboard` does not exist) the report stays on
 * screen in a text box with a Select all for the long-press copy, and the
 * copy button says so instead of failing silently.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RoomPerfOverlay } from './RoomPerfOverlay';

const quality = { preference: 'auto' as const, level: 'balanced' as const, reason: 'test' };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the performance overlay', () => {
  it('without a clipboard, Copy keeps the report on screen, says to select it, and Select all selects the whole text', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined, userAgent: 'test', hardwareConcurrency: 4 });
    render(<RoomPerfOverlay controlRef={{ current: null }} quality={quality} mode="2D Blobbi" />);
    fireEvent.click(screen.getByTestId('room-perf-copy'));
    expect(await screen.findByTestId('room-perf-copied')).toHaveTextContent(/clipboard unavailable: select the text below/);
    const box = screen.getByTestId<HTMLTextAreaElement>('room-perf-report');
    expect(box.value).toMatch(/Blobbi room performance/);
    expect(box.value).toMatch(/renderer: none \(the simple room\)/);
    fireEvent.click(screen.getByTestId('room-perf-select'));
    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe(box.value.length);
  });

  it('with a clipboard, Copy copies and says so', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText }, userAgent: 'test' });
    render(<RoomPerfOverlay controlRef={{ current: null }} quality={quality} mode="2D Blobbi" />);
    fireEvent.click(screen.getByTestId('room-perf-copy'));
    expect(await screen.findByTestId('room-perf-copied')).toHaveTextContent('copied');
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/Blobbi room performance/));
  });

  it('a 10 s recording ends by itself in a report measured over the recording', () => {
    vi.useFakeTimers();
    render(<RoomPerfOverlay controlRef={{ current: null }} quality={quality} mode="2D Blobbi" />);
    fireEvent.click(screen.getByTestId('room-perf-record'));
    expect(screen.getByTestId('room-perf-record')).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(10_500);
    });
    expect(screen.getByTestId('room-perf-record')).toBeEnabled();
    expect(screen.getByTestId<HTMLTextAreaElement>('room-perf-report').value).toMatch(/display frames \(measured, 1\d\.\d s\)/);
  });
});
