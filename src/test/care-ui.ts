import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** The starter item that answers each verb (the free kit; never owned). */
export const STARTER_FOR = { feed: 'blobbi:food:apple', play: 'blobbi:toy:ball', clean: 'blobbi:hygiene:soap' } as const;

/**
 * Care with the starter kit, as a player with nothing in the bag would:
 * open the verb, choose its starter item. Rest is one tap: the bed comes
 * out and the Blobbi goes to it.
 */
export async function chooseCare(verb: 'feed' | 'play' | 'clean' | 'rest'): Promise<void> {
  await userEvent.click(screen.getByTestId(`care-${verb}`));
  if (verb === 'rest') return;
  await userEvent.click(await screen.findByTestId(`care-option-starter-${STARTER_FOR[verb]}`));
}

/**
 * Use an OWNED item the way the player does: from the Inventory overlay
 * (the bag), never from the care strip, which shows the starter kit only.
 */
export async function useOwnedItem(itemId: string): Promise<void> {
  await userEvent.click(screen.getByTestId('action-items'));
  await userEvent.click(await screen.findByTestId(`inventory-item-${itemId}`));
  await userEvent.click(screen.getByTestId('inventory-use'));
}
