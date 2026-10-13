import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useContext, useMemo } from 'react';
import { DevFixtureContext } from '@/dev/DevFixtureContext';

import { useAuthor } from './useAuthor';

/**
 * The signed-in user, resolved from persisted logins. Recovered as-is from the
 * pre-nuke app: NIP-07 extension, NIP-46 bunker and nsec logins all resolve,
 * so a session created by any supported method keeps working.
 */
export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  // Dev fixture mode hands in a user; null everywhere else (see src/dev/).
  const fixture = useContext(DevFixtureContext);

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
  }, [logins, loginToUser, fixture]);

  const user = users[0] as NUser | undefined;
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    ...author.data,
  };
}
