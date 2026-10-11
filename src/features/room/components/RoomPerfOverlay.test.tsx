/**
 * The development performance tools on a phone: a recording ends by itself
 * in a report and runs on with nothing showing it; where the clipboard is
 * withheld (plain-HTTP LAN address, where `navigator.clipboard` does not
 * exist) the report stays on screen in a text box with a Select all for
 * the long-press copy, and the copy button says so instead of failing
 * silently.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RoomPerfPanel, RoomPerfPill } from './RoomPerfOverlay';
import { useRoomPerf } from '../hooks/useRoomPerf';

const quality = { preference: 'auto' as const, level: 'balanced' as const, reason: 'test' };

/** The hook and the panel, the way the dev tools mount them; `shown` is whether the panel is on screen. */
function Harness({ shown = true, active = true }: { shown?: boolean; active?: boolean }) {
  const perf = useRoomPerf({ controlRef: { current: null }, quality, mode: '2D Blobbi', active });
  return (
    <>
      <RoomPerfPill perf={perf} onOpen={() => {}} />
      {shown && <RoomPerfPanel perf={perf} quality={quality} mode="2D Blobbi" />}
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the performance tools', () => {
  it('without a clipboard, Copy keeps the report on screen, says to select it, and Select all selects the whole text', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined, userAgent: 'test', hardwareConcurrency: 4 });
    render(<Harness />);
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
    render(<Harness />);
    fireEvent.click(screen.getByTestId('room-perf-copy'));
    expect(await screen.findByTestId('room-perf-copied')).toHaveTextContent('copied');
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/Blobbi room performance/));
  });

  it('a 10 s recording runs on while the panel is closed, counts down in the corner, and the report is there when it opens again', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness shown />);
    fireEvent.click(screen.getByTestId('room-perf-record'));
    expect(screen.getByTestId('room-perf-record')).toBeDisabled();
    expect(screen.getByTestId('room-perf-pill')).toHaveAttribute('data-recording', 'true');
    // The tools close; nothing shows the panel, the hook lives on
    rerender(<Harness shown={false} active={false} />);
    expect(screen.queryByTestId('room-perf')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId('room-perf-pill')).toHaveTextContent(/rec \d s/);
    act(() => {
      vi.advanceTimersByTime(5_500);
    });
    expect(screen.getByTestId('room-perf-pill')).toHaveAttribute('data-recording', 'false');
    rerender(<Harness shown />);
    expect(screen.getByTestId('room-perf-record')).toBeEnabled();
    expect(screen.getByTestId<HTMLTextAreaElement>('room-perf-report').value).toMatch(/display frames \(measured, 1\d\.\d s\)/);
  });
});
