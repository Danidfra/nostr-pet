import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { RelayDiagnosticsContext } from '@/hooks/useRelayDiagnostics';
import { createRelayDiagnostics } from '@/lib/relay-diagnostics';
import { FakeRelay } from '@/test/fake-relays';
import RelayDiagnosticsPanel from './RelayDiagnosticsPanel';

describe('the relay diagnostics panel (dev builds)', () => {
  it('shows sockets, open subscriptions and publication verdicts as they happen, and nothing without a store', async () => {
    const store = createRelayDiagnostics();
    const { unmount } = render(
      <RelayDiagnosticsContext.Provider value={store}>
        <RelayDiagnosticsPanel />
      </RelayDiagnosticsContext.Provider>,
    );
    await act(async () => {
      store.log({ url: 'wss://a.test', ns: 'relay.ws.state', state: 'open' });
      const relay = store.instrument(new FakeRelay('wss://a.test'), 'wss://a.test');
      await relay.event({ id: 'abcdef12'.repeat(8), pubkey: 'p', kind: 31124, created_at: 1, tags: [], content: '', sig: 's' });
    });
    const panel = screen.getByTestId('relay-diagnostics');
    expect(panel).toHaveTextContent('1 open');
    expect(panel).toHaveTextContent('kind 31124 abcdef12 → a.test: accepted');
    unmount();
    const empty = render(<RelayDiagnosticsPanel />);
    expect(empty.container.innerHTML).toBe('');
  });
});
