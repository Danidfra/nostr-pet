import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTagValue, parseModernBlobbiEvent, type NostrEvent } from '@blobbi-kit/core';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: PUBKEY, signer: { signEvent: async (t: object) => ({ ...t, pubkey: PUBKEY, id: 'f'.repeat(64), sig: 's' }) } } }),
}));
import { RenameBlobbiDialog } from './RenameBlobbiDialog';

function setup(world: NostrEvent[]) {
  const onClose = vi.fn();
  const onRenamed = vi.fn();
  const local = { query: async () => world, event: async (e: NostrEvent) => void world.push(e) };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NostrContext.Provider value={{ nostr: local as never }}>
        <RenameBlobbiDialog open onClose={onClose} blobbi={parseModernBlobbiEvent(world[0])!} pubkey={PUBKEY} updateCompanionEvent={() => {}} onRenamed={onRenamed} />
      </NostrContext.Provider>
    </QueryClientProvider>,
  );
  return { onClose, onRenamed };
}

describe('the rename dialog', () => {
  it('starts from the current name, says what is wrong, and closes only once saved', async () => {
    const world = [blobbiEvent('0000000001', { name: 'Brook', stage: 'baby' })];
    const { onClose, onRenamed } = setup(world);
    const input = await screen.findByTestId('rename-input');
    expect(input).toHaveValue('Brook');
    fireEvent.change(input, { target: { value: '   ' } });
    await act(async () => fireEvent.click(screen.getByTestId('rename-save')));
    expect(await screen.findByTestId('rename-error')).toHaveTextContent('Give it a name.');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Lupa' } });
    await act(async () => fireEvent.click(screen.getByTestId('rename-save')));
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('Lupa'));
    expect(onClose).toHaveBeenCalled();
    expect(getTagValue(world[1].tags, 'name')).toBe('Lupa');
  });
});
