/**
 * Carrying an item into the room: a mouse lifts it past the slop in any
 * direction, a finger only upward or downward (sideways is the strip
 * scrolling); a press that never lifts is a tap (it selects); and every
 * other ending (cancel, blur, Escape, the caller's cancel) drops nothing.
 * The ghost moves without React rendering.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRoomItemDrag, DRAG_SLOP } from './useRoomItemDrag';

function Harness({ onDrop, onTap, onHover, renders }: { onDrop: (k: string, x: number, y: number) => void; onTap: (k: string) => void; onHover?: (k: string, p: { x: number; y: number } | null) => void; renders: { n: number } }) {
  const drag = useRoomItemDrag({ onDrop, onTap, onHover });
  renders.n += 1;
  return (
    <div>
      <div data-testid="tile" onPointerDown={(e) => drag.start(e, 'apple')} />
      <button type="button" data-testid="cancel" onClick={drag.cancel} />
      <div ref={drag.ghostRef} data-testid="ghost" style={{ display: 'none' }} />
      <span data-testid="session">{drag.session ? `${drag.session.key}:${drag.session.lifted ? 'lifted' : 'pressed'}` : 'none'}</span>
    </div>
  );
}

function setup() {
  const onDrop = vi.fn();
  const onTap = vi.fn();
  const onHover = vi.fn();
  const renders = { n: 0 };
  render(<Harness onDrop={onDrop} onTap={onTap} onHover={onHover} renders={renders} />);
  return { onDrop, onTap, onHover, renders };
}

const press = (type: 'mouse' | 'touch', x = 100, y = 300) => fireEvent.pointerDown(screen.getByTestId('tile'), { pointerId: 1, isPrimary: true, button: 0, pointerType: type, clientX: x, clientY: y });
const move = (x: number, y: number, pointerType = 'mouse') => act(() => { window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y, pointerType, bubbles: true })); });
const up = (x: number, y: number) => act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y, bubbles: true })); });

describe('carrying an item into the room', () => {
  // A drop swallows the click that follows it until the next task; let a previous test's drop finish that
  beforeEach(() => new Promise((resolve) => setTimeout(resolve, 0)));

  it('a mouse press lifts past the slop, the ghost follows without a render per move, and letting go drops it at the point', () => {
    const { onDrop, onTap, onHover, renders } = setup();
    press('mouse');
    move(100 + DRAG_SLOP - 2, 300);
    expect(screen.getByTestId('session')).toHaveTextContent('apple:pressed');
    move(140, 200);
    expect(screen.getByTestId('session')).toHaveTextContent('apple:lifted');
    const afterLift = renders.n;
    for (let i = 0; i < 10; i++) move(140 + i * 5, 200 - i * 5);
    expect(renders.n).toBe(afterLift);
    expect(screen.getByTestId('ghost').style.display).toBe('');
    expect(screen.getByTestId('ghost').style.transform).toContain('translate3d(185px, 155px, 0)');
    expect(onHover).toHaveBeenLastCalledWith('apple', { x: 185, y: 155 });
    up(190, 150);
    expect(onDrop).toHaveBeenCalledWith('apple', 190, 150);
    expect(onTap).not.toHaveBeenCalled();
    expect(onHover).toHaveBeenLastCalledWith('apple', null);
    expect(screen.getByTestId('ghost').style.display).toBe('none');
    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });

  it('a press that never lifts is a tap, which only selects; it never drops', () => {
    const { onDrop, onTap } = setup();
    press('mouse');
    move(103, 302);
    up(103, 302);
    expect(onTap).toHaveBeenCalledWith('apple');
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('a finger moving sideways is scrolling the strip: no lift, no drop, no tap; moving up lifts the item', () => {
    const { onDrop, onTap } = setup();
    press('touch');
    move(160, 304, 'touch');
    expect(screen.getByTestId('session')).toHaveTextContent('none');
    up(200, 304);
    expect(onDrop).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
    press('touch');
    move(104, 250, 'touch');
    expect(screen.getByTestId('session')).toHaveTextContent('apple:lifted');
    up(104, 200);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('pointercancel, losing the window, Escape and the caller\'s cancel each end the drag with nothing dropped', () => {
    const { onDrop, onTap, onHover } = setup();
    const endings = [
      () => act(() => { window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })); }),
      () => act(() => { window.dispatchEvent(new Event('blur')); }),
      () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }),
      () => fireEvent.click(screen.getByTestId('cancel')),
    ];
    for (const [i, end] of endings.entries()) {
      press('mouse');
      move(150, 200);
      end();
      expect(`ending ${i}: ${screen.getByTestId('session').textContent}`).toBe(`ending ${i}: none`);
      expect(onHover).toHaveBeenLastCalledWith('apple', null);
      // A pointerup after the end belongs to no drag
      up(150, 200);
    }
    expect(onDrop).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('the click after a drop is swallowed, so a drop over a tile does not also press it', () => {
    const { onDrop } = setup();
    const clicked = vi.fn();
    window.addEventListener('click', clicked);
    press('mouse');
    move(160, 200);
    up(160, 200);
    fireEvent.click(document.body);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(clicked).not.toHaveBeenCalled();
    window.removeEventListener('click', clicked);
  });

  it('leaves no window listener behind, however a drag ends or if the strip goes mid-drag', () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const own = (spy: typeof added) => spy.mock.calls.filter(([type]) => ['pointermove', 'pointerup', 'pointercancel', 'blur', 'keydown'].includes(String(type))).length;
    const { onDrop } = setup();
    press('mouse');
    move(150, 200);
    up(150, 200);
    press('mouse');
    move(150, 200);
    act(() => { window.dispatchEvent(new Event('blur')); });
    press('mouse');
    press('mouse');
    up(100, 300);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(own(added)).toBeGreaterThan(0);
    expect(own(removed)).toBe(own(added));
    // Unmounted while carrying: the listeners go with it
    press('mouse');
    move(150, 200);
    cleanup();
    expect(own(removed)).toBe(own(added));
    added.mockRestore();
    removed.mockRestore();
  });
});
