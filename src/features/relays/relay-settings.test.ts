import { afterEach, describe, expect, it } from 'vitest';
import { MAX_EXTRA_RELAYS } from '@/config/relays';
import { DEFAULT_RELAY_SETTINGS, DEFAULT_RELAYS, RELAY_SETTINGS_KEY, addExtraRelay, parseRelayList, parseRelaySettings, readRelaySettings, removeExtraRelay, setExtraAccess, writeRelaySettings } from './relay-settings';

afterEach(() => writeRelaySettings(DEFAULT_RELAY_SETTINGS));

describe('relay settings', () => {
  it('the essential relays are the Blobbi relay and the network relays, normalized', () => {
    expect(DEFAULT_RELAYS).toEqual(['wss://relay.blobbi.pet', 'wss://relay.ditto.pub', 'wss://relay.primal.net', 'wss://relay.nostr.band']);
  });

  it('adds a relay normalized, read-only, and refuses what is not one, an essential one, a duplicate or a sixth', () => {
    let s = DEFAULT_RELAY_SETTINGS;
    const first = addExtraRelay(s, ' Relay.Example.COM/ ');
    expect(first).toMatchObject({ ok: true, url: 'wss://relay.example.com' });
    s = (first as { settings: typeof s }).settings;
    expect(s.extras).toEqual([{ url: 'wss://relay.example.com', read: true, write: false, source: 'manual' }]);
    expect(addExtraRelay(s, 'wss://relay.example.com')).toEqual({ ok: false, reason: 'duplicate' });
    expect(addExtraRelay(s, 'wss://relay.ditto.pub/')).toEqual({ ok: false, reason: 'essential' });
    for (const bad of ['ws://plain.example', 'https://web.example', 'wss://user:pw@x.example', 'not a url']) expect(addExtraRelay(s, bad)).toEqual({ ok: false, reason: 'invalid' });
    for (let i = 2; i <= MAX_EXTRA_RELAYS; i++) s = (addExtraRelay(s, `wss://r${i}.example`) as { settings: typeof s }).settings;
    expect(s.extras).toHaveLength(MAX_EXTRA_RELAYS);
    expect(addExtraRelay(s, 'wss://one-more.example')).toEqual({ ok: false, reason: 'full' });
  });

  it('read and send are set apart; removing takes it out', () => {
    const s = (addExtraRelay(DEFAULT_RELAY_SETTINGS, 'wss://a.example') as { settings: typeof DEFAULT_RELAY_SETTINGS }).settings;
    expect(setExtraAccess(s, 'wss://a.example', { read: false, write: true }).extras[0]).toMatchObject({ read: false, write: true });
    expect(removeExtraRelay(s, 'wss://a.example').extras).toEqual([]);
  });

  it('reads stored settings defensively: invalid, essential and duplicate entries are dropped, never guessed', () => {
    expect(parseRelaySettings('{nope')).toEqual(DEFAULT_RELAY_SETTINGS);
    expect(parseRelaySettings({ v: 2, extras: [] })).toEqual(DEFAULT_RELAY_SETTINGS);
    expect(
      parseRelaySettings({ v: 1, extras: [{ url: 'wss://a.example', read: true, write: 'yes' }, { url: 'wss://A.example/' }, { url: 'wss://relay.primal.net' }, { url: 'http://x' }, 7] }),
    ).toEqual({ v: 1, extras: [{ url: 'wss://a.example', read: true, write: false, source: 'manual' }] });
  });

  it('kept on this device, and nothing stored for the defaults', () => {
    writeRelaySettings((addExtraRelay(DEFAULT_RELAY_SETTINGS, 'wss://a.example') as { settings: typeof DEFAULT_RELAY_SETTINGS }).settings);
    expect(JSON.parse(localStorage.getItem(RELAY_SETTINGS_KEY)!).extras).toHaveLength(1);
    expect(readRelaySettings().extras[0].url).toBe('wss://a.example');
    writeRelaySettings(DEFAULT_RELAY_SETTINGS);
    expect(localStorage.getItem(RELAY_SETTINGS_KEY)).toBeNull();
  });

  it('reads a NIP-65 list: unmarked is both, a marker is one, invalid ones are dropped', () => {
    const list = { kind: 10002, tags: [['r', 'wss://both.example'], ['r', 'wss://in.example', 'read'], ['r', 'wss://out.example', 'write'], ['r', 'http://no'], ['p', 'x']] };
    expect(parseRelayList(list)).toEqual([
      { url: 'wss://both.example', read: true, write: true },
      { url: 'wss://in.example', read: true, write: false },
      { url: 'wss://out.example', read: false, write: true },
    ]);
    expect(parseRelayList({ kind: 3, tags: [['r', 'wss://x.example']] })).toEqual([]);
  });
});
