/**
 * The connection dot and the primary relay: something saved on the other
 * relays and still on its way to the Blobbi relay is a quiet dot with its own
 * words; a relay that refused (its write list) is not news and shows nothing.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionChip } from './ConnectionChip';
import { RelaySyncContext } from '@/hooks/useRelaySync';
import { NO_RELAY_SYNC, type PrimarySyncStatus, type RelaySync } from '@/lib/relay-sync';

function withStatus(status: PrimarySyncStatus, level: 'healthy' | 'degraded' = 'healthy') {
  const sync: RelaySync = { ...NO_RELAY_SYNC, status: { snapshot: () => status, subscribe: () => () => {} } };
  return render(
    <RelaySyncContext.Provider value={sync}>
      <ConnectionChip level={level} online onRetry={() => {}} />
    </RelaySyncContext.Provider>,
  );
}

describe('the connection dot and the primary relay', () => {
  it('shows nothing while healthy and in sync', () => {
    withStatus({ state: 'synced', pending: 0 });
    expect(screen.queryByTestId('connection-dot')).toBeNull();
  });

  it('a write saved elsewhere and owed to the primary is the quiet dot, saying it is saved', () => {
    withStatus({ state: 'pending', pending: 2 });
    const dot = screen.getByTestId('connection-dot');
    expect(dot).toHaveAttribute('data-primary-sync', 'pending');
    expect(dot).toHaveAccessibleName(/Saved\. Still syncing with the Blobbi relay/);
    expect(screen.queryByTestId('connection-retry')).toBeNull();
  });

  it('a primary that refused shows nothing: the action stood on the other relays', () => {
    withStatus({ state: 'refused', pending: 0, message: 'blocked: this relay is in pilot mode; author is not on the write list' });
    expect(screen.queryByTestId('connection-dot')).toBeNull();
  });

  it('a failing relay keeps its own words, whatever the primary owes', () => {
    withStatus({ state: 'pending', pending: 1 }, 'degraded');
    expect(screen.getByTestId('connection-dot')).toHaveAccessibleName('Some relays are not answering');
  });
});
