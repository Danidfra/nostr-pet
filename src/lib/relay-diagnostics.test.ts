import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { FakeRelay } from '@/test/fake-relays';
import { MAX_RECORDS, createRelayDiagnostics, openSubscriptions } from './relay-diagnostics';

const ev = (id: string, kind = 31124): NostrEvent => ({ id, kind, pubkey: 'p'.repeat(64), created_at: 1, tags: [['secret-tag', 'x']], content: 'private words', sig: 's' });

describe('relay diagnostics', () => {
  it('follows a subscription from open to close: EOSE, events, duplicates, how it ended', async () => {
    const d = createRelayDiagnostics();
    const fake = new FakeRelay('wss://a');
    fake.events = [ev('1'), ev('1'), ev('2')];
    const relay = d.instrument(fake, 'wss://a');
    const stop = new AbortController();
    for await (const msg of relay.req([{ kinds: [31124], authors: ['p'.repeat(64)] }], { signal: stop.signal })) {
      if (msg[0] === 'EOSE') stop.abort();
    }
    const [sub] = d.snapshot().subscriptions;
    expect(sub).toMatchObject({ relay: 'wss://a', kinds: [31124], events: 3, duplicates: 1, end: 'eose-abort' });
    expect(sub.eoseAt).not.toBeNull();
    expect(openSubscriptions(d.snapshot())).toEqual([]);
    expect(d.snapshot().totals).toMatchObject({ subscriptionsOpened: 1, subscriptionsClosed: 1, duplicates: 1 });
  });

  it('records each publication verdict by relay, with the refusal prefix only', async () => {
    const d = createRelayDiagnostics();
    const ok = d.instrument(new FakeRelay('wss://ok'), 'wss://ok');
    const refusing = new FakeRelay('wss://no');
    refusing.refuseWith = 'blocked: you are not on the list, Alice';
    const no = d.instrument(refusing, 'wss://no');
    await ok.event(ev('9'));
    await expect(no.event(ev('9'))).rejects.toThrow();
    expect(d.snapshot().publications.map((p) => [p.relay, p.verdict])).toEqual([
      ['wss://ok', 'accepted'],
      ['wss://no', 'refused:blocked'],
    ]);
  });

  it('never keeps content, tags, authors or free text', async () => {
    const d = createRelayDiagnostics();
    const fake = new FakeRelay('wss://a');
    fake.events = [ev('1')];
    fake.refuseWith = 'blocked: Alice';
    const relay = d.instrument(fake, 'wss://a');
    for await (const msg of relay.req([{ kinds: [31124], authors: ['p'.repeat(64)] }])) void msg;
    await relay.event(ev('2')).catch(() => {});
    d.log({ url: 'wss://a', ns: 'relay.ws.retry', backoff: 1000 });
    const text = JSON.stringify(d.snapshot());
    for (const secret of ['private words', 'secret-tag', 'p'.repeat(64), 'Alice']) expect(text).not.toContain(secret);
  });

  it('counts sockets and reconnection attempts from the relay log', () => {
    const d = createRelayDiagnostics();
    d.log({ url: 'wss://a', ns: 'relay.ws.state', state: 'open' });
    d.log({ url: 'wss://a', ns: 'relay.ws.state', state: 'close' });
    d.log({ url: 'wss://a', ns: 'relay.ws.retry', backoff: 2000 });
    d.log({ url: 'wss://a', ns: 'relay.ws.message' });
    expect(d.snapshot().sockets).toEqual([expect.objectContaining({ relay: 'wss://a', state: 'retrying', opens: 1, retries: 1, lastBackoffMs: 2000 })]);
  });

  it('keeps a bounded history', async () => {
    const d = createRelayDiagnostics();
    const relay = d.instrument(new FakeRelay('wss://a'), 'wss://a');
    for (let i = 0; i < MAX_RECORDS + 50; i++) await relay.event(ev(String(i)));
    expect(d.snapshot().publications).toHaveLength(MAX_RECORDS);
    expect(d.snapshot().totals.publications).toBe(MAX_RECORDS + 50);
  });
});
