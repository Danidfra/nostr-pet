/**
 * The one control for copying EXISTING events to the relays that lack them:
 * in the Account sheet, off until the player turns it on, showing the relays
 * that would receive copies, and off again when they say so.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const ME = 'a'.repeat(64);
const login = vi.hoisted(() => ({ type: 'extension' as string | null }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64), signer: {} }, metadata: { name: 'Robin' } }) }));
vi.mock('@/hooks/useLoginActions', () => ({ useLoginActions: () => ({ logout: () => {}, sessionNsec: null, loginType: login.type }) }));
vi.mock('@/features/onboarding/useProfileSetup', () => ({ useProfileSetup: () => ({ publish: { mutateAsync: async () => {}, isPending: false, error: null, isSuccess: false }, upload: { mutateAsync: async () => '' } }) }));

import { AccountSheet } from './AccountSheet';
import { carryGate } from '@/lib/sync-consent';
import { COPY_DESTINATIONS, PRIMARY_RELAY } from '@/config/relays';

beforeEach(() => {
  login.type = 'extension';
  carryGate.disable(ME);
});

describe('copying existing events: the account’s choice', () => {
  it('is off by default, lists the relays that would receive copies, and turns on only for those', async () => {
    render(<AccountSheet open onClose={() => {}} />);
    const section = within(screen.getByTestId('relay-copy-section'));
    const toggle = section.getByTestId('relay-copy-toggle');
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleName('Copy what I already have to the relays that are missing it');
    expect([...section.getByTestId('relay-copy-destinations').querySelectorAll('li')].map((li) => li.textContent)).toEqual(['relay.blobbi.pet', 'relay.ditto.pub', 'relay.primal.net', 'relay.nostr.band']);
    expect(carryGate.mayCarry({ id: '1'.repeat(64), pubkey: ME }, PRIMARY_RELAY)).toBe(false);

    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    for (const url of COPY_DESTINATIONS) expect(carryGate.mayCarry({ id: '1'.repeat(64), pubkey: ME }, url)).toBe(true);
    // The answer is this account's, and only for the relays it was shown
    expect(carryGate.mayCarry({ id: '1'.repeat(64), pubkey: 'b'.repeat(64) }, PRIMARY_RELAY)).toBe(false);
    expect(carryGate.mayCarry({ id: '1'.repeat(64), pubkey: ME }, 'wss://added.later')).toBe(false);

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(carryGate.mayCarry({ id: '1'.repeat(64), pubkey: ME }, PRIMARY_RELAY)).toBe(false);
  });

  it('an answer given before a relay joined the list does not cover it: shown as off, with the reason, until given again', async () => {
    carryGate.enable(ME, [PRIMARY_RELAY]);
    render(<AccountSheet open onClose={() => {}} />);
    expect(screen.getByTestId('relay-copy-toggle')).not.toBeChecked();
    expect(screen.getByTestId('relay-copy-stale')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('relay-copy-toggle'));
    expect(screen.getByTestId('relay-copy-toggle')).toBeChecked();
    expect(screen.queryByTestId('relay-copy-stale')).toBeNull();
  });

  it('a guest has no such choice', () => {
    login.type = 'guest';
    render(<AccountSheet open onClose={() => {}} />);
    expect(screen.queryByTestId('relay-copy-section')).toBeNull();
  });
});
