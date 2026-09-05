import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';

/**
 * Login/logout actions. Recovered from the pre-nuke app with one deliberate
 * omission: no nsec login. A pasted or uploaded secret key would be persisted
 * by the login store in localStorage; this milestone only offers signers that
 * keep the identity key out of this origin (NIP-07 extension, NIP-46 bunker).
 */
export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    /** NIP-46 "bunker://" remote signer. */
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
    },
    /** NIP-07 browser extension. */
    async extension(): Promise<void> {
      const login = await NLogin.fromExtension();
      addLogin(login);
    },
    /** Sign out the current user. */
    logout(): void {
      const login = logins[0];
      if (login) removeLogin(login.id);
    },
  };
}
