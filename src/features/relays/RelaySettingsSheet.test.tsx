import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { PUBKEY } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: [] }) }));
import { RelaySettingsSheet } from './RelaySettingsSheet';
import { DEFAULT_RELAY_SETTINGS, readRelaySettings, writeRelaySettings } from './relay-settings';

const relayList: NostrEvent = { id: '1'.repeat(64), pubkey: PUBKEY, kind: 10002, created_at: 5, tags: [['r', 'wss://mine.example'], ['r', 'wss://relay.ditto.pub'], ['r', 'wss://out.example', 'write']], content: '', sig: 's' };

function renderSheet() {
  const nostr = { query: vi.fn(async () => [relayList]), event: vi.fn(async () => {}) };
  render(
    <NostrContext.Provider value={{ nostr: nostr as never }}>
      <RelaySettingsSheet open onClose={() => {}} />
    </NostrContext.Provider>,
  );
  return nostr;
}

const addRelay = (url: string) => {
  fireEvent.change(screen.getByTestId('relay-add-input'), { target: { value: url } });
  fireEvent.click(screen.getByTestId('relay-add'));
};

afterEach(() => {
  writeRelaySettings(DEFAULT_RELAY_SETTINGS);
  currentUser.user = undefined;
});

describe('the relay settings', () => {
  it('shows the Blobbi network fixed, with no way to remove or turn it off', async () => {
    renderSheet();
    const essential = await screen.findByTestId('relays-essential');
    expect(within(essential).getAllByRole('listitem')).toHaveLength(4);
    expect(within(essential).queryByRole('button')).toBeNull();
    expect(within(essential).queryByRole('switch')).toBeNull();
  });

  it('adds a relay read-only; sending to it needs a confirmation; it can be removed; defaults restore', async () => {
    const nostr = renderSheet();
    await screen.findByTestId('relays-extras');
    addRelay('relay.example.com');
    expect(readRelaySettings().extras).toEqual([{ url: 'wss://relay.example.com', read: true, write: false, source: 'manual' }]);
    const write = screen.getByTestId('relay-write-relay.example.com');
    expect(write).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(write);
    expect(screen.getByTestId('relay-confirm-write')).toBeInTheDocument();
    expect(readRelaySettings().extras[0].write).toBe(false);
    fireEvent.click(screen.getByTestId('relay-confirm-cancel'));
    expect(readRelaySettings().extras[0].write).toBe(false);
    fireEvent.click(write);
    fireEvent.click(screen.getByTestId('relay-confirm-allow'));
    expect(readRelaySettings().extras[0].write).toBe(true);
    fireEvent.click(screen.getByTestId('relay-remove-relay.example.com'));
    expect(readRelaySettings().extras).toEqual([]);
    addRelay('wss://a.example');
    fireEvent.click(screen.getByTestId('relay-restore'));
    expect(readRelaySettings()).toEqual(DEFAULT_RELAY_SETTINGS);
    expect(nostr.event).not.toHaveBeenCalled();
  });

  it('says why a relay cannot be added', async () => {
    renderSheet();
    await screen.findByTestId('relays-extras');
    addRelay('ws://plain.example');
    expect(screen.getByTestId('relay-note')).toHaveTextContent(/starts with wss/);
    addRelay('wss://relay.primal.net');
    expect(screen.getByTestId('relay-note')).toHaveTextContent(/already part of the Blobbi network/);
  });

  it('offers the NIP-65 list read only: what is not here yet, added read-only; kind 10002 is never written', async () => {
    currentUser.user = { pubkey: PUBKEY };
    const nostr = renderSheet();
    await act(async () => fireEvent.click(await screen.findByTestId('relay-nip65-find')));
    const list = await screen.findByTestId('relay-nip65-list');
    // The essential relay in the list is not offered again
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['mine.example', 'out.example']);
    fireEvent.click(screen.getByTestId('relay-nip65-add-out.example'));
    expect(readRelaySettings().extras).toEqual([{ url: 'wss://out.example', read: true, write: false, source: 'nip65' }]);
    expect(nostr.query).toHaveBeenCalledWith([{ kinds: [10002], authors: [PUBKEY], limit: 1 }], expect.anything());
    expect(nostr.event).not.toHaveBeenCalled();
  });

  it('a guest sees no NIP-65 import', async () => {
    renderSheet();
    await screen.findByTestId('relays-extras');
    expect(screen.queryByTestId('relays-nip65')).toBeNull();
  });
});
