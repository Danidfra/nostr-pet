import { createContext } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';

/**
 * A dev-only signed-in user, provided by `DevFixture` when the app runs in
 * fixture mode. `useCurrentUser` reads it first. The default is null, so in
 * every real build nothing changes; the provider only exists in a dev
 * bundle behind the dev-tools flag.
 */
export interface DevFixtureUser {
  pubkey: string;
  signer: NostrSigner;
}

export const DevFixtureContext = createContext<DevFixtureUser | null>(null);
