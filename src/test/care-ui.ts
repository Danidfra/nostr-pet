import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Care the plain way, as a player with nothing in the bag would: open the
 * verb, choose the plain option above it. Rest is one tap: the bed comes
 * out and the Blobbi goes to it.
 */
export async function chooseCare(verb: 'feed' | 'play' | 'clean' | 'rest'): Promise<void> {
  await userEvent.click(screen.getByTestId(`care-${verb}`));
  if (verb === 'rest') return;
  await userEvent.click(await screen.findByTestId(`care-option-plain-${verb}`));
}

/** Choose an owned item for a verb from the strip above the verb row. */
export async function chooseItem(verb: 'feed' | 'play' | 'clean', itemId: string): Promise<void> {
  await userEvent.click(screen.getByTestId(`care-${verb}`));
  await userEvent.click(await screen.findByTestId(`care-option-${itemId}`));
}
