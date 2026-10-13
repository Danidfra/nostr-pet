import { useContext } from 'react';
import { useNostr } from '@nostrify/react';
import { NLogin, generateNostrConnectParams, generateNostrConnectURI, useNostrLogin, type NostrConnectParams, type NostrConnectStatus } from '@nostrify/react/login';
import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { GuestUserContext } from '@/features/guest/guest-context';
import { BASE_RELAYS } from '@/config/relays';
import { CLIENT_NAME } from '@/features/care/usePublishAdapter';

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
 *
 * In dev fixture mode the signed-in user is the fixture's, so the menu's
 * sign-out and key backup must not reach the device's real login store:
 * `logout` does nothing and there is no session key to show.
 */
export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();
  const fixture = useContext(DevFixtureContext) !== null;
  // A guest (M14) has no login: nothing to sign out of, no session key to show; saving is the guest feature's own flow
  const guest = useContext(GuestUserContext) !== null && logins.length === 0;
  const current = fixture ? undefined : logins[0];

  return {
    /** NIP-46 "bunker://" remote signer. */
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
    },
    /**
     * NIP-46, client-initiated (`nostrconnect://`): the app makes an
     * ephemeral client key and a random secret, shows them as a QR or a
     * deep link, and waits on the application relays for the signer to
     * answer. The ephemeral key lives in memory for the handshake only;
     * the URI carries the client's PUBLIC key and the secret, by the
     * protocol's design, never any user key. `signal` cancels the wait.
     */
    nostrconnect: {
      start(): { params: NostrConnectParams; uri: string } {
        const params = generateNostrConnectParams([...BASE_RELAYS]);
        return { params, uri: generateNostrConnectURI(params, { name: CLIENT_NAME }) };
      },
      async wait(params: NostrConnectParams, signal: AbortSignal, onStatus?: (status: NostrConnectStatus) => void): Promise<void> {
        const login = await NLogin.fromNostrConnect(params, nostr, { signal, onStatus });
        addLogin(login);
      },
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
    /** How the current session signed in, for the menu; `'guest'` while a guest plays without an account. */
    loginType: guest ? ('guest' as const) : (current?.type ?? null),
    /** The secret key of an nsec session, for the backup step in the menu; null for signer logins. */
    sessionNsec: current?.type === 'nsec' ? current.data.nsec : null,
    /** Sign out the current user. */
    logout(): void {
      if (current) removeLogin(current.id);
    },
  };
}
