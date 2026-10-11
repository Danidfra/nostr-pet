import { createContext, type ReactNode } from 'react';
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
  /**
   * The fixture world's own panel, for a dev surface that would rather show
   * it inside its own (the room's dev tools): `node` is the panel, embedded;
   * `claim` hides the floating one while the claim lasts and returns the
   * release.
   */
  panel?: { node: ReactNode; claim: () => () => void };
}

export const DevFixtureContext = createContext<DevFixtureUser | null>(null);
