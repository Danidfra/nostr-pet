/** English (the source language): the relay settings. */
export const relays = {
  title: 'Relays',
  tile: {
    sub: '{connected} of {total} connected. Where your Blobbi is kept on Nostr.',
  },
  intro: 'Relays are the servers that keep your Blobbi on Nostr. The Blobbi network is always used; you can add a few relays of your own. These settings stay on this device.',
  essential: {
    title: 'Blobbi network',
    hint: 'Always on: your Blobbi is read and saved here, so these cannot be turned off.',
    primary: 'Blobbi relay',
    network: 'Network relay',
  },
  extras: {
    title: 'Your relays',
    empty: 'None yet.',
    count: '{count} of {max}',
    hint: 'Extra places to read from, and, if you choose, to send your events to. Your Blobbi never depends on them.',
  },
  status: {
    ok: 'Connected',
    failing: 'Can’t connect, retrying',
    unknown: 'Not checked yet',
    idle: 'Not in use',
  },
  access: {
    read: 'Read',
    write: 'Send my events',
  },
  confirmWrite: {
    title: 'Send your events to {relay}?',
    body: 'Everything this game publishes for you (your Blobbi, its care, your items) will also be sent there. Your Blobbi does not need it to be saved.',
    allow: 'Send to this relay',
    cancel: 'Not now',
  },
  add: {
    label: 'Relay address',
    placeholder: 'wss://relay.example.com',
    button: 'Add',
    added: 'Added. It is only read from until you turn on sending.',
  },
  error: {
    invalid: 'That is not a relay address. It starts with wss://.',
    essential: 'That relay is already part of the Blobbi network.',
    duplicate: 'That relay is already in your list.',
    full: 'You can add up to {max} relays.',
  },
  remove: 'Remove {relay}',
  restore: {
    button: 'Restore defaults',
    done: 'Back to the Blobbi network only.',
  },
  nip65: {
    button: 'Show my relay list (NIP-65)',
    title: 'From your relay list',
    hint: 'Read only: your relay list is never changed here. A relay you pick is added read-only.',
    loading: 'Looking for your relay list…',
    none: 'No relay list found, or every relay in it is already here.',
    failed: 'Your relay list could not be read. Try again in a moment.',
    add: 'Add {relay}',
  },
};
