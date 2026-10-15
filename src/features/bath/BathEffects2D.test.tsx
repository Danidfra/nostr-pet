/**
 * The ritual drawn on the 2D drawing (M15 care): everything on the body is
 * clipped to its silhouette (the frame's body cells), the foam is exactly
 * the foamed cells, the sheen is the wet cells as strong as the wetness, the
 * towel's fluff is the dry cells, the water runs and falls only as the frame
 * says, each cue plays once, and reduced motion draws no motion and keeps
 * every state legible.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BathEffects2D } from './BathEffects2D';
import { BATH_GRID } from './bath-machine';
import { RITUALS } from './rituals';
import { makeFrame } from '@/test/bath-frames';
import { shapePath } from './effects/body-shape';

const row = (i: number) => Math.floor(i / BATH_GRID);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Every drawn node (a circle, an ellipse, a path or a rect) under an element. */
const drawn = (el: Element) => [...el.querySelectorAll('circle, ellipse, path, rect')].filter((n) => !n.closest('defs'));

describe('BathEffects2D', () => {
  it('clips everything on the body to the body’s own shape, and draws nothing off it but what falls', () => {
    const frame = makeFrame({ foamed: true, wet: true, wetness: 1, stageIndex: 1, head: { x: 0.5, y: 1.2 } });
    const { container } = render(<BathEffects2D frame={frame} />);
    const svg = container.querySelector('[data-testid="bath-effects"]')!;
    const onBody = svg.querySelector('[data-testid="bath-on-body"]')!;
    const clipId = onBody.getAttribute('clip-path')!.match(/url\(#(.+)\)/)![1];
    const clip = svg.querySelector(`clipPath[id="${CSS.escape(clipId)}"] path`)!;
    expect(clip.getAttribute('d')).toBe(shapePath(frame, undefined, 0));
    // The foam, the sheen, the streams, the drops' run and the rain's hits are all inside the clipped group
    for (const id of ['bath-foam', 'bath-sheen', 'bath-streams', 'bath-droplets']) expect(onBody.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    expect(onBody.querySelectorAll('.bath-splash').length).toBeGreaterThan(0);
    // Off the body: only the falling half of each drop, its splash, the rain and the bursts
    const falling = svg.querySelector('[data-testid="bath-falling"]')!;
    for (const node of drawn(falling)) expect(node.matches('.bath-droplet__fall, .bath-droplet__splash, .bath-rain *, .bath-burst *')).toBe(true);
    // And nothing drawn outside those two groups
    for (const node of drawn(svg)) expect(node.closest('[data-testid="bath-on-body"], [data-testid="bath-falling"]')).not.toBeNull();
  });

  it('the foam is exactly the foamed cells (one bubble each); the shampoo’s lather is tinted and denser', () => {
    const pick = (i: number, body: boolean) => body && row(i) >= 3;
    const soap = makeFrame({ foamed: pick });
    const foamed = soap.cells.filter((c) => c.foamed).length;
    const { container, rerender } = render(<BathEffects2D frame={soap} />);
    const foam = () => container.querySelector('[data-testid="bath-foam"]')!;
    expect(foam().getAttribute('data-count')).toBe(String(foamed));
    expect(foam().querySelectorAll('.bath-foam__cell').length).toBe(foamed);
    expect(foam().querySelectorAll('circle').length).toBe(foamed);
    expect(foam().getAttribute('data-style')).toBe('soap');
    rerender(<BathEffects2D frame={makeFrame({ foamed: pick, ritual: RITUALS.shampoo })} />);
    expect(foam().getAttribute('data-style')).toBe('shampoo');
    expect(foam().querySelectorAll('.bath-foam__cell').length).toBe(foamed);
    expect(foam().querySelectorAll('circle').length).toBe(foamed * 2);
    expect(foam().querySelector('circle')!.getAttribute('fill')).toMatch(/foam-shampoo\)$/);
    rerender(<BathEffects2D frame={makeFrame()} />);
    expect(foam().getAttribute('data-count')).toBe('0');
    expect(foam().querySelectorAll('circle').length).toBe(0);
  });

  it('the wet sheen is the wet cells, as strong as the wetness; the water runs and falls in step with it, never when dry', () => {
    const dry = makeFrame();
    const { container, rerender } = render(<BathEffects2D frame={dry} />);
    const q = (s: string) => container.querySelector(s);
    expect(q('[data-testid="bath-sheen"]')).toBeNull();
    expect(q('[data-testid="bath-streams"]')!.getAttribute('data-count')).toBe('0');
    expect(q('[data-testid="bath-droplets"]')!.getAttribute('data-count')).toBe('0');
    rerender(<BathEffects2D frame={makeFrame({ wet: true, wetness: 0.5, revision: 2 })} />);
    expect(Number(q('[data-testid="bath-sheen"]')!.getAttribute('opacity'))).toBeCloseTo(0.18 + 0.32 * 0.5);
    expect(Number(q('[data-testid="bath-streams"]')!.getAttribute('data-count'))).toBeGreaterThan(0);
    expect(Number(q('[data-testid="bath-droplets"]')!.getAttribute('data-count'))).toBe(4);
    rerender(<BathEffects2D frame={makeFrame({ wet: true, wetness: 1, revision: 3 })} />);
    expect(Number(q('[data-testid="bath-sheen"]')!.getAttribute('opacity'))).toBeCloseTo(0.5);
    expect(q('[data-testid="bath-streams"]')!.getAttribute('data-count')).toBe('4');
    expect(q('[data-testid="bath-droplets"]')!.getAttribute('data-count')).toBe('6');
    expect(container.querySelectorAll('.bath-droplet__slide').length).toBe(6);
    expect(container.querySelectorAll('.bath-droplet__fall').length).toBe(6);
    expect(container.querySelectorAll('.bath-droplet__splash').length).toBe(6);
    // The sheen is drawn only where wet: half the body wet, the sheen's clip is that half
    const half = makeFrame({ wet: (i, body) => body && row(i) < 4, wetness: 1, revision: 4 });
    rerender(<BathEffects2D frame={half} />);
    const sheenClip = q('[data-testid="bath-sheen"]')!.parentElement!.getAttribute('clip-path')!.match(/url\(#(.+)\)/)![1];
    expect(q(`clipPath[id="${CSS.escape(sheenClip)}"] path`)!.getAttribute('d')).toBe(shapePath(half, (c) => c.wet && !c.dry, 0));
  });

  it('the towel: a damp sheen over every cell not yet rubbed, fluff on the dry ones, nothing left when all is dry', () => {
    const towel = RITUALS.towel;
    const { container, rerender } = render(<BathEffects2D frame={makeFrame({ ritual: towel })} />);
    const q = (s: string) => container.querySelector(s);
    expect(q('[data-testid="bath-sheen"]')).not.toBeNull();
    expect(Number(q('[data-testid="bath-sheen"]')!.getAttribute('opacity'))).toBeCloseTo(0.34);
    expect(q('[data-testid="bath-dry"]')!.getAttribute('data-count')).toBe('0');
    const some = makeFrame({ ritual: towel, dry: (i, body) => body && row(i) < 3 });
    const dried = some.cells.filter((c) => c.dry).length;
    rerender(<BathEffects2D frame={some} />);
    expect(q('[data-testid="bath-dry"]')!.getAttribute('data-count')).toBe(String(dried));
    expect(q('[data-testid="bath-dry"]')!.querySelectorAll('.bath-dry__cell').length).toBe(dried);
    expect(q('[data-testid="bath-sheen"]')).not.toBeNull();
    rerender(<BathEffects2D frame={makeFrame({ ritual: towel, dry: true })} />);
    expect(q('[data-testid="bath-sheen"]')).toBeNull();
    expect(q('[data-testid="bath-droplets"]')!.getAttribute('data-count')).toBe('0');
  });

  it('the shower’s rain falls from the head to the body under it while it is held, with a splash where it meets it', () => {
    const resting = makeFrame({ stageIndex: 1 });
    const { container, rerender } = render(<BathEffects2D frame={resting} />);
    const rain = () => container.querySelector('[data-testid="bath-rain"]');
    expect(rain()!.getAttribute('data-raining')).toBe('false');
    expect(container.querySelectorAll('.bath-drop').length).toBe(0);
    const held = makeFrame({ stageIndex: 1, head: { x: 0.5, y: 1.3 } });
    rerender(<BathEffects2D frame={held} />);
    expect(rain()!.getAttribute('data-raining')).toBe('true');
    const drops = [...container.querySelectorAll('.bath-drop')];
    expect(drops.length).toBe(6);
    for (const d of drops) expect(Number((d as HTMLElement).style.getPropertyValue('--fall'))).toBeGreaterThan(0);
    const hits = container.querySelectorAll('[data-testid="bath-on-body"] .bath-splash');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(Number(h.getAttribute('cy'))).toBeLessThan((1 - held.outline.bottom) * 100);
    expect(container.querySelector('[data-testid="bath-tool-in-hand"]')!.getAttribute('data-resting')).toBe('false');
  });

  it('a cue plays once: the same cues seen again add nothing, a later cue plays, the burst goes after its moment, a new ritual starts afresh', () => {
    const shake = makeFrame({ cues: [{ id: 1, kind: 'shake' }], wetness: 1, status: 'done', stageIndex: 2 });
    const { container, rerender } = render(<BathEffects2D frame={shake} />);
    const bursts = () => [...container.querySelectorAll('[data-testid="bath-burst"]')];
    expect(bursts().length).toBe(1);
    expect(bursts()[0].getAttribute('data-kind')).toBe('shake');
    expect(bursts()[0].querySelectorAll('.bath-burst__drop').length).toBe(10);
    expect(container.querySelector('[data-testid="bath-shake"]')).not.toBeNull();
    rerender(<BathEffects2D frame={makeFrame({ cues: [{ id: 1, kind: 'shake' }], wetness: 1, status: 'done', stageIndex: 2, revision: 2 })} />);
    rerender(<BathEffects2D frame={makeFrame({ cues: [{ id: 1, kind: 'shake' }], wetness: 1, status: 'done', stageIndex: 2, revision: 3 })} />);
    expect(bursts().length).toBe(1);
    rerender(<BathEffects2D frame={makeFrame({ cues: [{ id: 1, kind: 'shake' }, { id: 2, kind: 'rinse' }, { id: 3, kind: 'splash-in' }], wetness: 1 })} />);
    expect(bursts().map((b) => b.getAttribute('data-kind'))).toEqual(['shake', 'splash-in']);
    expect(bursts()[1].querySelector('.bath-burst__ring')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(bursts().length).toBe(0);
    expect(container.querySelector('[data-testid="bath-shake"]')).toBeNull();
    // Another ritual: its first cue (id 1 again) is new
    rerender(<BathEffects2D frame={makeFrame({ key: 2, cues: [{ id: 1, kind: 'splash-out' }] })} />);
    expect(bursts().map((b) => b.getAttribute('data-kind'))).toEqual(['splash-out']);
  });

  it('reduced motion: no streams, no running or falling drops, no rain drops (a still spray), the foam and the sheen still there, a burst still once', () => {
    const frame = makeFrame({ foamed: true, wet: true, wetness: 1, stageIndex: 1, head: { x: 0.5, y: 1.3 }, reducedMotion: true, cues: [{ id: 1, kind: 'shake' }] });
    const { container } = render(<BathEffects2D frame={frame} />);
    const q = (s: string) => container.querySelector(s);
    expect(q('[data-testid="bath-effects"]')!.getAttribute('data-reduced')).toBe('true');
    expect(q('[data-testid="bath-streams"]')!.getAttribute('data-count')).toBe('0');
    expect(q('[data-testid="bath-droplets"]')!.getAttribute('data-count')).toBe('0');
    expect(container.querySelectorAll('.bath-droplet__fall, .bath-droplet__slide, .bath-drop').length).toBe(0);
    expect(q('.bath-rain__spray')).not.toBeNull();
    expect(Number(q('[data-testid="bath-foam"]')!.getAttribute('data-count'))).toBe(frame.cells.filter((c) => c.foamed).length);
    expect(q('[data-testid="bath-sheen"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="bath-burst"]').length).toBe(1);
  });
});
