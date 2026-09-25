import { useMemo, type ReactNode } from 'react';
import { NostrContext } from '@nostrify/react';
import type { NostrSigner } from '@nostrify/nostrify';
import { DevFixtureContext } from './DevFixtureContext';
import { buildFixtureWorld, createFixturePool, fixtureSigner, type FixtureOptions } from './fixture-world';
import { PUBKEY } from '@/test/fixtures';

/**
 * The app over a fixture world instead of the relays: a signed-in fixture
 * user and an in-memory pool. Loaded only by a dev bundle behind the
 * dev-tools flag (`App.tsx`); a production build never contains it.
 */
export default function DevFixture({ options, children }: { options: FixtureOptions; children: ReactNode }) {
  const pool = useMemo(() => createFixturePool(buildFixtureWorld(options)), [options]);
  const user = useMemo(() => ({ pubkey: PUBKEY, signer: fixtureSigner as unknown as NostrSigner }), []);
  return (
    <DevFixtureContext.Provider value={user}>
      <NostrContext.Provider value={{ nostr: pool }}>
        <div className="dev-fixture-badge" aria-hidden>
          fixture: {options.name}
          {options.state === 'sleeping' ? ', sleeping' : ''}
          {options.low ? `, low ${options.low}` : ''}
        </div>
        {children}
      </NostrContext.Provider>
    </DevFixtureContext.Provider>
  );
}
