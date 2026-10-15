import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { TAP_ATTENTION_MS, clampEyeOffset, gazeRangeFor, gazeToward, travelGlance } from './gaze';
import { useGazePolicy } from './useGazePolicy';

describe('gaze model', () => {
  it('clamps every axis to -1..1 and turns non-finite input into 0', () => {
    expect(clampEyeOffset({ x: 3, y: -7 })).toEqual({ x: 1, y: -1 });
    expect(clampEyeOffset({ x: Number.NaN, y: 0.2 })).toEqual({ x: 0, y: 0.2 });
  });

  it('looks proportionally towards a near target and saturates at the range', () => {
    const eyes = { x: 100, y: 100 };
    expect(gazeToward(eyes, { x: 150, y: 100 }, 200)).toEqual({ x: 0.25, y: 0 });
    expect(gazeToward(eyes, { x: 700, y: -500 }, 200)).toEqual({ x: 1, y: -1 });
    expect(gazeToward(eyes, { x: 40, y: 160 }, 200)).toEqual({ x: -0.3, y: 0.3 });
  });

  it('does not negate for any facing: the renderer mirrors the left profile itself', () => {
    // The pure function has no facing input at all; a target to the right is always +x.
    expect(gazeToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 100).x).toBe(1);
  });

  it('quantizes so pointer jitter does not churn', () => {
    expect(gazeToward({ x: 0, y: 0 }, { x: 101, y: 0 }, 200)).toEqual(gazeToward({ x: 0, y: 0 }, { x: 103, y: 0 }, 200));
  });

  it('travel glance looks a little along the road, or nowhere when still', () => {
    expect(travelGlance({ x: -1, y: 0 })).toEqual({ x: -0.45, y: 0 });
    expect(travelGlance({ x: 0, y: 0 })).toBeUndefined();
  });

  it('range scales with the scene but never below a floor', () => {
    expect(gazeRangeFor(0)).toBe(120);
    expect(gazeRangeFor(1000)).toBe(300);
  });
});

describe('useGazePolicy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function harness(hoverCapable: boolean) {
    const actor = document.createElement('div');
    actor.getBoundingClientRect = () => ({ left: 100, top: 100, width: 100, height: 100, right: 200, bottom: 200, x: 100, y: 100, toJSON: () => ({}) });
    const scene = document.createElement('section');
    scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
    const actorRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    actorRef.current = actor;
    const sceneRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>;
    sceneRef.current = scene;
    const hook = renderHook(({ enabled }: { enabled: boolean }) => useGazePolicy({ actorRef, sceneRef, hoverCapable, actorKey: 'k', enabled }), {
      initialProps: { enabled: true },
    });
    return hook;
  }

  const ev = (pointerType: string, clientX: number, clientY: number) => ({ pointerType, clientX, clientY }) as unknown as React.PointerEvent<HTMLElement>;

  it('follows a hovering mouse and lets go when it leaves', () => {
    const { result } = harness(true);
    expect(result.current.eyeOffset).toBeUndefined();
    // Eyes at (150, 140); range = max(120, 400*0.3) = 120.
    act(() => result.current.onPointerMove(ev('mouse', 210, 140)));
    act(() => {
      vi.advanceTimersByTime(20); // the move is applied on the next frame
    });
    expect(result.current.eyeOffset).toEqual({ x: 0.5, y: 0 });
    act(() => result.current.onPointerLeave());
    expect(result.current.eyeOffset).toBeUndefined();
  });

  it('on touch, a tap holds attention briefly and moves do not', () => {
    const { result } = harness(false);
    act(() => result.current.onPointerMove(ev('touch', 210, 140)));
    expect(result.current.eyeOffset).toBeUndefined();
    act(() => result.current.onPointerDown(ev('touch', 90, 140)));
    expect(result.current.eyeOffset).toEqual({ x: -0.5, y: 0 });
    act(() => {
      vi.advanceTimersByTime(TAP_ATTENTION_MS + 10);
    });
    expect(result.current.eyeOffset).toBeUndefined();
  });

  it('an idle glance is a fixed offset that expires, and a hovering pointer wins over it', () => {
    const { result } = harness(true);
    act(() => result.current.glance({ x: 0.3, y: -0.2 }, 500));
    expect(result.current.eyeOffset).toEqual({ x: 0.3, y: -0.2 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.eyeOffset).toBeUndefined();
    act(() => result.current.onPointerMove(ev('mouse', 210, 140)));
    act(() => {
      vi.advanceTimersByTime(20); // the move is applied on the next frame
    });
    act(() => result.current.glance({ x: -1, y: 0 }, 500));
    expect(result.current.eyeOffset).toEqual({ x: 0.5, y: 0 });
  });

  it('disabled (sleeping) renders no gaze at all', () => {
    const { result, rerender } = harness(true);
    act(() => result.current.onPointerMove(ev('mouse', 210, 140)));
    act(() => {
      vi.advanceTimersByTime(20); // the move is applied on the next frame
    });
    expect(result.current.eyeOffset).toBeDefined();
    rerender({ enabled: false });
    expect(result.current.eyeOffset).toBeUndefined();
  });
});

// ─── M15 care refinement: no state from an effect per pointer frame, a controller stable while only the eyes move ───
describe('the gaze does not churn the home', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function counted() {
    const actor = document.createElement('div');
    actor.getBoundingClientRect = () => ({ left: 100, top: 100, width: 100, height: 100, right: 200, bottom: 200, x: 100, y: 100, toJSON: () => ({}) });
    const scene = document.createElement('section');
    scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
    const actorRef = { current: actor as HTMLElement | null };
    const sceneRef = { current: scene as HTMLElement | null };
    const renders = { n: 0 };
    const hook = renderHook(() => {
      renders.n += 1;
      return useGazePolicy({ actorRef, sceneRef, hoverCapable: true, actorKey: 'k' });
    });
    return { ...hook, renders };
  }
  const mouse = (clientX: number, clientY: number) => ({ pointerType: 'mouse', clientX, clientY }) as unknown as React.PointerEvent<HTMLElement>;
  const frame = () => act(() => { vi.advanceTimersByTime(20); });

  it('one render per pointer frame that moves the eyes (never two: no effect turns the target into the offset)', () => {
    const { result, renders } = counted();
    const start = renders.n;
    for (let i = 0; i < 5; i++) {
      // Many moves inside one frame, one render for the frame
      act(() => {
        result.current.onPointerMove(mouse(160 + i * 12, 140));
        result.current.onPointerMove(mouse(162 + i * 12, 140));
      });
      frame();
    }
    expect(result.current.eyeOffset).toBeDefined();
    expect(renders.n - start).toBe(5);
  });

  it('a pointer frame that leaves the eyes where they are renders nothing', () => {
    const { result, renders } = counted();
    act(() => result.current.onPointerMove(mouse(210, 140)));
    frame();
    const settled = renders.n;
    const eyes = result.current.eyeOffset;
    // Far beyond the range the eyes saturate: a new point, the same offset
    for (const x of [900, 950, 1000]) {
      act(() => result.current.onPointerMove(mouse(x, 140)));
      frame();
    }
    act(() => result.current.onPointerMove(mouse(1000, 140)));
    frame();
    expect(result.current.eyeOffset).not.toEqual(eyes);
    const saturated = renders.n;
    for (const x of [1100, 1200, 1300]) {
      act(() => result.current.onPointerMove(mouse(x, 140)));
      frame();
    }
    expect(renders.n).toBe(saturated);
    expect(saturated - settled).toBe(1);
  });
});
