/**
 * A stored secret-key login that no longer decodes is skipped, and the key
 * never reaches the console: the decoder's own error quotes the string it
 * was given ("Invalid checksum in nsec1…"), so only the kind of login is said.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import type { NPool } from '@nostrify/nostrify';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { useCurrentUser } from './useCurrentUser';

const pool = { query: vi.fn(async () => []), event: vi.fn(async () => {}), group: () => pool } as unknown as NPool;

function Who() {
  const { user } = useCurrentUser();
  return <p data-testid="who">{user ? 'signed in' : 'signed out'}</p>;
}

afterEach(() => window.localStorage.clear());

describe('a stored login that cannot be read', () => {
  it('is skipped, and the console never sees the key', async () => {
    const nsec = nip19.nsecEncode(generateSecretKey());
    // One character changed: the checksum fails, and the decoder's message would quote it all
    const corrupted = nsec.slice(0, -1) + (nsec.endsWith('q') ? 'p' : 'q');
    window.localStorage.setItem('test:corrupt', JSON.stringify([{ id: 'nsec:x', type: 'nsec', pubkey: 'f'.repeat(64), createdAt: new Date().toISOString(), data: { nsec: corrupted } }]));
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NostrContext.Provider value={{ nostr: pool }}>
          <NostrLoginProvider storageKey="test:corrupt">
            <Who />
          </NostrLoginProvider>
        </NostrContext.Provider>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('who')).toHaveTextContent('signed out');
    const said = spies.flatMap((s) => s.mock.calls.map((c) => c.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join(' ')));
    expect(said.some((line) => /could not be read/.test(line))).toBe(true);
    for (const line of said) expect(line).not.toContain(corrupted.slice(5, 40));
    for (const s of spies) s.mockRestore();
  });
});
