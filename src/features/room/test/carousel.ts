/**
 * Driving the room's item carousel in tests the way a player does: the
 * arrows bring an item to the middle, a tap on the middle uses it, and the
 * middle is what is dragged. (Ditto's carousel shows one item at a time, so
 * finding one means stepping to it.)
 */
import { fireEvent, screen } from '@testing-library/react';

export interface CarouselItem {
  name: string;
  source: 'starter' | 'owned';
  /** How many are left, for an owned item. */
  quantity: number | null;
  key: string;
}

/** The item in the middle: its button (what a tap uses and a drag carries). */
export const middle = (): HTMLElement => screen.getByTestId('room-item-use');

/** What the middle item is, from its button. */
export function middleItem(): CarouselItem {
  const el = middle();
  const label = el.getAttribute('aria-label') ?? '';
  const name = /^(?:Use|Give) ([^,.]+)/.exec(label)?.[1] ?? '';
  const left = /, (\d+) left/.exec(label);
  return { name, source: el.dataset.source as CarouselItem['source'], quantity: left ? Number(left[1]) : null, key: el.dataset.entryKey ?? '' };
}

const count = () => Number(screen.getByTestId('room-item-carousel').dataset.count);

/** Every item the carousel offers, in order, leaving the same one in the middle. */
export function carouselItems(): CarouselItem[] {
  const n = count();
  const items: CarouselItem[] = [];
  for (let i = 0; i < n; i++) {
    items.push(middleItem());
    fireEvent.click(screen.getByTestId('room-item-next'));
  }
  return items;
}

/** Step the carousel until this item is in the middle. Throws if it has none. */
export function focusOn(name: string, source: CarouselItem['source']): HTMLElement {
  const n = count();
  for (let i = 0; i <= n; i++) {
    const item = middleItem();
    if (item.name === name && item.source === source) return middle();
    fireEvent.click(screen.getByTestId('room-item-next'));
  }
  throw new Error(`No ${source} ${name} in the carousel`);
}

/** Whether the carousel offers this item (leaves the middle where it was). */
export function offers(name: string, source: CarouselItem['source']): boolean {
  return carouselItems().some((i) => i.name === name && i.source === source);
}
