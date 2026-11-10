/**
 * World travel with the primary relay in the list: its EMPTY answer alone is
 * never "this Blobbi never travelled". In-memory relays only.
 */
import { describe, expect, it } from 'vitest';
import { BLOBBI_WORLD_TRAVEL_RELAYS, isPermanentRefusal, type NostrEvent, type NostrFilter, type WorldTravelRelays } from '@blobbi-kit/core';
import { COPY_OFF_MESSAGE, HOME_WORLD_TRAVEL_RELAYS, UncorroboratedEmptyError, gateExistingEvents, guardEmptyPrimary } from './travel-relays';
import { createCarryGate, type CarryGate } from '@/lib/sync-consent';
import { PRIMARY_RELAY } from '@/config/relays';

const [DITTO, PRIMAL] = BLOBBI_WORLD_TRAVEL_RELAYS;
const filter: NostrFilter = { kinds: [31126], authors: ['a'.repeat(64)], '#d': ['pet'], limit: 5 };
const location = { id: '1'.repeat(64), kind: 31126 } as NostrEvent;

function network(answers: Record<string, NostrEvent[] | 'down' | number>) {
  const published: string[] = [];
  const inner: WorldTravelRelays = {
    urls: HOME_WORLD_TRAVEL_RELAYS,
    async query(url, _filter, signal) {
      const answer = answers[url];
      if (answer === 'down') throw new Error('unreachable');
      if (typeof answer === 'number') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, answer);
          signal.addEventListener('abort', () => (clearTimeout(timer), reject(new Error('aborted'))), { once: true });
        });
        return [];
      }
      return answer;
    },
    async publish(url) {
      published.push(url);
    },
  };
  return { relays: guardEmptyPrimary(inner), published };
}

describe("the home's world travel relays", () => {
  it('are the primary first, then the two the kit names, each once', () => {
    expect(HOME_WORLD_TRAVEL_RELAYS).toEqual([PRIMARY_RELAY, 'wss://relay.ditto.pub', 'wss://relay.primal.net']);
  });

  it('an empty primary answering alone is silence: the look stays unconfirmed', async () => {
    const { relays } = network({ [PRIMARY_RELAY]: [], [DITTO]: 'down', [PRIMAL]: 'down' });
    const asked = relays.urls.map((url) => relays.query(url, filter, AbortSignal.timeout(40)).then(
      () => 'answered',
      (error: unknown) => (error instanceof UncorroboratedEmptyError ? 'held' : 'failed'),
    ));
    expect(await Promise.all(asked)).toEqual(['held', 'failed', 'failed']);
  });

  it('its empty answer counts once another relay has answered the same question, even later, even with nothing', async () => {
    const { relays } = network({ [PRIMARY_RELAY]: [], [DITTO]: 25, [PRIMAL]: 'down' });
    const signal = AbortSignal.timeout(500);
    const [primary, ditto] = await Promise.all([relays.query(PRIMARY_RELAY, filter, signal), relays.query(DITTO, filter, signal)]);
    expect(primary).toEqual([]);
    expect(ditto).toEqual([]);
    // Vouched for a while: the next look does not wait
    await expect(relays.query(PRIMARY_RELAY, filter, AbortSignal.timeout(20))).resolves.toEqual([]);
    // Another question is not vouched by that answer
    await expect(relays.query(PRIMARY_RELAY, { ...filter, '#d': ['other'] }, AbortSignal.timeout(20))).rejects.toBeInstanceOf(UncorroboratedEmptyError);
  });

  it('an answer WITH a location is passed on at once, from the primary as from any relay', async () => {
    const { relays } = network({ [PRIMARY_RELAY]: [location], [DITTO]: 'down', [PRIMAL]: 'down' });
    await expect(relays.query(PRIMARY_RELAY, filter, AbortSignal.timeout(20))).resolves.toEqual([location]);
  });

  it('writes are untouched: a move is offered to the primary like to the rest', async () => {
    const { relays, published } = network({});
    for (const url of relays.urls) await relays.publish(url, location, AbortSignal.timeout(20));
    expect(published).toEqual([...HOME_WORLD_TRAVEL_RELAYS]);
  });
});

describe('world travel never re-sends an existing location on its own', () => {
  const ME = 'a'.repeat(64);
  const old = { id: '2'.repeat(64), pubkey: ME, kind: 31126 } as NostrEvent;
  const fresh = { id: '3'.repeat(64), pubkey: ME, kind: 31126 } as NostrEvent;
  function gated(gate: CarryGate) {
    const published: string[] = [];
    const inner: WorldTravelRelays = { urls: HOME_WORLD_TRAVEL_RELAYS, query: async () => [old], publish: async (url, event) => void published.push(`${event.id[0]}@${url}`) };
    return { relays: gateExistingEvents(guardEmptyPrimary(inner), gate), published };
  }

  it("the kit's repair of a relay that lacks the location is refused with `blocked:` (final for the kit), on every relay", async () => {
    const { relays, published } = gated(createCarryGate(null));
    for (const url of relays.urls) {
      const error = await relays.publish(url, old, AbortSignal.timeout(20)).then(() => null, (e: Error) => e);
      expect(error?.message).toBe(COPY_OFF_MESSAGE);
      expect(isPermanentRefusal(error)).toBe(true);
    }
    expect(published).toEqual([]);
  });

  it('a move signed in this visit is offered to the primary and the secondaries as before', async () => {
    const gate = createCarryGate(null);
    gate.markSigned(fresh.id);
    const { relays, published } = gated(gate);
    for (const url of relays.urls) await relays.publish(url, fresh, AbortSignal.timeout(20));
    expect(published).toEqual(HOME_WORLD_TRAVEL_RELAYS.map((url) => `3@${url}`));
  });

  it('with copying on, the repair reaches the relays the account agreed to and no other', async () => {
    const gate = createCarryGate(null);
    gate.enable(ME, [PRIMARY_RELAY, DITTO]);
    const { relays, published } = gated(gate);
    await Promise.allSettled(relays.urls.map((url) => relays.publish(url, old, AbortSignal.timeout(20))));
    expect(published).toEqual([`2@${PRIMARY_RELAY}`, `2@${DITTO}`]);
  });
});
