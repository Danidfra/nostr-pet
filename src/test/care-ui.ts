import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** The starter item that answers each verb (the free kit; never owned). */
export const STARTER_FOR = { feed: 'blobbi:food:apple', play: 'blobbi:toy:ball', clean: 'blobbi:hygiene:soap' } as const;

export interface CarouselItem {
  id: string;
  source: 'starter' | 'owned';
  usable: boolean;
  /** The ×N badge, for an owned item. */
  label: string;
}

/** The item in the middle of the open care carousel. */
export function carouselCurrent(prefix = 'care-item'): CarouselItem {
  const use = screen.getByTestId(`${prefix}-use`);
  return { id: use.getAttribute('data-item-id')!, source: use.getAttribute('data-source') as CarouselItem['source'], usable: use.getAttribute('data-usable') === 'true', label: use.getAttribute('aria-label') ?? '' };
}

/** Every item the open carousel offers, in order, by walking it with its arrow and back to where it was. */
export async function carouselItems(prefix = 'care-item'): Promise<CarouselItem[]> {
  const carousel = screen.getByTestId(`${prefix}-carousel`);
  const count = Number(carousel.getAttribute('data-count'));
  const out: CarouselItem[] = [];
  for (let i = 0; i < count; i++) {
    out.push(carouselCurrent(prefix));
    if (count > 1) await userEvent.click(screen.getByTestId(`${prefix}-next`));
  }
  return out;
}

/** Bring an item to the middle of the open carousel (by its arrow) and tap it: the player's choice. */
export async function chooseFromCarousel(itemId: string, prefix = 'care-item'): Promise<void> {
  const count = Number((await screen.findByTestId(`${prefix}-carousel`)).getAttribute('data-count'));
  for (let i = 0; i < count && carouselCurrent(prefix).id !== itemId; i++) await userEvent.click(screen.getByTestId(`${prefix}-next`));
  if (carouselCurrent(prefix).id !== itemId) throw new Error(`${itemId} is not in the carousel`);
  await userEvent.click(screen.getByTestId(`${prefix}-use`));
}

/**
 * Care with the starter kit, as a player with nothing in the bag would:
 * open the verb, choose its starter item in the carousel. Rest is one tap:
 * the bed comes out and the Blobbi goes to it.
 */
export async function chooseCare(verb: 'feed' | 'play' | 'clean' | 'rest'): Promise<void> {
  await userEvent.click(screen.getByTestId(`care-${verb}`));
  if (verb === 'rest') return;
  await chooseFromCarousel(STARTER_FOR[verb]);
}

/** Use an OWNED item from the Inventory overlay (the bag): the other way to it, beside the verb's carousel. */
export async function useOwnedItem(itemId: string): Promise<void> {
  await userEvent.click(screen.getByTestId('action-items'));
  await userEvent.click(await screen.findByTestId(`inventory-item-${itemId}`));
  await userEvent.click(screen.getByTestId('inventory-use'));
}
