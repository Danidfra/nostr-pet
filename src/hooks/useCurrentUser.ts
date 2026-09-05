import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useMemo } from 'react';

import { useAuthor } from './useAuthor';

/**
 * The signed-in user, resolved from persisted logins. Recovered as-is from the
 * pre-nuke app: NIP-07 extension, NIP-46 bunker and nsec logins all resolve,
 * so a session created by any supported method keeps working.
 */
export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();

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
    const users: NUser[] = [];
    for (const login of logins) {
      try {
        users.push(loginToUser(login));
      } catch (error) {
        console.warn('Skipped invalid login', login.id, error);
      }
    }
    return users;
  }, [logins, loginToUser]);

  const user = users[0] as NUser | undefined;
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    ...author.data,
  };
}
