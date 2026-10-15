/**
 * The surface the player rubs: a margin of at least 24 px round the art box,
 * pointers handed over in the BOX's coordinates (the margin taken off, beyond
 * [0, 1] outside the box), the box measured in px, nothing rubbed before the
 * outline is known, and what is drawn exactly what the machine counts.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BathTouchLayer, HIT_PAD_PX } from './BathTouchLayer';
import { createBath, defaultMask, frameSource, reduce, type BathState } from './bath-machine';
import { frameFromState, foamedCount } from './bath-frame';
import { RITUALS } from './rituals';
import { DEFAULT_OUTLINE } from './body-mask';
import type { BathInput, BathView } from './useBathSession';

function viewOf(s: BathState): BathView {
  const frame = frameFromState(frameSource(s), { key: 1, ritual: s.ritual, outline: DEFAULT_OUTLINE, reducedMotion: false });
  return { status: s.status, ritual: s.ritual, stage: RITUALS.soap.stages[s.stageIndex] ?? null, stageId: RITUALS.soap.stages[s.stageIndex]?.id ?? null, tool: 'soap', progress: s.progress, guidance: '', item: { choice: null as never, name: 'Soap', glyph: { type: 'emoji', text: '🧼' } as never }, error: null, attempts: 0, frame, outline: DEFAULT_OUTLINE, inPlace: true, ready: s.maskReady, celebrating: false, key: 1 };
}

function input(): BathInput & { calls: { kind: string; point?: { x: number; y: number } }[] } {
  const calls: { kind: string; point?: { x: number; y: number } }[] = [];
  return { calls, down: (point) => calls.push({ kind: 'down', point }), move: (point) => calls.push({ kind: 'move', point }), up: () => calls.push({ kind: 'up' }), measure: vi.fn() };
}

describe('BathTouchLayer', () => {
  it('reaches at least 24 px beyond the art box all round', () => {
    expect(HIT_PAD_PX).toBeGreaterThanOrEqual(24);
    const s = reduce(createBath(RITUALS.soap, defaultMask(), { ready: true }), { type: 'begin' });
    render(<BathTouchLayer view={viewOf(s)} input={input()} reducedMotion={false} name="Lupa" />);
    const hit = screen.getByTestId('bath-layer');
    expect(Number(hit.dataset.pad)).toBeGreaterThanOrEqual(24);
    expect(hit.style.inset).toBe(`-${hit.dataset.pad}px`);
  });

  it('hands pointers over in the art box’s coordinates, the margin taken off (beside the box is outside [0, 1])', () => {
    const s = reduce(createBath(RITUALS.soap, defaultMask(), { ready: true }), { type: 'begin' });
    const io = input();
    render(<BathTouchLayer view={viewOf(s)} input={io} reducedMotion={false} name="Lupa" />);
    const hit = screen.getByTestId('bath-layer');
    const pad = Number(hit.dataset.pad);
    // The box is 100 px a side at (0, 0); the surface is the box and the margin
    hit.getBoundingClientRect = () => ({ left: -pad, top: -pad, width: 100 + 2 * pad, height: 100 + 2 * pad, right: 100 + pad, bottom: 100 + pad, x: -pad, y: -pad, toJSON: () => ({}) });
    fireEvent.pointerDown(hit, { pointerId: 1, isPrimary: true, button: 0, clientX: 50, clientY: 25 });
    fireEvent.pointerMove(hit, { pointerId: 1, isPrimary: true, clientX: -10, clientY: -12 });
    fireEvent.pointerUp(hit, { pointerId: 1, isPrimary: true });
    expect(io.calls[0]).toEqual({ kind: 'down', point: { x: 0.5, y: 0.75 } });
    expect(io.calls[1].point!.x).toBeCloseTo(-0.1, 5);
    expect(io.calls[1].point!.y).toBeCloseTo(1.12, 5);
    expect(io.calls[2].kind).toBe('up');
  });

  it('what is drawn foamed is exactly what the machine counts, bubble for cell', () => {
    let s = reduce(createBath(RITUALS.soap, defaultMask(), { ready: true }), { type: 'begin' });
    s = reduce(s, { type: 'measure', box: { w: 34, h: 34 } });
    for (const e of [{ type: 'pointer-down', point: { x: 0.1, y: 0.4 } }, { type: 'pointer-move', point: { x: 0.5, y: 0.45 } }, { type: 'pointer-move', point: { x: 0.9, y: 0.4 } }, { type: 'pointer-up' }] as const) s = reduce(s, e);
    const view = viewOf(s);
    render(<BathTouchLayer view={view} input={input()} reducedMotion={false} name="Lupa" />);
    const foam = screen.getByTestId('bath-foam');
    const counted = s.foamed.filter(Boolean).length;
    expect(counted).toBeGreaterThan(0);
    expect(Number(foam.dataset.count)).toBe(counted);
    expect(foam.querySelectorAll('.bath-foam__cell')).toHaveLength(counted);
    expect(foamedCount(view.frame)).toBe(counted);
  });

  it('says when it takes the rubbing: not before the body’s outline is known', () => {
    const s = reduce(createBath(RITUALS.soap, defaultMask()), { type: 'begin' });
    const { rerender } = render(<BathTouchLayer view={viewOf(s)} input={input()} reducedMotion={false} name="Lupa" />);
    expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-ready', 'false');
    rerender(<BathTouchLayer view={viewOf(reduce(s, { type: 'mask', body: defaultMask() }))} input={input()} reducedMotion={false} name="Lupa" />);
    expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-ready', 'true');
  });
});
