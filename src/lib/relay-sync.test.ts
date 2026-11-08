/**
 * Carrying the player's own events to a relay that lacks them, and knowing
 * what each relay did with a write. Synthetic events and in-memory relays
 * only: nothing here is offered to a real relay.
 */
import { describe, expect, it } from 'vitest';
import { RELAY_SYNC_KEY, createRelaySync, type RelayReadReport, type RelaySyncOptions, type SyncEvent } from './relay-sync';
import type { RelayFilter } from './blobbi-relay-routing';
import { SYNC_CONSENT_KEY, createCarryGate } from './sync-consent';

const PRIMARY = 'wss://primary.test';
const A = 'wss://a.test';
const B = 'wss://b.test';
const ME = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const KINDS = [31124, 11125, 1124, 31633, 31634, 1416, 1417];

let n = 0;
function ev(kind: number, over: Partial<SyncEvent> = {}): SyncEvent {
  n += 1;
  return { id: n.toString(16).padStart(64, '0'), pubkey: ME, kind, created_at: 1_757_000_000 + n, tags: kind >= 30000 ? [['d', 'pet-1']] : [], content: '', sig: 'f'.repeat(128), ...over };
}

interface World {
  held: Map<string, SyncEvent[]>;
  sent: { relay: string; event: SyncEvent }[];
  answer: Map<string, string>;
  clock: { now: number };
  store: Map<string, string>;
}

/** `consent: false` is a restored session: the account never turned copying on. The other tests start with it on. */
function setup(over: Partial<RelaySyncOptions> & { consent?: boolean } = {}) {
  const { consent = true, ...options } = over;
  const consentStore = new Map<string, string>();
  const gate = createCarryGate({ get: (k) => consentStore.get(k) ?? null, set: (k, v) => void consentStore.set(k, v) });
  if (consent) gate.enable(ME, [PRIMARY, A, B]);
  const world: World = { held: new Map([[PRIMARY, []], [A, []], [B, []]]), sent: [], answer: new Map(), clock: { now: 1_800_000_000_000 }, store: new Map() };
  const make = () =>
    createRelaySync({
      primary: PRIMARY,
      kinds: KINDS,
      destinations: (kind) => (kind === 31633 ? [PRIMARY, A] : [PRIMARY, A, B]),
      send: async (relay, event) => {
        world.sent.push({ relay, event });
        const refusal = world.answer.get(relay);
        if (refusal) throw new Error(refusal);
        world.held.get(relay)!.push(event);
      },
      verify: () => true,
      store: { get: (k) => world.store.get(k) ?? null, set: (k, v) => void world.store.set(k, v) },
      now: () => world.clock.now,
      gate,
      ...options,
    });
  const sync = make();
  sync.setAccount(ME);
  return { world, sync, make, gate, consentStore };
}

/** A read in which each listed relay answered to the end with what it holds (or failed, or is still pending). */
function read(world: World, filters: RelayFilter[], status: Partial<Record<string, RelayReadReport['status']>> = {}): [RelayFilter[], RelayReadReport[]] {
  const reports = [...world.held].map<RelayReadReport>(([relay, events]) => {
    const s = status[relay] ?? 'eose';
    return { relay, status: s, events: s === 'eose' ? [...events] : [], asked: filters };
  });
  return [filters, reports];
}

const pets: RelayFilter[] = [{ kinds: [31124], authors: [ME] }];
const care: RelayFilter[] = [{ kinds: [1124], authors: [ME], limit: 500 }];

describe('an own event found on some relays and missing on others', () => {
  it('found only on a secondary: the ORIGINAL event goes to the primary and to the other secondary, once', async () => {
    const { world, sync } = setup();
    const pet = ev(31124);
    world.held.get(A)!.push(pet);
    expect(await sync.noteRead(...read(world, pets))).toBe(2);
    expect(world.sent.map((s) => s.relay).sort()).toEqual([B, PRIMARY].sort());
    // The very object the relay returned: same id, same signature, nothing re-signed
    expect(world.sent.every((s) => s.event === pet)).toBe(true);
    expect(sync.entry(pet.id, PRIMARY)?.s).toBe('ok');
    // Read again before the relays caught up (they answer without it): never offered twice
    world.held.get(PRIMARY)!.length = 0;
    world.held.get(B)!.length = 0;
    expect(await sync.noteRead(...read(world, pets))).toBe(0);
    expect(world.sent).toHaveLength(2);
  });

  it('found only on the primary: it goes to the secondaries of its flow, and to no other relay', async () => {
    const { world, sync } = setup();
    const inventory = ev(31633, { tags: [['d', 'blobbi:island']] });
    world.held.get(PRIMARY)!.push(inventory);
    await sync.noteRead(...read(world, [{ kinds: [31633], authors: [ME] }]));
    expect(world.sent.map((s) => s.relay)).toEqual([A]); // B is not a relay of the inventory flow
  });

  it('a relay that failed, was cut off before EOSE, or filled its limit is left alone: presence there is unknown', async () => {
    const { world, sync } = setup();
    const pet = ev(31124);
    world.held.get(A)!.push(pet);
    expect(await sync.noteRead(...read(world, pets, { [PRIMARY]: 'failed', [B]: 'pending' }))).toBe(0);
    // A filled limit: the primary returned as many as were asked for, so the event may simply have been cut off
    const limited: RelayFilter[] = [{ kinds: [1124], authors: [ME], limit: 2 }];
    const [one, two, three] = [ev(1124), ev(1124), ev(1124)];
    world.held.get(PRIMARY)!.push(one, two);
    world.held.get(A)!.push(one, two, three);
    world.held.get(B)!.push(one, two, three);
    expect(await sync.noteRead(...read(world, limited))).toBe(0);
    expect(world.sent).toEqual([]);
  });

  it('only the winning revision of an addressable event is carried, to the relay holding the older one', async () => {
    const { world, sync } = setup();
    const old = ev(31124);
    const fresh = ev(31124);
    world.held.get(PRIMARY)!.push(fresh);
    world.held.get(A)!.push(old);
    world.held.get(B)!.push(fresh);
    await sync.noteRead(...read(world, pets));
    expect(world.sent).toEqual([{ relay: A, event: fresh }]);
  });

  it("never someone else's event, a kind outside the flow, an ephemeral, expiring or relay-bound one, or one that fails verification", async () => {
    const { world, sync } = setup({ verify: (e) => e.content !== 'forged' });
    world.held.get(A)!.push(
      ev(31124, { pubkey: OTHER }),
      ev(1, {}),
      ev(21124, {}),
      ev(31125, { tags: [['d', 'legacy']] }),
      ev(1124, { tags: [['expiration', '1900000000']] }),
      ev(1124, { tags: [['-']] }),
      ev(1124, { content: 'forged' }),
    );
    await sync.noteRead(...read(world, [{ authors: [ME, OTHER] }]));
    expect(world.sent).toEqual([]);
  });

  it('a relay is only missing what it was asked for', async () => {
    const { world, sync } = setup();
    world.held.get(A)!.push(ev(1124));
    const [filters, reports] = read(world, care);
    // The primary was sent another filter in this read: it never said it lacks care receipts
    const narrowed = reports.map((r) => (r.relay === PRIMARY ? { ...r, asked: pets } : r));
    await sync.noteRead(filters, narrowed);
    expect(world.sent.map((s) => s.relay)).toEqual([B]);
  });

  it('nothing is carried for a guest or a signed-out page, nor for an account that is no longer the one signed in', async () => {
    const { world, sync } = setup();
    world.held.get(A)!.push(ev(31124));
    sync.setAccount(null);
    expect(await sync.noteRead(...read(world, pets))).toBe(0);
    sync.setAccount(OTHER);
    expect(await sync.noteRead(...read(world, pets))).toBe(0);
    expect(world.sent).toEqual([]);
  });
});

describe('limits: no loop, no stream of refused events', () => {
  it("the primary's write list refuses one event: nothing more of that kind is offered to it until the refusal has aged out", async () => {
    const { world, sync } = setup();
    world.answer.set(PRIMARY, 'blocked: this relay is in pilot mode; author is not on the write list');
    world.held.get(A)!.push(...Array.from({ length: 30 }, () => ev(1124)));
    world.held.get(B)!.push(...world.held.get(A)!);
    await sync.noteRead(...read(world, care));
    expect(world.sent.filter((s) => s.relay === PRIMARY)).toHaveLength(1);
    expect(sync.status.snapshot()).toMatchObject({ state: 'refused', message: expect.stringMatching(/^blocked:/) });
    await sync.noteRead(...read(world, care));
    expect(world.sent.filter((s) => s.relay === PRIMARY)).toHaveLength(1);
    // Six hours later the list may have changed: one more is tried, and accepted this time
    world.clock.now += 6 * 60 * 60 * 1000 + 1;
    world.answer.delete(PRIMARY);
    await sync.noteRead(...read(world, care));
    expect(world.held.get(PRIMARY)).toHaveLength(30);
    expect(sync.status.snapshot().state).toBe('synced');
  });

  it('a relay that fails is tried again only after a growing wait, three times in all', async () => {
    const { world, sync } = setup();
    world.answer.set(PRIMARY, 'rate-limited: slow down');
    const pet = ev(31124);
    world.held.get(A)!.push(pet);
    world.held.get(B)!.push(pet);
    const attempts = () => world.sent.filter((s) => s.relay === PRIMARY).length;
    await sync.noteRead(...read(world, pets));
    await sync.noteRead(...read(world, pets));
    expect(attempts()).toBe(1);
    expect(sync.status.snapshot()).toMatchObject({ state: 'pending', pending: 1 });
    world.clock.now += 30_001;
    await sync.noteRead(...read(world, pets));
    expect(attempts()).toBe(2);
    world.clock.now += 60_001;
    await sync.noteRead(...read(world, pets));
    expect(attempts()).toBe(3);
    world.clock.now += 24 * 60 * 60 * 1000;
    await sync.noteRead(...read(world, pets));
    expect(attempts()).toBe(3);
  });

  it('what was offered is remembered across a reload (public data only: ids and relay urls)', async () => {
    const { world, sync, make } = setup();
    const pet = ev(31124);
    world.held.get(A)!.push(pet);
    world.held.get(B)!.push(pet);
    world.answer.set(PRIMARY, 'blocked: no');
    await sync.noteRead(...read(world, pets));
    const kept = world.store.get(RELAY_SYNC_KEY)!;
    expect(kept).toContain(pet.id);
    expect(kept).not.toContain(pet.sig);
    const reloaded = make();
    reloaded.setAccount(ME);
    await reloaded.noteRead(...read(world, pets));
    expect(world.sent.filter((s) => s.relay === PRIMARY)).toHaveLength(1);
    expect(reloaded.status.snapshot().state).toBe('refused');
  });

  it('a bounded number of events per read, one at a time', async () => {
    const { world, sync } = setup({ maxPerRead: 5 });
    world.held.get(A)!.push(...Array.from({ length: 12 }, () => ev(1124)));
    expect(await sync.noteRead(...read(world, care))).toBe(5);
    expect(world.sent).toHaveLength(5);
  });
});

describe('a write the primary did not take', () => {
  it('accepted by a secondary while the primary is silent: pending, until a later read carries it over', async () => {
    const { world, sync } = setup();
    const seen: string[] = [];
    sync.status.subscribe(() => seen.push(sync.status.snapshot().state));
    const pet = ev(31124);
    sync.noteResult(pet, { relay: PRIMARY, verdict: 'retry', message: 'The operation timed out' });
    expect(sync.status.snapshot().state).toBe('synced'); // held nowhere yet: the write itself has not landed
    sync.noteResult(pet, { relay: A, verdict: 'accepted' });
    expect(sync.status.snapshot()).toEqual({ state: 'pending', pending: 1 });
    world.held.get(A)!.push(pet);
    world.held.get(B)!.push(pet);
    // Too soon after the failed attempt: owed, not offered
    await sync.noteRead(...read(world, pets));
    expect(world.sent).toEqual([]);
    world.clock.now += 30_001;
    await sync.noteRead(...read(world, pets));
    expect(world.sent).toEqual([{ relay: PRIMARY, event: pet }]);
    expect(sync.status.snapshot()).toEqual({ state: 'synced', pending: 0 });
    expect(seen).toEqual(['pending', 'synced']);
  });

  it('a newer revision of the same Blobbi replaces the older one owed; an accepted write is never pending', () => {
    const { sync } = setup();
    const [first, second] = [ev(31124), ev(31124)];
    for (const pet of [first, second]) {
      sync.noteResult(pet, { relay: A, verdict: 'accepted' });
      sync.noteResult(pet, { relay: PRIMARY, verdict: 'retry' });
    }
    expect(sync.status.snapshot().pending).toBe(1);
    sync.noteResult(second, { relay: PRIMARY, verdict: 'accepted' });
    expect(sync.status.snapshot()).toEqual({ state: 'synced', pending: 0 });
  });

  it('refused by the primary, accepted elsewhere: the action stands, and the refusal is what the status says', () => {
    const { sync } = setup();
    const pet = ev(31124);
    sync.noteResult(pet, { relay: A, verdict: 'accepted' });
    sync.noteResult(pet, { relay: PRIMARY, verdict: 'rejected', message: 'blocked: this relay is in pilot mode; author is not on the write list' });
    expect(sync.status.snapshot()).toMatchObject({ state: 'refused', pending: 0 });
    // The list opened: the next write is accepted, and the refusal is over
    sync.noteResult(ev(31124), { relay: PRIMARY, verdict: 'accepted' });
    expect(sync.status.snapshot().state).toBe('synced');
  });
});

describe('a relay that asks for a pause', () => {
  it('is offered nothing more in that read: one failed offer, not one per event', async () => {
    const { world, sync } = setup();
    world.answer.set(PRIMARY, 'rate-limited: slow down');
    world.held.get(A)!.push(...Array.from({ length: 20 }, () => ev(1124)));
    await sync.noteRead(...read(world, care));
    expect(world.sent.filter((s) => s.relay === PRIMARY)).toHaveLength(1);
    // The other relay of the flow is not held back by it
    expect(world.sent.filter((s) => s.relay === B)).toHaveLength(20);
  });
});

describe('copying existing events is off until the account turns it on', () => {
  /** State on the relays as a restored session finds it: everything on A, part on B, nothing on the primary. */
  function restored(world: World) {
    const pet = ev(31124);
    const receipts = [ev(1124), ev(1124), ev(1124)];
    world.held.get(A)!.push(pet, ...receipts);
    world.held.get(B)!.push(receipts[0]);
    return { pet, receipts };
  }

  it('a restored session reads and sends NOTHING: no relay is offered a single event, and nothing shows as pending', async () => {
    const { world, sync } = setup({ consent: false });
    restored(world);
    expect(await sync.noteRead(...read(world, pets))).toBe(0);
    expect(await sync.noteRead(...read(world, care))).toBe(0);
    expect(world.sent).toEqual([]);
    expect(sync.status.snapshot()).toEqual({ state: 'synced', pending: 0 });
  });

  it('once the account turns it on: its own winning events go only where they are certainly missing, only to the relays it agreed to', async () => {
    const { world, sync, gate, consentStore } = setup({ consent: false });
    const { pet, receipts } = restored(world);
    const strangers = ev(31124, { pubkey: OTHER, tags: [['d', 'theirs']] });
    world.held.get(A)!.push(strangers);
    // Shown three relays, the account agrees to two of them (the list it saw is what counts)
    gate.enable(ME, [PRIMARY, A]);
    await sync.noteRead(...read(world, [{ kinds: [31124], authors: [ME, OTHER] }]));
    await sync.noteRead(...read(world, care));
    expect(world.sent.every((s) => s.relay === PRIMARY)).toBe(true); // never B: not agreed to; never A: it has them
    expect(world.sent.map((s) => s.event.id).sort()).toEqual([pet.id, ...receipts.map((r) => r.id)].sort());
    expect(world.sent.some((s) => s.event.pubkey === OTHER)).toBe(false);
    // Kept across a reload: public data only
    expect(consentStore.get(SYNC_CONSENT_KEY)).toContain(ME);
    // Turned off again: the next read sends nothing, though B still lacks them
    gate.disable(ME);
    const before = world.sent.length;
    await sync.noteRead(...read(world, care));
    expect(world.sent).toHaveLength(before);
  });

  it("another account's answer covers nothing of this one's, and a signed-out page has none", async () => {
    const { world, sync, gate } = setup({ consent: false });
    restored(world);
    gate.enable(OTHER, [PRIMARY, A, B]);
    expect(await sync.noteRead(...read(world, pets))).toBe(0);
    sync.setAccount(null);
    expect(await sync.noteRead(...read(world, pets))).toBe(0);
    expect(world.sent).toEqual([]);
  });

  it('an event signed in THIS visit that the primary was silent for is still carried to it: finishing a publication, not copying', async () => {
    const { world, sync, gate } = setup({ consent: false });
    const { pet: old } = restored(world);
    const fresh = ev(31124, { tags: [['d', 'pet-2']] });
    gate.markSigned(fresh.id);
    sync.noteResult(fresh, { relay: PRIMARY, verdict: 'retry', message: 'The operation timed out' });
    sync.noteResult(fresh, { relay: A, verdict: 'accepted' });
    sync.noteResult(fresh, { relay: B, verdict: 'accepted' });
    world.held.get(A)!.push(fresh);
    world.held.get(B)!.push(fresh);
    expect(sync.status.snapshot().state).toBe('pending');
    world.clock.now += 30_001;
    await sync.noteRead(...read(world, pets));
    // The new one only; the Blobbi from before this visit stays where it was
    expect(world.sent).toEqual([{ relay: PRIMARY, event: fresh }]);
    expect(world.sent.some((s) => s.event.id === old.id)).toBe(false);
    expect(sync.status.snapshot().state).toBe('synced');
  });
});
