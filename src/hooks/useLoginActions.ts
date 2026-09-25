import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';

/**
 * Login/logout actions over nostrify's login store, the store Ditto and
 * Island use (`NostrLoginProvider`, key `nostr:login`).
 *
 * Three ways in, all first-class: a NIP-07 extension and a NIP-46 bunker
 * keep the identity key out of this origin and are preferred for anyone
 * who has one; a secret key (nsec) is how a new account made here signs in
 * and how a backup file comes back. An nsec login is persisted by the
 * store the way the ecosystem persists it; this app adds no storage of its
 * own for it, never logs it, never sends it to a relay and never puts it
 * in a URL (see features/onboarding/new-account.ts).
 */
export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();
  const current = logins[0];

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
    /** A secret key: a new account made here, or a backup brought back. */
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
    },
    /** How the current session signed in, for the menu. */
    loginType: current?.type ?? null,
    /** The secret key of an nsec session, for the backup step in the menu; null for signer logins. */
    sessionNsec: current?.type === 'nsec' ? current.data.nsec : null,
    /** Sign out the current user. */
    logout(): void {
      if (current) removeLogin(current.id);
    },
  };
}
