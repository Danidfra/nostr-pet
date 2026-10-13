import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useContext, useMemo } from 'react';
import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { GuestUserContext } from '@/features/guest/guest-context';

import { useAuthor } from './useAuthor';

/**
 * The signed-in user, resolved from persisted logins. Recovered as-is from the
 * pre-nuke app: NIP-07 extension, NIP-46 bunker and nsec logins all resolve,
 * so a session created by any supported method keeps working.
 *
 * A guest (M14) is the user while a guest plays and nobody is signed in: the
 * guest's reserved pubkey with the local record signer, provided by
 * `GuestTransport` and only then. A login always wins over it.
 */
export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  // Dev fixture mode hands in a user; null everywhere else (see src/dev/).
  const fixture = useContext(DevFixtureContext);
  const guest = useContext(GuestUserContext);

  const loginToUser = useCallback(
    (login: NLoginType): NUser => {
      switch (login.type) {
        case 'nsec':
          return NUser.fromNsecLogin(login);
        case 'bunker':
          return NUser.fromBunkerLogin(login, nostr);
        case 'extension':
          return NUser.fromExtensionLogin(login);
        default:
          throw new Error(`Unsupported login type: ${login.type}`);
      }
    },
    [nostr],
  );

  const users = useMemo(() => {
    if (fixture) return [fixture as unknown as NUser];
    if (guest && logins.length === 0) return [guest as unknown as NUser];
    const users: NUser[] = [];
    for (const login of logins) {
      try {
        users.push(loginToUser(login));
      } catch {
        // Only the kind of login: a stored secret key that fails to decode is quoted by the decoder's error
        // ("Invalid checksum in nsec1…"), and a key never goes to the console
        console.warn('Skipped a login that could not be read:', login.type);
      }
    }
    return users;
  }, [logins, loginToUser, fixture, guest]);

  const user = users[0] as NUser | undefined;
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    ...author.data,
  };
}
