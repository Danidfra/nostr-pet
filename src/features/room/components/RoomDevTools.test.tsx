/**
 * The room's dev tools on a phone: one pill, one sheet, one view at a time;
 * every control of the old cards still reachable (animations, teleport,
 * room, visual, performance, the fixture's panel); starting something to
 * watch closes the sheet and the pill says what plays; a recording runs on
 * with the sheet closed and the report is there when it opens again; the
 * sheet keeps its touches to itself; the page's runtime errors are listed
 * and copyable; Reset puts everything back to neutral. Nothing is written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { ROOM_ORDER } from '@/features/home/rooms/rooms';
import type { NostrSigner } from '@nostrify/nostrify';
import { RoomDevTools, type RoomDevToolsProps } from './RoomDevTools';
import { clearRuntimeErrors, recordRuntimeError } from '../lib/runtime-errors';

function makeProps(over: Partial<RoomDevToolsProps> = {}): RoomDevToolsProps & { calls: string[] } {
  const calls: string[] = [];
  const presenceState = { state: 'present' as 'present' | 'departing' | 'absent' | 'arriving' };
  return {
    calls,
    transitions: {
      shownRoom: 'home',
      roomEntry: { intro: 'build', spawn: null },
      transitioning: false,
      kind: null,
      gaze: null,
      request: () => {},
      forceNext: (kind, opts) => calls.push(`forceNext:${kind}:${opts?.holdAt ?? ''}`),
      cancel: () => calls.push('cancel'),
      seek: () => true,
      durationMs: 3000,
      speed: 1,
      setSpeed: (s) => calls.push(`speed:${s}`),
    },
    roomId: 'home',
    onRoom: (room) => calls.push(`room:${room}`),
    appearance: '2d',
    onAppearance: (a) => calls.push(`appearance:${a}`),
    quality: { preference: 'auto', level: 'balanced', reason: 'device', onChange: (p) => calls.push(`quality:${p}`) },
    onFace: (name) => calls.push(`face:${name}`),
    onFeed: () => calls.push('feed'),
    onPet: () => calls.push('pet'),
    presence: {
      state: presenceState.state,
      journey: null,
      leave: () => {
        calls.push('leave');
        return true;
      },
      enter: () => {
        calls.push('enter');
        return true;
      },
      cancel: () => calls.push('presence-cancel'),
      getState: () => presenceState.state,
      controller: {} as never,
    } as unknown as RoomDevToolsProps['presence'],
    preview: null,
    onPreview: (p) => calls.push(`preview:${p ? `${p.kind}@${p.t}` : 'null'}`),
    controlRef: { current: null },
    mode: '2D Blobbi',
    ...over,
  };
}

let narrow = true;
beforeEach(() => {
  narrow = true;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({ matches: query.includes('max-width') ? narrow : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
  clearRuntimeErrors();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const open = () => fireEvent.click(screen.getByTestId('dev-tools-open'));
/** The room a scene goes to by default: the next one along from the living room. */
const NEXT = ROOM_ORDER[(ROOM_ORDER.indexOf('home') + 1) % ROOM_ORDER.length];

describe('the dev tools on a phone', () => {
  it('closed, one pill and nothing else; open, one sheet with one view at a time, and a close that returns to the room', () => {
    render(<RoomDevTools {...makeProps()} />);
    expect(screen.getByTestId('dev-tools-open')).toHaveTextContent('Dev Tools');
    expect(screen.queryByTestId('dev-tools')).toBeNull();
    expect(screen.queryByTestId('room-perf-pill')).toBeNull();
    open();
    const sheet = screen.getByTestId('dev-tools');
    expect(sheet).toHaveAttribute('data-layout', 'sheet');
    expect(sheet).toHaveAttribute('data-view', 'animations');
    // The pills are gone while the sheet is up: nothing shows through it
    expect(screen.queryByTestId('dev-tools-open')).toBeNull();
    for (const view of ['teleport', 'room', 'visual', 'performance', 'animations']) {
      fireEvent.click(screen.getByTestId(`dev-tools-tab-${view}`));
      expect(sheet).toHaveAttribute('data-view', view);
      expect(document.querySelectorAll('.devtools__view')).toHaveLength(1);
    }
    expect(screen.queryByTestId('dev-tools-tab-fixture')).toBeNull();
    fireEvent.click(screen.getByTestId('dev-tools-close'));
    expect(screen.queryByTestId('dev-tools')).toBeNull();
    expect(screen.getByTestId('dev-tools-open')).toBeInTheDocument();
  });

  it('on a wide screen it is a side panel that stays open while a scene plays', () => {
    narrow = false;
    const props = makeProps();
    render(<RoomDevTools {...props} />);
    open();
    expect(screen.getByTestId('dev-tools')).toHaveAttribute('data-layout', 'side');
    fireEvent.click(screen.getByTestId('playground-scene-outside'));
    expect(screen.getByTestId('dev-tools')).toBeInTheDocument();
    expect(props.calls).toEqual(['cancel', 'forceNext:outside:', `room:${NEXT}`]);
  });

  it('animations: a scene plays to the next room and closes the sheet to watch; the pill names it; the sheet reopens on the same view', () => {
    const props = makeProps();
    const { rerender } = render(<RoomDevTools {...props} />);
    open();
    fireEvent.click(screen.getByTestId('playground-scene-big-jump'));
    expect(props.calls).toEqual(['cancel', 'forceNext:big-jump:', `room:${NEXT}`]);
    expect(screen.queryByTestId('dev-tools')).toBeNull();
    rerender(<RoomDevTools {...props} transitions={{ ...props.transitions, kind: 'big-jump' }} />);
    expect(screen.getByTestId('dev-tools-open')).toHaveTextContent('▶ Big Jump');
    expect(screen.getByTestId('dev-tools-open')).toHaveAttribute('data-playing', 'true');
    open();
    expect(screen.getByTestId('dev-tools')).toHaveAttribute('data-view', 'animations');
    expect(screen.getByTestId('playground-scene-big-jump')).toHaveAttribute('data-playing', 'true');
    expect(screen.getByTestId('dev-tools-status')).toHaveTextContent('Big Jump');
  });

  it('"close to watch" off keeps the sheet up on a phone; feeding and petting respect it too', () => {
    const props = makeProps();
    render(<RoomDevTools {...props} />);
    open();
    fireEvent.click(screen.getByTestId('dev-tools-close-to-watch'));
    fireEvent.click(screen.getByTestId('playground-feed'));
    fireEvent.click(screen.getByTestId('playground-pet'));
    expect(screen.getByTestId('dev-tools')).toBeInTheDocument();
    expect(props.calls).toEqual(['feed', 'pet']);
  });

  it('teleport: leave, arrive, round trip and cancel are reachable, the scrubber holds a moment, and the view shows the state', () => {
    const props = makeProps();
    render(<RoomDevTools {...props} />);
    open();
    fireEvent.click(screen.getByTestId('dev-tools-tab-teleport'));
    expect(screen.getByTestId('teleport-dev')).toHaveAttribute('data-state', 'present');
    fireEvent.click(screen.getByTestId('teleport-dev-leave'));
    expect(screen.queryByTestId('dev-tools')).toBeNull();
    open();
    fireEvent.click(screen.getByTestId('teleport-dev-arrive'));
    open();
    fireEvent.click(screen.getByTestId('teleport-dev-round-trip'));
    open();
    fireEvent.click(screen.getByTestId('teleport-dev-cancel'));
    fireEvent.change(screen.getByTestId('teleport-dev-scrub'), { target: { value: '400' } });
    expect(props.calls).toEqual(['preview:null', 'leave', 'preview:null', 'enter', 'preview:null', 'leave', 'preview:null', 'presence-cancel', 'preview:depart@400']);
  });

  it('room and visual: the rooms, the drawing, the quality and every face, with the one worn marked', () => {
    const props = makeProps();
    render(<RoomDevTools {...props} />);
    open();
    fireEvent.click(screen.getByTestId('dev-tools-tab-room'));
    expect(screen.getByTestId('dev-tools-room-home')).toBeDisabled();
    expect(screen.getByTestId('dev-tools-fixture-baby')).toHaveAttribute('href', '?fixture=baby-v3&perf');
    fireEvent.click(screen.getByTestId('dev-tools-room-rest'));
    // Going to a room is something to watch: the sheet closed
    expect(screen.queryByTestId('dev-tools')).toBeNull();
    open();
    fireEvent.click(screen.getByTestId('dev-tools-tab-visual'));
    fireEvent.click(screen.getByTestId('dev-tools-3d'));
    fireEvent.click(screen.getByTestId('dev-tools-quality-low'));
    fireEvent.click(screen.getByTestId('playground-face-worried'));
    expect(screen.getByTestId('playground-face-worried')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('playground-face-clear')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByTestId('playground-face-clear'));
    expect(screen.getByTestId('playground-face-clear')).toHaveAttribute('aria-pressed', 'true');
    expect(props.calls).toEqual(['room:rest', 'appearance:3d', 'quality:low', 'face:worried', 'face:null']);
  });

  it('reset puts everything back to neutral: no scene, its own face, no journey, no held moment', () => {
    const props = makeProps();
    render(<RoomDevTools {...props} />);
    open();
    fireEvent.click(screen.getByTestId('dev-tools-close-to-watch'));
    fireEvent.change(screen.getByTestId('playground-scrub'), { target: { value: '500' } });
    expect(screen.getByTestId('playground-release')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dev-tools-reset'));
    expect(screen.queryByTestId('playground-release')).toBeNull();
    expect(props.calls.slice(-4)).toEqual(['cancel', 'face:null', 'preview:null', 'presence-cancel']);
  });

  it('performance: a recording runs on with the sheet closed, the corner shows it, and the report is there on reopening', () => {
    vi.useFakeTimers();
    render(<RoomDevTools {...makeProps()} perfOnOpen />);
    expect(screen.getByTestId('room-perf-pill')).toBeInTheDocument();
    open();
    expect(screen.getByTestId('dev-tools')).toHaveAttribute('data-view', 'performance');
    fireEvent.click(screen.getByTestId('room-perf-record'));
    fireEvent.click(screen.getByTestId('dev-tools-close'));
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByTestId('room-perf-pill')).toHaveAttribute('data-recording', 'true');
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    expect(screen.getByTestId('room-perf-pill')).toHaveAttribute('data-recording', 'false');
    open();
    expect(screen.getByTestId<HTMLTextAreaElement>('room-perf-report').value).toMatch(/display frames \(measured, 1\d\.\d s\)/);
    fireEvent.click(screen.getByTestId('dev-tools-close'));
    open();
    expect(screen.getByTestId('room-perf-report')).toBeInTheDocument();
  });

  it('the page\'s runtime errors are counted on the pill, listed, copyable, and clearable', () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined, userAgent: 'test' });
    render(<RoomDevTools {...makeProps()} />);
    expect(screen.queryByTestId('dev-tools-errors')).toBeNull();
    act(() => recordRuntimeError('error', new TypeError('boom')));
    expect(screen.getByTestId('dev-tools-errors')).toHaveTextContent('⚠ 1');
    fireEvent.click(screen.getByTestId('dev-tools-errors'));
    expect(screen.getByTestId('dev-tools')).toHaveAttribute('data-view', 'performance');
    expect(screen.getByTestId('dev-tools-error-list')).toHaveTextContent('error: TypeError: boom');
    expect(screen.getByTestId<HTMLTextAreaElement>('dev-tools-errors-report').value).toMatch(/TypeError: boom/);
    fireEvent.click(screen.getByTestId('dev-tools-errors-clear'));
    expect(screen.getByTestId('dev-tools-no-errors')).toBeInTheDocument();
  });

  it('keeps its touches to itself: a pointer down inside the sheet never reaches the room', () => {
    const outside = vi.fn();
    render(
      <div onPointerDown={outside} onClick={outside}>
        <RoomDevTools {...makeProps()} />
      </div>,
    );
    open();
    outside.mockClear();
    fireEvent.pointerDown(screen.getByTestId('dev-tools-tab-teleport'));
    fireEvent.click(screen.getByTestId('dev-tools-tab-teleport'));
    expect(outside).not.toHaveBeenCalled();
  });

  it('shows the fixture world\'s panel in its own view and claims it from the floating layer while mounted', () => {
    const release = vi.fn();
    const claim = vi.fn(() => release);
    const fixture = { pubkey: 'f'.repeat(64), signer: {} as NostrSigner, panel: { node: <div data-testid="fixture-panel-stub">fixture</div>, claim } };
    const { unmount } = render(
      <DevFixtureContext.Provider value={fixture}>
        <RoomDevTools {...makeProps()} />
      </DevFixtureContext.Provider>,
    );
    expect(claim).toHaveBeenCalledTimes(1);
    open();
    fireEvent.click(screen.getByTestId('dev-tools-tab-fixture'));
    expect(screen.getByTestId('fixture-panel-stub')).toBeInTheDocument();
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
