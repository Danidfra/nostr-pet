import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
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

/** A box for the bath layer (jsdom lays nothing out): the body's art box, 200 px a side. */
const BATH_BOX = { left: 0, top: 0, width: 200, height: 200 };

function bathLayer(): HTMLElement {
  const layer = screen.getByTestId('bath-layer');
  layer.getBoundingClientRect = () => ({ ...BATH_BOX, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
  return layer;
}

/** A drag over the bath layer from one box point to another (box coordinates: x across, y up), in a few moves. */
export function rubBath(from: { x: number; y: number }, to: { x: number; y: number }, pointerType: 'touch' | 'mouse' = 'touch'): void {
  const layer = bathLayer();
  const at = (p: { x: number; y: number }) => ({ clientX: p.x * BATH_BOX.width, clientY: (1 - p.y) * BATH_BOX.height });
  const base = { pointerId: 1, isPrimary: true, button: 0, pointerType };
  fireEvent.pointerDown(layer, { ...base, ...at(from) });
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    fireEvent.pointerMove(layer, { ...base, ...at({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }) });
  }
  fireEvent.pointerUp(layer, { ...base, ...at(to) });
}

/** Hold the shower over the bath layer at a box point for a while (the rinse works with time), then lift it. */
export async function holdShower(at: { x: number; y: number }, ms: number): Promise<void> {
  const layer = bathLayer();
  const base = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch' };
  fireEvent.pointerDown(layer, { ...base, clientX: at.x * BATH_BOX.width, clientY: (1 - at.y) * BATH_BOX.height });
  await new Promise((r) => setTimeout(r, ms));
  fireEvent.pointerUp(layer, { ...base, clientX: at.x * BATH_BOX.width, clientY: (1 - at.y) * BATH_BOX.height });
}


const stageNow = () => screen.getByTestId('bath-layer').dataset.stage ?? '';
const ORDER = ['entering', 'soap', 'rinse', 'dry'] as const;
const reached = (stage: string, at: string) => ORDER.indexOf(at as (typeof ORDER)[number]) >= ORDER.indexOf(stage as (typeof ORDER)[number]) || !ORDER.includes(at as (typeof ORDER)[number]);

/**
 * Play the bath as a player would, from wherever it stands: wait for the soap (the Blobbi walks to the tub first),
 * rub it over the body in strokes until the shower is in hand, hold the shower across the body until the towel is,
 * rub the towel until the write begins. Nothing is written before the last stroke. `through` stops after that stage
 * has passed; a later call carries on from there.
 */
export async function playBath(options: { through?: 'soap' | 'rinse' | 'dry' } = {}): Promise<void> {
  const through = options.through ?? 'dry';
  await waitFor(() => expect(reached('soap', stageNow())).toBe(true), { timeout: 6000 });
  if (stageNow() === 'soap') {
    for (let i = 0; i < 12 && stageNow() === 'soap'; i++) {
      const x = 0.3125 + (i % 4) * 0.125;
      rubBath({ x, y: 0.05 }, { x, y: 0.95 });
    }
    await waitFor(() => expect(reached('rinse', stageNow())).toBe(true), { timeout: 2000 });
  }
  if (through === 'soap') return;
  if (stageNow() === 'rinse') {
    for (let i = 0; i < 6 && stageNow() === 'rinse'; i++) {
      await holdShower({ x: i % 2 ? 0.6 : 0.4, y: 0.95 }, 1000);
    }
    await waitFor(() => expect(reached('dry', stageNow())).toBe(true), { timeout: 4000 });
  }
  if (through === 'rinse') return;
  if (stageNow() === 'dry') {
    for (let i = 0; i < 12 && stageNow() === 'dry'; i++) {
      const x = 0.3125 + (i % 4) * 0.125;
      rubBath({ x, y: 0.05 }, { x, y: 0.95 });
    }
  }
  await waitFor(() => expect(['committing', 'done', 'failed']).toContain(stageNow()), { timeout: 3000 });
}
